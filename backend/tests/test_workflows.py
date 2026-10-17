"""Claims/action-boundary regression tests, using real files and synthetic facts."""
from __future__ import annotations

from datetime import date
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

import pymupdf

import pytest
from fastapi.testclient import TestClient

from backend.app import core, documents, workflows
from backend.app.main import create_app

pytestmark = pytest.mark.task


@pytest.fixture
def workflow_client(tmp_path, monkeypatch):
    monkeypatch.setenv("WEWISE_SEED_DEMO", "1")
    monkeypatch.setattr(core, "_login_limits", {})
    monkeypatch.setattr(core, "DATA_DIR", tmp_path)
    monkeypatch.setattr(core, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(documents, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(documents, "DATA_DIR", tmp_path)
    monkeypatch.setattr(workflows, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(workflows, "EXPORT_DIR", tmp_path / "exports")
    with TestClient(create_app()) as client:
        login = client.post("/api/auth/login", json={"email": "demo@wewise.test", "password": "WeWiseDemo2026!"})
        assert login.status_code == 200
        yield client


def confirmed_policy(client):
    policies = client.get("/api/policies").json()["policies"]
    assert policies, "The synthetic schedule should be available."
    result = client.patch(f"/api/policies/{policies[0]['id']}", json={"fields": {
        "insurer": "中德安联人寿保险有限公司", "policy_number": "SYNTHETIC-JAPAN-TEST", "insured_name": "林美",
        "start_date": "2026-10-15", "end_date": "2026-10-25", "destination": "Japan"}, "confirmed": True})
    assert result.status_code == 200, result.text
    return result.json()


def create_case(client, **overrides):
    policy = confirmed_policy(client)
    incident = {"date": "2026-10-17", "country": "Japan", "city": "Tokyo", "description": "SYNTHETIC walking slip, outpatient treatment.", "treatment_type": "outpatient"} | overrides
    response = client.post("/api/claims", json={"policy_id": policy["id"], "incident": incident})
    assert response.status_code == 200, response.text
    return response.json(), policy


def confirm_case(client, case):
    response = client.post(f"/api/claims/{case['id']}/confirm", json={"revision": case["revision"], "confirmed_fields": ["date", "country", "description", "treatment_type"], "confirmed": True})
    assert response.status_code == 200, response.text
    return response.json()


def upload_evidence(client, case, category, confirmed=True):
    content = f"SYNTHETIC TEST DOCUMENT\nCategory: {category}\nInsured: fictional Mei\nDate: 2026-10-17\nNo real patient or insurance evidence."
    result = client.post("/api/documents", data={"kind": "evidence", "claim_id": case["id"]}, files={"file": (f"SYNTHETIC-{category}.txt", content.encode(), "text/plain")})
    assert result.status_code == 200, result.text
    doc = result.json()
    identifier = doc.get("document", doc)["id"]
    result = client.put(f"/api/claims/{case['id']}/evidence/{identifier}", json={"category": category, "confirmed": confirmed, "fields": {"source_date": "2026-10-17"}})
    assert result.status_code == 200, result.text
    return identifier


def prepared_case(client):
    case, policy = create_case(client)
    for category in ("identity", "travel_proof", "medical_record", "original_expense"):
        upload_evidence(client, case, category)
    form = client.post(f"/api/claims/{case['id']}/generate-form").json()
    confirmation = client.put(f"/api/claims/{case['id']}/evidence/{form['document_id']}", json={"category": "claim_form", "confirmed": True})
    assert confirmation.status_code == 200, confirmation.text
    return confirm_case(client, case), policy


def preview(client, case, mode="draft", **kwargs):
    result = client.post(f"/api/claims/{case['id']}/preview", json={"mode": mode} | kwargs)
    assert result.status_code == 200, result.text
    return result.json()


def test_guest_contacts_remain_available_without_auth(workflow_client):
    workflow_client.post("/api/auth/logout")
    response = workflow_client.get("/api/emergency?country=Japan").json()
    assert {x["number"] for x in response["contacts"]} == {"119", "110", "050-3816-2787"}
    assert response["history_saved"] is False
    assert response["is_live_transfer"] is False


def test_unverified_country_has_no_invented_contacts(workflow_client):
    response = workflow_client.get("/api/emergency?country=UnknownCountry").json()
    assert response["contacts"] == []
    assert "Japan" in response["notice"]


def test_policy_confirmation_gate(workflow_client):
    policy = workflow_client.get("/api/policies").json()["policies"][0]
    result = workflow_client.post("/api/claims", json={"policy_id": policy["id"], "incident": {}})
    assert result.status_code == 409


def test_outpatient_documents_are_conditional(workflow_client):
    case, _ = create_case(workflow_client)
    categories = {item["category"] for item in case["checklist"]}
    assert categories == {"policy", "identity", "travel_proof", "medical_record", "original_expense", "claim_form"}
    inpatient, _ = create_case(workflow_client, treatment_type="inpatient", police_involved=True)
    assert {"discharge_record", "incident_evidence"} <= {item["category"] for item in inpatient["checklist"]}


def test_actual_owned_wording_required_for_policy_check(workflow_client):
    case, policy = create_case(workflow_client)
    policy_item = next(i for i in case["checklist"] if i["category"] == "policy")
    assert policy_item["confirmed"], "The exact official wording fixture must be attached to the synthetic schedule."
    with core.get_db() as db:
        db.execute("DELETE FROM policy_documents WHERE policy_id=? AND document_id<>?", (policy["id"], policy["document_id"]))
    fresh = workflow_client.get(f"/api/claims/{case['id']}").json()
    assert next(i for i in fresh["checklist"] if i["category"] == "policy")["missing"]


def test_recognised_document_is_not_confirmed(workflow_client):
    case, _ = create_case(workflow_client)
    upload_evidence(workflow_client, case, "identity", confirmed=False)
    fresh = workflow_client.get(f"/api/claims/{case['id']}").json()
    evidence = fresh["evidence"][0]
    assert evidence["recognised"] and not evidence["confirmed"]
    assert next(i for i in fresh["checklist"] if i["category"] == "identity")["missing"]


def test_missing_evidence_blocks_prepared_export(workflow_client):
    case, _ = create_case(workflow_client)
    confirm_case(workflow_client, case)
    result = workflow_client.post(f"/api/claims/{case['id']}/preview", json={"mode": "prepared"})
    assert result.status_code == 409
    assert "missing" in result.json()["detail"]


def test_draft_export_is_real_pdf_zip_and_honestly_incomplete(workflow_client):
    case, _ = create_case(workflow_client)
    action = preview(workflow_client, case)
    result = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert result.status_code == 200
    export = result.json()
    assert export["actual_status"] == "DRAFT" and export["submitted"] is False
    assert workflow_client.get(export["pdf_url"]).content.startswith(b"%PDF")
    archive = ZipFile(BytesIO(workflow_client.get(export["zip_url"]).content))
    manifest = json.loads(archive.read("02-manifest.json"))
    assert manifest["mode"] == "draft" and manifest["missing"]
    assert b"NOT SUBMITTED" in archive.read("README.txt")


def test_prepared_export_contains_actual_originals_and_stays_unsubmitted(workflow_client):
    case, _ = prepared_case(workflow_client)
    assert case["missing"] == []
    action = preview(workflow_client, case, "prepared")
    result = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert result.status_code == 200, result.text
    export = result.json()
    assert export["actual_status"] == "PREPARED_NOT_SUBMITTED"
    archive = ZipFile(BytesIO(workflow_client.get(export["zip_url"]).content))
    assert len([n for n in archive.namelist() if n.startswith("originals/")]) >= 7
    assert all(item["sha256"] for item in json.loads(archive.read("02-manifest.json"))["files"])


@pytest.mark.parametrize("mutation", ["incident", "policy", "delete_file", "remove_evidence"])
@pytest.mark.attack
def test_preview_rejects_changed_snapshot(workflow_client, mutation):
    case, policy = prepared_case(workflow_client)
    action = preview(workflow_client, case, "prepared")
    if mutation == "incident":
        response = workflow_client.patch(f"/api/claims/{case['id']}", json={"incident": case["incident"] | {"city": "Kyoto"}, "expected_revision": case["revision"]})
        assert response.status_code == 200
    elif mutation == "policy":
        workflow_client.patch(f"/api/policies/{policy['id']}", json={"fields": {"end_date": "2026-10-26"}, "confirmed": True})
    elif mutation == "delete_file":
        document_id = next(e["document_id"] for e in case["evidence"] if e["category"] == "identity")
        workflow_client.delete(f"/api/documents/{document_id}")
    else:
        workflow_client.delete(f"/api/claims/{case['id']}/evidence/{case['evidence'][0]['document_id']}")
    response = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert response.status_code == 409


@pytest.mark.attack
def test_token_requires_confirmation_expires_and_is_single_use(workflow_client):
    case, _ = create_case(workflow_client)
    action = preview(workflow_client, case)
    path = f"/api/claims/{case['id']}/export"
    assert workflow_client.post(path, json={"token": action["token"], "confirmed": False}).status_code == 409
    assert workflow_client.post(path, json={"token": action["token"], "confirmed": True}).status_code == 200
    assert workflow_client.post(path, json={"token": action["token"], "confirmed": True}).status_code == 409
    expired = preview(workflow_client, case)
    with core.get_db() as db:
        db.execute("UPDATE workflow_actions SET expires_at=0 WHERE used_at IS NULL")
    assert workflow_client.post(path, json={"token": expired["token"], "confirmed": True}).status_code == 409


def test_generated_form_cannot_be_reconfirmed_after_incident_change(workflow_client):
    case, _ = create_case(workflow_client)
    form = workflow_client.post(f"/api/claims/{case['id']}/generate-form").json()
    workflow_client.patch(f"/api/claims/{case['id']}", json={"incident": case["incident"] | {"date": "2026-10-18"}})
    response = workflow_client.put(f"/api/claims/{case['id']}/evidence/{form['document_id']}", json={"category": "claim_form", "confirmed": True})
    assert response.status_code == 409


@pytest.mark.parametrize("stage", ["RECEIVED", "IN_REVIEW", "INFO_REQUESTED", "APPROVED", "DECLINED", "PAID"])
def test_each_simulator_state_is_isolated(workflow_client, stage):
    case, _ = create_case(workflow_client)
    response = workflow_client.post(f"/api/claims/{case['id']}/simulation", json={"stage": stage}).json()
    assert response["actual_status"] == "DRAFT"
    assert response["simulation"]["events"][0]["is_simulated"] is True
    assert response["simulation"]["events"][0]["label"] == "SIMULATED"


@pytest.mark.attack
def test_user_status_update_cannot_claim_insurer_provenance(workflow_client):
    case, _ = create_case(workflow_client)
    path = f"/api/claims/{case['id']}/updates"
    assert workflow_client.post(path, json={"provenance": "insurer_confirmed", "note": "Paid"}).status_code == 422
    assert workflow_client.post(path, json={"provenance": "acknowledgement_uploaded", "note": "Receipt"}).status_code == 422
    response = workflow_client.post(path, json={"provenance": "user_reported", "note": "I contacted the insurer."}).json()
    assert response["updates"][0]["label"] == "User reported"
    assert response["actual_status"] == "DRAFT"


def test_crossborder_kit_never_claims_to_contact_provider(workflow_client):
    case, _ = create_case(workflow_client)
    kit = workflow_client.get(f"/api/claims/{case['id']}/crossborder-kit").json()
    assert kit["is_live_transfer"] is False
    assert kit["recipient"] == "User download only"
    assert kit["official_forms"] and kit["reviewed"] is False


def test_crossborder_draft_exports_verified_contacts_and_official_forms(workflow_client):
    case, _ = create_case(workflow_client)
    action = preview(workflow_client, case, "draft", action="export_crossborder_kit")
    response = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert response.status_code == 200, response.text
    export = response.json()
    pdf_response = workflow_client.get(export["pdf_url"])
    assert pdf_response.status_code == 200 and pdf_response.content.startswith(b"%PDF")
    with pymupdf.open(stream=pdf_response.content, filetype="pdf") as pdf:
        text = "\n".join(page.get_text() for page in pdf)
    for value in ("119", "110", "050-3816-2787", "guide_chi02_p7.pdf", "guide_chi02_p8.pdf", "No call, transfer or report delivery occurred"):
        assert value in text.replace("\n", ""), value
    archive_response = workflow_client.get(export["zip_url"])
    assert archive_response.status_code == 200
    archive = ZipFile(BytesIO(archive_response.content))
    manifest = json.loads(archive.read("02-manifest.json"))
    assert manifest["action"] == "export_crossborder_kit"
    assert manifest["mode"] == "draft" and manifest["missing"]
    assert archive.read("01-reviewed-summary.pdf") == pdf_response.content
    assert export["actual_status"] == "DRAFT" and export["submitted"] is False


def test_crossborder_unknown_destination_exports_honest_draft_without_japan_contacts(workflow_client):
    case, _ = create_case(workflow_client, country="UnknownCountry")
    action = preview(workflow_client, case, "draft", action="export_crossborder_kit")
    response = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert response.status_code == 200, response.text
    with pymupdf.open(stream=workflow_client.get(response.json()["pdf_url"]).content, filetype="pdf") as pdf:
        text = "\n".join(page.get_text() for page in pdf)
    assert "Japan contacts only" in text
    assert "No reviewed communication form" in text
    assert "050-3816-2787" not in text


def test_feature_judge_has_no_fabricated_prices_or_universal_best(workflow_client):
    result = workflow_client.post("/api/buying/compare", json={"needs": {"priorities": ["illness_medical", "accidental_medical"], "budget": 100}}).json()
    assert len(result["products"]) == 3
    assert all(p["premium"] is None for p in result["products"])
    assert all("unresolved_priorities" in p for p in result["products"])
    assert result["judge"]["price_used"] is False
    assert "existing cover" in result["existing_cover_notice"].lower()


def test_agent_brief_requires_contact_consent_and_callback_stays_simulated(workflow_client):
    body = {"needs": {}, "contact": {"name": "Synthetic Mei", "phone": "TEST-NOT-A-NUMBER"}}
    assert workflow_client.post("/api/buying/brief/preview", json=body).status_code == 409
    action = workflow_client.post("/api/buying/brief/preview", json=body | {"consent_to_include_contact": True}).json()
    assert "Original medical records" in action["payload"]["excluded"]
    brief = workflow_client.post("/api/buying/brief/export", json={"token": action["token"], "confirmed": True}).json()
    assert workflow_client.get(brief["pdf_url"]).content.startswith(b"%PDF")
    callback = workflow_client.post("/api/buying/callback", json={"brief_export_id": brief["export_id"], "confirmed": True}).json()
    assert callback["is_simulated"] and callback["delivered"] is False


@pytest.mark.parametrize("text,flag", [("一定赔，保证赔", "guaranteed_payout"), ("No need to disclose your condition", "non_disclosure"), ("Buy immediately", "pressure"), ("Best for everyone", "universal_best")])
def test_mis_selling_patterns_are_flagged(workflow_client, text, flag):
    response = workflow_client.post("/api/buying/mis-selling-check", json={"text": text}).json()
    assert flag in {f["id"] for f in response["flags"]}


@pytest.mark.attack
def test_second_account_cannot_access_claim_evidence_preview_or_export(workflow_client):
    case, _ = create_case(workflow_client)
    document_id = upload_evidence(workflow_client, case, "identity")
    action = preview(workflow_client, case)
    exported = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True}).json()
    workflow_client.post("/api/auth/logout")
    assert workflow_client.get(exported["pdf_url"]).status_code == 401
    workflow_client.post("/api/auth/login", json={"email": "other@wewise.test", "password": "WeWiseDemo2026!"})
    for path in (f"/api/claims/{case['id']}", exported["pdf_url"], f"/api/documents/{document_id}/file"):
        assert workflow_client.get(path).status_code == 404
    assert workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True}).status_code in (404, 409)
    assert workflow_client.get("/api/claims").json()["claims"] == []


def test_renewal_is_derived_reminder_not_transaction(workflow_client):
    policy = confirmed_policy(workflow_client)
    result = workflow_client.get("/api/renewals").json()
    reminder = next(r for r in result["reminders"] if r["id"] == policy["id"])
    assert reminder["renewed"] is False
    assert reminder["days_until_expiry"] == (date(2026, 10, 25) - date.fromisoformat(result["date_basis"])).days


def test_case_deletion_removes_private_files_and_packages_but_keeps_portfolio(workflow_client):
    case, policy = create_case(workflow_client)
    document_id = upload_evidence(workflow_client, case, "identity")
    action = preview(workflow_client, case)
    exported = workflow_client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True}).json()
    assert workflow_client.delete(f"/api/claims/{case['id']}").status_code == 409
    response = workflow_client.delete(f"/api/claims/{case['id']}?confirmed=true")
    assert response.status_code == 200
    assert workflow_client.get(f"/api/claims/{case['id']}").status_code == 404
    assert workflow_client.get(f"/api/documents/{document_id}").status_code == 404
    assert workflow_client.get(exported["pdf_url"]).status_code == 404
    assert workflow_client.get(f"/api/policies/{policy['id']}").status_code == 200
