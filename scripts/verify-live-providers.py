"""Explicit opt-in smoke: one paid synthetic Claude question, no insurer contact.

python scripts/verify-live-providers.py https://preview.example --allow-paid-call
Uses private synthetic workspaces; never accepts or prints provider credentials.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlsplit

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base')
    parser.add_argument('--allow-paid-call', action='store_true', required=True)
    parser.add_argument('--output', default='test-results/live-provider-smoke.json')
    args = parser.parse_args()
    base = args.base.rstrip('/')
    assert urlsplit(base).scheme == 'https'
    report = {'base_url': base, 'checked_at': datetime.now(timezone.utc).isoformat(), 'checks': {}}
    check = report['checks']
    with httpx.Client(base_url=base, headers={'Origin':base}, timeout=120) as a, httpx.Client(base_url=base, headers={'Origin':base}, timeout=120) as b:
        def request(client, method, path, status=200, **kwargs):
            response = client.request(method, '/api'+path, **kwargs)
            assert response.status_code == status, f'{method} {path}: {response.status_code}'
            return response.json()
        health = request(a, 'GET', '/health')
        assert health['ai']['configured'] and health['ai']['provider'] == 'anthropic'
        assert not health['jev']['configured'] and not health['jev']['verified_live']
        assert not any(health['integrations'].values())
        assert health['retrieval']['vector_embeddings'] and health['memory']['tencent_verified']
        check['runtime_and_disabled_jev'] = 'PASS'
        conversations = []
        policies = []
        try:
            for client in (a, b):
                assert request(client, 'POST', '/auth/demo', json={})['synthetic']
                policies.append((client, request(client,'GET','/policies')['policies'][0]))
            policy = policies[0][1]
            pid = policy['id']
            request(b,'POST','/chat',404,json={'message':'Explain this policy','policy_id':pid})
            request(b,'GET','/documents/'+policy['document_id'],404)
            check['foreign_policy_denied_before_provider'] = 'PASS'
            gated = request(a,'POST','/chat',json={'message':'What outpatient documents are needed?','policy_id':pid,'locale':'en'})
            conversations.append(gated['conversation_id'])
            assert gated['clarification']['type'] == 'confirm_policy'
            request(a,'PATCH','/policies/'+pid,json={'fields':{},'confirmed':True})
            reply = request(a,'POST','/chat',json={'message':'境外医疗保险金申请需要哪些证明和资料？','policy_id':pid,'locale':'zh'})
            conversations.append(reply['conversation_id'])
            assert reply['engine'] == 'claude_api' and reply['citations']
            assert any(x.get('stage') == 'model' and x.get('status') == 'ok' for x in reply['trace'])
            for citation in reply['citations']:
                document = request(a,'GET','/documents/'+citation['document_id'])
                page = next(x for x in document['pages'] if x['page'] == citation['page'])
                assert citation['quote'] in page['text']
            check['claude_answer_and_original_source_readback'] = 'PASS'
            urgent = request(a,'POST','/chat',json={'message':'urgent emergency','locale':'en'})
            conversations.append(urgent['conversation_id'])
            assert urgent['engine'] != 'claude_api'
            assert all(x.get('status') != 'ok' for x in urgent.get('trace',[]) if x.get('stage') == 'model')
            check['deterministic_emergency_priority'] = 'PASS'
            after = request(a,'GET','/health')
            assert after['ai']['live_verified'] and not after['jev']['verified_live']
            report['provider'] = {k:after['ai'].get(k) for k in ('provider','model','live_verified','live_verified_at','live_verification_scope')}
            report['answer'] = {'engine':reply['engine'],'citations':len(reply['citations'])}
            check['actual_provider_receipt'] = 'PASS'
        finally:
            for cid in set(conversations):
                request(a,'DELETE','/conversations/'+cid)
            for client, policy in policies:
                request(client,'DELETE','/policies/'+policy['id'])
                request(client,'POST','/auth/logout',json={})
            check['synthetic_content_cleanup'] = 'PASS'
    report['scope'] = 'Synthetic API smoke. No real insurance decisions, insurer transactions, production compliance or JEV accuracy measured.'
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))


if __name__ == '__main__':
    main()
