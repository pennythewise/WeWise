import json
import time
from pathlib import Path

import pytest
from backend.app import core


def upload(client, text, kind="policy"):
    response = client.post("/api/documents", data={"kind": kind}, files={"file": ("source.txt", text.encode(), "text/plain")})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.task
def test_source_terms_manual_correction_invalidates_previous_confirmation(client):
    created = upload(client, "Insurer: Example insurer\nPolicy number: TEST2026\nInsured name: Demo Person\nStart date: 2026-01-01\nEnd date: 2027-01-01\n保险责任：门诊医疗保险金\n免赔额：人民币200元\n等待期：30天\n责任免除：酒后驾驶不承担保险责任。")
    pid = created["policy"]["id"]
    result = client.get(f"/api/policies/{pid}/analysis").json()
    assert {"coverage", "deductible", "waiting", "exclusion"}.issubset({t["type"] for t in result["terms"]})
    term = next(t for t in result["terms"] if t["type"] == "deductible" and t["source"])
    patch = {k: term[k] for k in ("field", "type", "label", "value", "source")}
    response = client.patch(f"/api/policies/{pid}/terms", json={"terms": [patch], "confirmed": True, "expected_revision": result["revision"]})
    assert response.status_code == 200, response.text
    assert response.json()["revision"] == result["revision"] + 1
    assert response.json()["terms"][0]["status"] == "user_confirmed"
    assert response.json()["terms"][0]["confidence"] is None
    assert not client.get(f"/api/policies/{pid}").json()["confirmed"]
    patch["source"]["quote"] = "a fabricated deductible"
    assert client.patch(f"/api/policies/{pid}/terms", json={"terms": [patch], "confirmed": True, "expected_revision": response.json()["revision"]}).status_code == 422


@pytest.mark.task
def test_medical_financial_facts_keep_source_and_do_not_become_memory(client):
    created = upload(client, "Patient name: Test Person\n就诊日期：2026年10月7日\nDiagnosis: recorded ankle injury\nHospital: Demo clinic\nTotal amount: 12345\nCurrency: JPY\nAnnual income: 200000 CNY", "medical_report")
    did = created["document"]["id"]
    analysis = client.get(f"/api/documents/{did}/analysis").json()
    facts = {f["field"]: f for f in analysis["facts"]}
    assert facts["treatment_date"]["value"] == "2026-10-07"
    assert facts["patient_name"]["source"]["quote"] == "Patient name: Test Person"
    assert facts["recorded_diagnosis"]["status"] == "source_candidate"
    assert "not medical interpretation" in analysis["notice"]
    review = [{k: f[k] for k in ("field", "value", "source")} for f in analysis["facts"]]
    saved = client.patch(f"/api/documents/{did}/analysis", json={"facts": review, "confirmed": True})
    assert saved.status_code == 200 and saved.json()["confirmed"]
    assert any(r["document_id"] == did for r in client.get("/api/reports").json()["reports"])
    assert client.get("/api/memory").json()["memories"] == []


@pytest.mark.attack
def test_foreign_source_cannot_be_bound_to_own_policy(client, stranger):
    a = upload(client, "保险责任：境外医疗费用保险金")
    b = upload(stranger, "Other user's policy")
    assert stranger.get(f"/api/policies/{a['policy']['id']}/analysis").status_code == 404
    fake = {"field": "coverage", "type": "coverage", "value": "fabricated", "source": {"document_id": b["document"]["id"], "page": 1, "quote": "Other user's policy"}}
    assert client.patch(f"/api/policies/{a['policy']['id']}/terms", json={"terms": [fake], "confirmed": True, "expected_revision": 1}).status_code == 422


@pytest.mark.task
def test_temporary_upload_excluded_until_explicit_save(client, stranger):
    content = b"Insurer: Example\nPolicy number: TEMP2026\nInsured name: Demo\nStart date: 2026-01-01\nEnd date: 2027-01-01\nUnusual unique temp only source"
    before = len(client.get("/api/policies").json()["policies"])
    response = client.post("/api/temporary-documents", files={"file": ("temp.txt", content, "text/plain")})
    assert response.status_code == 200, response.text
    temp = response.json()["document"]
    assert temp["saved"] is False and temp["indexed"] is False
    assert len(client.get("/api/policies").json()["policies"]) == before
    with core.get_db() as db:
        assert not db.execute("SELECT 1 FROM document_chunks WHERE document_id=?", (temp["id"],)).fetchone()
    assert stranger.get(f"/api/temporary-documents/{temp['id']}/file").status_code == 404
    assert client.post(f"/api/temporary-documents/{temp['id']}/save", json={"consent": False}).status_code == 422
    saved = client.post(f"/api/temporary-documents/{temp['id']}/save", json={"consent": True, "kind": "policy"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["document"]["saved"] is True
    assert len(client.get("/api/policies").json()["policies"]) == before + 1
    assert client.get(f"/api/temporary-documents/{temp['id']}").status_code == 404
    assert any(c["purpose"] == "save_document_until_deleted" for c in client.get("/api/vault").json()["consents"])


@pytest.mark.attack
def test_expired_temp_original_cannot_be_read_or_saved_and_is_purged(client):
    response = client.post("/api/temporary-documents", files={"file": ("expire.txt", b"temporary source", "text/plain")})
    identifier = response.json()["document"]["id"]
    with core.get_db() as db:
        path = Path(db.execute("SELECT storage_path FROM temporary_documents WHERE id=?", (identifier,)).fetchone()[0])
        db.execute("UPDATE temporary_documents SET expires_at=? WHERE id=?", (time.time() - 1, identifier))
    assert path.exists()
    assert client.get(f"/api/temporary-documents/{identifier}/file").status_code == 404
    assert not path.exists()
    assert client.post(f"/api/temporary-documents/{identifier}/save", json={"consent": True}).status_code == 404


@pytest.mark.task
def test_approved_memory_reuses_needs_defaults_and_disable_takes_effect(client):
    assert client.get("/api/needs/defaults").json()["defaults"] == {}
    client.patch("/api/preferences", json={"memory_enabled": True})
    for key, value in (("budget_preferences", "Budget CNY 500"), ("travel_preferences", "Leisure travel to Japan")):
        assert client.post("/api/memory", json={"key": key, "value": value, "approved": True}).status_code == 200
    defaults = client.get("/api/needs/defaults").json()
    assert defaults["defaults"]["budget"] == 500
    assert defaults["defaults"]["destination"] == "Japan"
    client.patch("/api/preferences", json={"memory_enabled": False})
    assert client.get("/api/needs/defaults").json()["defaults"] == {}
