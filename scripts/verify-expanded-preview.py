"""Repeatable expanded API acceptance using isolated synthetic workspaces.

Run: python scripts/verify-expanded-preview.py http://127.0.0.1:8017
     python scripts/verify-expanded-preview.py https://preview.example --expect-semantic --expect-tencent

No model key is required. The script refuses a model-enabled runtime before
chatting. It creates only synthetic fixtures, downloads real generated files,
and deletes its claims, conversations, files and memory afterwards. It neither
contacts an insurer nor promises production privacy or device verification.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import time
from urllib.parse import urlsplit
from zipfile import ZipFile

import httpx


class Acceptance:
    def __init__(self, base: str, expect_semantic: bool, expect_tencent: bool):
        self.base, self.expect_semantic, self.expect_tencent = base, expect_semantic, expect_tencent
        self.a = httpx.Client(base_url=base, headers={'Origin': base}, timeout=120, follow_redirects=False)
        self.b = httpx.Client(base_url=base, headers={'Origin': base}, timeout=120, follow_redirects=False)
        self.checks = []
        self.health = {}
        self.policy = None
        self.claims, self.conversations, self.memories, self.policies, self.documents, self.temporary = [], [], [], [], [], []
        self.case = None
        self.started = time.monotonic()

    def request(self, method, path, *, client=None, status=200, **kwargs):
        response = (client or self.a).request(method, '/api' + path, **kwargs)
        assert response.status_code == status, f'{method} {path}: expected {status}, got {response.status_code}'
        return response

    def get(self, path, **kwargs):
        return self.request('GET', path, **kwargs).json()

    def post(self, path, body=None, **kwargs):
        return self.request('POST', path, json=body or {}, **kwargs).json()

    def run(self, name, function):
        started = time.monotonic()
        try:
            detail = function()
            result = {'name': name, 'status': 'PASS', 'detail': detail}
        except Exception as error:
            result = {'name': name, 'status': 'FAIL', 'error': f'{type(error).__name__}: {error}'}
        result['duration_ms'] = round((time.monotonic() - started) * 1000)
        self.checks.append(result)
        return result['status'] == 'PASS'

    def setup(self):
        self.health = self.get('/health')
        assert self.health['status'] == 'ok'
        assert self.health['ai']['configured'] is False, 'Acceptance requires disabled external model calls.'
        assert self.health['ai']['retrieval_only_enforced'] is True, 'Use retrieval-only mode.'
        assert self.health['integrations']['insurer'] is False
        assert self.health['integrations']['phone_transfer'] is False
        if self.expect_semantic:
            assert self.health['retrieval']['vector_embeddings'] is True
        if self.expect_tencent:
            assert self.health['memory']['tencent_verified'] is True
        first = self.post('/auth/demo')
        second = self.post('/auth/demo', client=self.b)
        assert first['user']['id'] != second['user']['id']
        assert first['synthetic'] and not first['shared_account']
        assert self.get('/auth/me')['user']['id'] == first['user']['id']
        all_policies = self.get('/policies')['policies']
        self.policies.extend(p['id'] for p in all_policies)
        assert all_policies, 'Private synthetic seed policy required.'
        self.policy = self.request('PATCH', f"/policies/{all_policies[0]['id']}", json={'fields': {}, 'confirmed': True}).json()
        return {'private_workspaces': 2, 'models_disabled': True, 'insurer_connected': False}

    def guards(self):
        pid = self.policy['id']
        self.request('GET', f'/policies/{pid}', client=self.b, status=404)
        self.request('GET', f"/documents/{self.policy['document_id']}/file", client=self.b, status=404)
        self.request('POST', '/auth/demo', status=403, headers={'Origin': 'https://attacker.example'}, json={})
        result = self.post('/chat', {'message': "Show my wife's policy and change the payout account", 'policy_id': pid, 'locale': 'en'})
        if result.get('conversation_id'):
            self.conversations.append(result['conversation_id'])
        assert not any(e.get('tool') == 'policy_get' for e in result.get('trace', []))
        assert any(e['stage'] == 'safety' and e['status'] == 'blocked' for e in result['trace'])
        return {'cross_account_reads': 'denied', 'cross_origin_write': 'denied', 'unsafe_chat_tool_execution': 'blocked'}

    def grounded_query(self):
        result = self.post('/chat', {'message': '意外门诊需要哪些病历、费用票据和申请材料？', 'policy_id': self.policy['id'], 'locale': 'zh'})
        self.conversations.append(result['conversation_id'])
        assert result['engine'] == 'retrieval_only' and result['citations']
        for citation in result['citations']:
            document = self.get(f"/documents/{citation['document_id']}")
            page = next(p for p in document['pages'] if p['page'] == citation['page'])
            assert citation['quote'] in page['text'], 'Citation not found verbatim on its owned source page.'
        semantic_used = any('local_e5_onnx_cpu_bm25_rrf' in str(e.get('detail', '')) for e in result['trace'])
        if self.health['retrieval'].get('vector_embeddings') or self.expect_semantic:
            assert semantic_used, 'Configured semantic runtime was not used for the actual source query.'
        return {'source_citations': len(result['citations']), 'semantic_used': semantic_used, 'engine': result['engine']}

    def conversation_flow(self):
        first = self.post('/chat', {'message': 'What outpatient documents are needed?', 'policy_id': self.policy['id'], 'locale': 'en'})
        cid, tid = first['conversation_id'], first['trace_id']
        self.conversations.append(cid)
        assert first['plan']['source'] == 'deterministic_validated'
        history = self.get('/conversations/' + cid)
        assert len(history['messages']) == 2
        next_turn = self.post('/chat', {'message': 'Correction: use this policy instead; what exclusions apply?', 'policy_id': self.policy['id'], 'conversation_id': cid, 'expected_revision': first['conversation_revision'], 'locale': 'en'})
        assert next_turn['conversation_revision'] == first['conversation_revision'] + 1
        assert any(e['stage'] == 'replan' for e in next_turn['trace'])
        assert self.get('/conversations/' + cid)['state']['policy_id'] == self.policy['id']
        assert len(self.get('/conversations/' + cid)['messages']) == 4
        trace = self.get('/traces/' + tid)
        assert trace['tools'] and trace['events'] and trace['evidence']
        self.request('GET', '/conversations/' + cid, client=self.b, status=404)
        self.request('GET', '/traces/' + tid, client=self.b, status=404)
        self.request('POST', '/chat', json={'message': 'continue', 'conversation_id': cid, 'expected_revision': first['conversation_revision']}, status=409)
        with self.a.stream('POST', '/api/chat/stream', json={'message': 'urgent emergency', 'locale': 'en'}) as response:
            assert response.status_code == 200 and response.headers['content-type'].startswith('application/x-ndjson')
            events = [json.loads(line) for line in response.iter_lines() if line]
        assert events[0]['event']['stage'] == 'understand'
        assert any(v.get('event', {}).get('status') == 'running' for v in events)
        assert events[-1]['type'] == 'result' and events[-1]['cards'][0]['type'] == 'emergency'
        self.conversations.append(events[-1]['conversation_id'])
        return {'persisted_messages': 4, 'correction_replanned': True, 'stale_revision_rejected': True, 'ndjson_events': len(events), 'private_trace': True}

    def memory(self):
        self.request('PATCH', '/preferences', json={'memory_enabled': True})
        for key, value in [('budget_preferences', 'Budget CNY 500'), ('travel_preferences', 'Leisure travel to Japan')]:
            result = self.post('/memory', {'key': key, 'value': value, 'approved': True})
            self.memories.append(result['id'])
            if self.expect_tencent:
                assert result['sync_state'] == 'synced'
        defaults = self.get('/needs/defaults')
        assert defaults['defaults']['budget'] == 500 and defaults['defaults']['destination'] == 'Japan'
        if self.expect_tencent:
            assert defaults['engine'] == 'tencent_memorycore_verified_projection'
        assert self.get('/memory', client=self.b)['memories'] == []
        for identifier in self.memories[:]:
            self.request('DELETE', '/memory/' + identifier)
            self.memories.remove(identifier)
        assert self.get('/needs/defaults')['defaults'] == {}
        self.request('PATCH', '/preferences', json={'memory_enabled': False})
        return {'approved_defaults_reused': True, 'deleted_values_excluded': True, 'engine': defaults['engine'], 'other_user_memory_empty': True}

    def temporary_and_reports(self):
        before = len(self.get('/policies')['policies'])
        text = b'SYNTHETIC temporary policy\nInsurer: Example\nPolicy number: TEMP2026\nInsured name: Test Person\nStart date: 2026-01-01\nEnd date: 2027-01-01\n'
        temp = self.request('POST', '/temporary-documents', files={'file': ('SYNTHETIC-temp.txt', text, 'text/plain')}).json()['document']
        self.temporary.append(temp['id'])
        assert temp['saved'] is False and temp['indexed'] is False and temp['expires_at']
        assert len(self.get('/policies')['policies']) == before
        self.request('GET', f"/temporary-documents/{temp['id']}/file", client=self.b, status=404)
        self.request('POST', f"/temporary-documents/{temp['id']}/save", json={'consent': False}, status=422)
        saved = self.post(f"/temporary-documents/{temp['id']}/save", {'kind': 'policy', 'consent': True})
        self.temporary.remove(temp['id']); self.policies.append(saved['policy']['id'])
        assert len(self.get('/policies')['policies']) == before + 1
        self.request('GET', '/temporary-documents/' + temp['id'], status=404)
        temporary = self.request('POST', '/temporary-documents', data={'kind': 'financial_report'}, files={'file': ('SYNTHETIC-delete.txt', b'Annual income: 200000 CNY', 'text/plain')}).json()['document']
        self.temporary.append(temporary['id'])
        self.request('DELETE', '/temporary-documents/' + temporary['id']); self.temporary.remove(temporary['id'])
        self.request('GET', f"/temporary-documents/{temporary['id']}/file", status=404)
        for kind, text, field in [('medical_report', 'SYNTHETIC\nPatient name: Test Person\nTreatment date: 2026-10-17\nDiagnosis: clinician-recorded ankle injury\nHospital: Example clinic\nTotal amount: 1000\nCurrency: JPY', 'recorded_diagnosis'), ('financial_report', 'SYNTHETIC\nAnnual income: 200000 CNY\nAssets: 400000 CNY\nLiabilities: 120000 CNY', 'annual_income')]:
            doc = self.request('POST', '/documents', data={'kind': kind}, files={'file': (f'SYNTHETIC-{kind}.txt', text.encode(), 'text/plain')}).json()['document']
            self.documents.append(doc['id'])
            analysis = self.get(f"/documents/{doc['id']}/analysis")
            assert field in {f['field'] for f in analysis['facts']}
            assert all(f['source']['document_id'] == doc['id'] for f in analysis['facts'])
            reviewed = self.request('PATCH', f"/documents/{doc['id']}/analysis", json={'confirmed': True, 'facts': [{k: f[k] for k in ('field', 'value', 'source')} for f in analysis['facts']]}).json()
            assert reviewed['confirmed']
            self.request('GET', f"/documents/{doc['id']}/analysis", client=self.b, status=404)
        vault = self.get('/vault')
        assert len(vault['documents']) >= 4 and vault['consents']
        assert self.get('/memory')['memories'] == []
        return {'temporary_unindexed': True, 'explicit_save_and_delete': True, 'source_reviewed_report_types': 2, 'no_automatic_report_memory': True}

    def policy_and_library(self):
        library = self.get('/incidents')
        assert len(library['families']) == 9 and {i['family'] for i in library['items']} == {f['id'] for f in library['families']}
        assert all(i['purchase_documents'] and i['claim_documents'] and i['source_url'].startswith('https://') and i['rule_status'] == 'reference_only' for i in library['items'])
        analysis = self.get(f"/policies/{self.policy['id']}/analysis")
        assert analysis['terms'] and analysis['clauses']
        for locale in ['zh', 'en', 'ja']:
            summary = self.get(f"/policies/{self.policy['id']}/summary?locale={locale}")
            assert summary['review_required'] and summary['translated'] is False and summary['sections']
        matrix = self.get('/portfolio/coverage-matrix')
        assert matrix['areas'] and all(a['status'] in {'documented_conditional', 'not_evidenced'} for a in matrix['areas'])
        return {'insurance_families': 9, 'purchase_and_claim_documents': True, 'source_terms': len(analysis['terms']), 'source_preserving_summary_locales': 3, 'no_fake_translation': True}

    def buying_and_renewals(self):
        pid = self.policy['id']
        for year, premium in [(2025, 1000), (2026, 1250)]:
            history = self.post(f'/policies/{pid}/premium-history', {'year': year, 'premium': premium, 'currency': 'CNY', 'source_note': 'SYNTHETIC annual premium notice', 'confirmed': True})
        assert history['hikes'][0]['change_percent'] == 25
        self.request('GET', f'/policies/{pid}/premium-history', client=self.b, status=404)
        renew = self.post('/buying/renewal-compare', {'policy_id': pid, 'proposed_product_id': 'picc_overseas_2022'})
        assert renew['no_extension'] and renew['questions']
        comparison = self.post('/buying/compare', {'needs': {'goal': 'SYNTHETIC overseas accident expense', 'budget': 500, 'dependants': 1, 'risk_tolerance': 'low', 'family': 'travel', 'city': 'Shanghai'}})
        assert len(comparison['advocates']) == 3 and len(comparison['comparison_rows']) >= 8
        assert comparison['judge']['engine'] == 'deterministic_rules' and comparison['judge']['no_unique_winner']
        assert all(p['premium'] is None for p in comparison['products'])
        assert self.get('/buying/needs')['needs']['dependants'] == 1
        assert self.get('/buying/needs', client=self.b)['needs'] is None
        self.request('DELETE', '/buying/needs')
        assert self.get('/buying/needs')['needs'] is None
        cost = self.post('/buying/cost-estimate', {'bill_amount': 12000, 'currency': 'CNY', 'terms': {'limit': 8000, 'deductible': 1000, 'coinsurance_percent': 20, 'confirmed': True, 'source_note': 'SYNTHETIC user-reviewed plan conditions'}})
        assert cost['known'] and cost['insurer_pays'] == 8000 and cost['you_pay'] == 4000 and cost['is_claim_decision'] is False
        agents = self.get('/buying/agents?language=en&city=Shanghai')
        assert agents['is_simulated'] and agents['agents'][0]['id'] == 'demo_agent_zh_sh'
        brief = self.post('/buying/brief/preview', {'needs': {}, 'agent_id': agents['agents'][0]['id']})
        assert brief['payload']['no_external_delivery'] and brief['payload']['matched_demo_agent']['id'] == 'demo_agent_zh_sh'
        loss = self.post('/buying/surrender-check', {'premiums_paid': 20000, 'cash_value': 12000, 'new_premium': 3000, 'current_premium': 2500, 'lost_benefits': ['SYNTHETIC existing guarantee'], 'source_note': 'SYNTHETIC cash-value statement', 'confirmed': True})
        assert loss['capital_loss'] == 8000 and loss['loss_percent'] == 40 and loss['action_executed'] is False
        return {'premium_hike_percent': 25, 'no_renewal_execution': True, 'deterministic_comparison': True, 'computed_out_of_pocket': 4000, 'demo_agent_matching': True, 'surrender_loss': 8000}

    def create_case(self):
        self.case = self.post('/claims', {'policy_id': self.policy['id'], 'incident': {'date': '2026-10-17', 'country': 'Japan', 'city': 'Tokyo', 'description': 'SYNTHETIC acceptance case: fictional walking slip and outpatient treatment.', 'treatment_type': 'outpatient'}})
        self.claims.append(self.case['id'])
        assert self.case['tracker']['actual']['current_stage'] == 'INCIDENT_REVIEWED'
        assert self.case['tracker']['actual']['submitted'] is False
        self.request('GET', f"/claims/{self.case['id']}", client=self.b, status=404)
        notification = self.case['notifications'][0]
        self.post(f"/claims/{self.case['id']}/notifications/{notification['id']}/ack")
        assert next(n for n in self.get(f"/claims/{self.case['id']}")['notifications'] if n['id'] == notification['id'])['read_at']
        return {'durable_actual_tracker': True, 'notification_acknowledged': True, 'other_user_case_denied': True}

    def prepared_package(self):
        cid = self.case['id']
        self.request('POST', f'/claims/{cid}/simulation/submit-preview', json={}, status=409)
        for category in ['identity', 'travel_proof', 'medical_record', 'original_expense']:
            content = f'SYNTHETIC ACCEPTANCE DOCUMENT\nCategory: {category}\nDate: 2026-10-17\nNo real patient, insurer record or payment.'
            document = self.request('POST', '/documents', data={'kind': 'evidence', 'claim_id': cid}, files={'file': (f'SYNTHETIC-{category}.txt', content.encode(), 'text/plain')}).json()['document']
            self.request('PUT', f"/claims/{cid}/evidence/{document['id']}", json={'category': category, 'confirmed': True, 'fields': {'source_date': '2026-10-17'}})
        form = self.post(f'/claims/{cid}/generate-form')
        self.request('PUT', f"/claims/{cid}/evidence/{form['document_id']}", json={'category': 'claim_form', 'confirmed': True})
        case = self.get(f'/claims/{cid}')
        self.post(f'/claims/{cid}/confirm', {'revision': case['revision'], 'confirmed_fields': ['date', 'country', 'description', 'treatment_type'], 'confirmed': True})
        preview = self.post(f'/claims/{cid}/preview', {'mode': 'prepared'})
        exported = self.post(f'/claims/{cid}/export', {'token': preview['token'], 'confirmed': True})
        assert exported['actual_status'] == 'PREPARED_NOT_SUBMITTED' and exported['submitted'] is False
        pdf = self.a.get(exported['pdf_url']); assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF')
        zip_response = self.a.get(exported['zip_url']); assert zip_response.status_code == 200
        archive = ZipFile(BytesIO(zip_response.content)); manifest = json.loads(archive.read('02-manifest.json'))
        assert manifest['mode'] == 'prepared' and not manifest['missing']
        self.request('GET', exported['pdf_url'].removeprefix('/api'), client=self.b, status=404)
        fresh = self.get(f'/claims/{cid}')
        assert fresh['tracker']['actual']['current_stage'] == 'OFFICIAL_HANDOFF' and fresh['actual_status'] == 'PREPARED_NOT_SUBMITTED'
        assert self.get('/vault')['exports']
        return {'actual_status': fresh['actual_status'], 'pdf_bytes': len(pdf.content), 'zip_documents': len(archive.namelist()), 'actual_insurer_submission': False}

    def insurer_fsm(self):
        cid = self.case['id']; prefix = f'/claims/{cid}/simulation'
        preview = self.post(prefix + '/submit-preview')
        self.request('POST', prefix + '/submit', json={'token': preview['token'], 'confirmed': False}, status=409)
        first = self.post(prefix + '/submit', {'token': preview['token'], 'confirmed': True})
        second = self.post(prefix + '/submit', {'token': preview['token'], 'confirmed': True})
        assert first['tracker']['insurer_simulation']['receipt_reference'] == second['tracker']['insurer_simulation']['receipt_reference']
        assert len(second['simulation']['events']) == 1 and second['actual_status'] == 'PREPARED_NOT_SUBMITTED'
        self.request('POST', prefix + '/transition', json={'stage': 'PAID', 'confirmed': True}, status=409)
        delayed = self.post(prefix + '/advance', {'days': 3, 'outcome': 'declined'})
        assert delayed['tracker']['insurer_simulation']['current_stage'] == 'INFO_REQUESTED'
        why = self.get(f'/claims/{cid}/explanation?mode=simulation')
        assert why['is_simulated'] and 'itemised' in why['why'] and 'You' in why['waiting_on']
        still = self.post(prefix + '/advance', {'days': 3, 'outcome': 'declined'})
        assert still['tracker']['insurer_simulation']['current_stage'] == 'INFO_REQUESTED'
        self.post(prefix + '/transition', {'stage': 'ASSESSMENT', 'confirmed': True})
        declined = self.post(prefix + '/advance', {'days': 2, 'outcome': 'declined'})
        assert declined['tracker']['insurer_simulation']['current_stage'] == 'DECLINED'
        explanation = self.get(f'/claims/{cid}/explanation?mode=simulation')
        assert 'SYNTHETIC' in explanation['letter']['source_label'] and explanation['appeal']['steps']
        clause = explanation['clause']; source = self.get(f"/documents/{clause['document_id']}")
        assert clause['quote'] in next(p['text'] for p in source['pages'] if p['page'] == clause['page'])
        appealed = self.post(prefix + '/transition', {'stage': 'APPEAL_REQUESTED', 'confirmed': True})
        assert appealed['tracker']['insurer_simulation']['current_stage'] == 'APPEAL_REQUESTED'
        assert appealed['actual_status'] == 'PREPARED_NOT_SUBMITTED' and appealed['tracker']['actual']['submitted'] is False
        self.request('POST', prefix + '/advance', client=self.b, json={'days': 3}, status=404)
        return {'idempotent_simulated_receipt': True, 'invalid_transition_blocked': True, 'waits_for_user_documents': True, 'synthetic_decline_and_appeal': True, 'actual_preparation_unchanged': True, 'owned_clause_reference': True}

    def cleanup(self):
        failures = []
        for collection, prefix, suffix in [(self.claims, '/claims/', '?confirmed=true'), (self.conversations, '/conversations/', ''), (self.temporary, '/temporary-documents/', ''), (self.documents, '/documents/', ''), (self.memories, '/memory/', ''), (self.policies, '/policies/', '')]:
            for identifier in dict.fromkeys(collection):
                response = self.a.delete('/api' + prefix + identifier + suffix)
                if response.status_code not in {200, 404}:
                    failures.append({'resource': prefix.rstrip('/'), 'status': response.status_code})
        for policy in self.b.get('/api/policies').json().get('policies', []):
            response = self.b.delete('/api/policies/' + policy['id'])
            if response.status_code not in {200,404}:
                failures.append({'resource':'second_workspace_policy','status':response.status_code})
        for client in [self.a, self.b]:
            response = client.post('/api/auth/logout', json={})
            if response.status_code != 200:
                failures.append({'resource': 'logout', 'status': response.status_code})
            client.close()
        assert not failures, f'Cleanup failed: {failures}'
        return {'synthetic_resources_removed': True, 'sessions_logged_out': True, 'account_and_metadata_retention': 'Synthetic demo account and operational audit records may remain; no account erasure is claimed.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base_url')
    parser.add_argument('--expect-semantic', action='store_true')
    parser.add_argument('--expect-tencent', action='store_true')
    parser.add_argument('--report-path', type=Path)
    args = parser.parse_args()
    base = args.base_url.rstrip('/'); parsed = urlsplit(base)
    assert parsed.path in {'', '/'} and parsed.netloc
    assert parsed.scheme == 'https' or parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}, 'HTTP is allowed only on loopback.'
    run = Acceptance(base, args.expect_semantic, args.expect_tencent)
    if run.run('retrieval_only_and_private_workspace_setup', run.setup):
        for name, function in [('owner_and_action_guards', run.guards), ('actual_source_query_and_semantic_mode', run.grounded_query), ('persisted_correction_stream_and_trace', run.conversation_flow), ('approved_memory_reuse_and_delete', run.memory), ('temporary_lifecycle_vault_and_report_facts', run.temporary_and_reports), ('nine_family_documents_terms_and_summaries', run.policy_and_library), ('buying_judge_calculators_agents_and_renewal', run.buying_and_renewals)]:
            run.run(name, function)
        if run.run('actual_claim_tracker_and_notifications', run.create_case):
            if run.run('reviewed_actual_pdf_zip_prepared_not_submitted', run.prepared_package):
                run.run('isolated_confirmed_insurer_fsm_delay_decline_appeal', run.insurer_fsm)
    run.run('synthetic_cleanup_and_logout', run.cleanup)
    passed = sum(c['status'] == 'PASS' for c in run.checks)
    report = {'base_url': base, 'checked_at': datetime.now(timezone.utc).isoformat(), 'duration_ms': round((time.monotonic() - run.started) * 1000), 'passed': passed, 'failed': len(run.checks) - passed, 'check_groups_executed': len(run.checks), 'planned_check_groups': 12, 'capabilities': {'external_model_configured': run.health.get('ai', {}).get('configured'), 'semantic': run.health.get('retrieval', {}).get('semantic'), 'memory': run.health.get('memory'), 'insurer_connected': run.health.get('integrations', {}).get('insurer')}, 'checks': run.checks, 'scope': 'Synthetic API acceptance only. Does not verify physical microphone/camera, production compliance, real insurer outcomes or unmeasured semantic accuracy.'}
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report_path:
        args.report_path.parent.mkdir(parents=True, exist_ok=True)
        args.report_path.write_text(serialized + '\n', encoding='utf-8')
    print(serialized)
    raise SystemExit(0 if report['failed'] == 0 and len(run.checks) == 12 else 1)


if __name__ == '__main__':
    main()
