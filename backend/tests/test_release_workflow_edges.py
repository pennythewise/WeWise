"""Reproductions from browser acceptance, using uploaded files rather than seed IDs."""
from pathlib import Path

import pytest

from backend.app import core

pytestmark = pytest.mark.task


def screening(client, text):
    response = client.post("/api/buying/mis-selling-check", json={"text": text})
    assert response.status_code == 200, response.text
    return response.json()


def test_chinese_compound_guarantee_non_disclosure_pressure_is_flagged(client):
    result = screening(client, "保证100%赔付，不用如实告知，今天必须购买")
    assert {f["id"] for f in result["flags"]} == {"guaranteed_payout", "non_disclosure", "pressure"}
    assert result["result"] == "review_needed"
    assert "Pattern screening only" in result["notice"]


@pytest.mark.parametrize("text,flag", [
    ("承诺百分之百获赔", "guaranteed_payout"),
    ("保证100％理赔", "guaranteed_payout"),
    ("肯定会赔", "guaranteed_payout"),
    ("保证赔", "guaranteed_payout"),
    ("Guaranteed full payout", "guaranteed_payout"),
    ("We guarantee your claim", "guaranteed_payout"),
    ("100% guaranteed", "guaranteed_payout"),
    ("无需如实告知", "non_disclosure"),
    ("可以不申报", "non_disclosure"),
    ("You don't need to disclose your condition", "non_disclosure"),
    ("Conceal your medical history", "non_disclosure"),
    ("现在务必投保", "pressure"),
    ("必须今天下单", "pressure"),
    ("Buy today", "pressure"),
    ("You must purchase this", "pressure"),
])
def test_bounded_obvious_selling_variants(client, text, flag):
    result = screening(client, text)
    assert flag in {f["id"] for f in result["flags"]}


@pytest.mark.parametrize("text", [
    "赔付须按合同及事实审核，请如实告知，可比较后再决定。",
    "不能保证100%赔付，不要隐瞒病史，无需立即购买。",
    "不能保证赔，仍须按合同及事实审核。",
    "We cannot guarantee a payout. Do not hide your condition. No need to buy now.",
    "Review the wording, disclose requested facts and take time to compare policies.",
])
def test_neutral_or_explicitly_cautious_copy_does_not_trigger_sales_flags(client, text):
    result = screening(client, text)
    assert result["flags"] == []
    assert result["result"] == "no_pattern_detected"
    assert "absence of a flag does not prove" in result["notice"]


def imported_case(client, *, wording="exact", product="安联境外旅行（畅游版）互联网意外伤害保险", insurer="安联人寿保险有限公司"):
    text = (
        "SYNTHETIC USER-UPLOADED SCHEDULE — NOT AN ISSUED POLICY\n"
        f"Insurer: {insurer}\nProduct: {product}\n"
        "Policy number: SYNTHETIC-NEW-IMPORT-2026\nInsured name: Fictional person\n"
        "Start date: 2026-10-15\nEnd date: 2026-10-25\nDestination: Japan\n"
        "Selected benefit: Accidental outpatient medical expenses\n"
    )
    response = client.post("/api/documents", data={"kind": "policy"}, files={"file": ("SYNTHETIC-user-schedule.txt", text.encode(), "text/plain")})
    assert response.status_code == 200, response.text
    policy = response.json()["policy"]
    assert "catalog_product_id" not in policy["fields"] and "source_url" not in policy["fields"]
    if wording != "missing":
        fixture = core.ROOT / "backend" / "fixtures" / "allianz-changyou-2023-wording.pdf"
        raw, media = (fixture.read_bytes(), "application/pdf") if wording == "exact" else (b"SYNTHETIC unrelated wording, despite its convincing filename.", "text/plain")
        attached = client.post("/api/documents", data={"kind": "policy", "policy_id": policy["id"]}, files={"file": ("Allianz-public-2023-wording.pdf", raw, media)})
        assert attached.status_code == 200, attached.text
    reviewed = client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True})
    assert reviewed.status_code == 200, reviewed.text
    policy = reviewed.json()
    response = client.post("/api/claims", json={"policy_id": policy["id"], "incident": {
        "date": "2026-10-17", "country": "Japan", "city": "Tokyo",
        "description": "SYNTHETIC walking fall requiring outpatient treatment", "treatment_type": "outpatient"}})
    assert response.status_code == 200, response.text
    return response.json(), policy


def complete_case(client, case):
    for category in ("identity", "travel_proof", "medical_record", "original_expense"):
        response = client.post("/api/documents", data={"kind": "evidence", "claim_id": case["id"]}, files={"file": (f"SYNTHETIC-{category}.txt", f"SYNTHETIC {category} test evidence. No real person.".encode(), "text/plain")})
        assert response.status_code == 200, response.text
        document_id = response.json()["document"]["id"]
        assert client.put(f"/api/claims/{case['id']}/evidence/{document_id}", json={"category": category, "confirmed": True}).status_code == 200
    form = client.post(f"/api/claims/{case['id']}/generate-form").json()
    assert client.put(f"/api/claims/{case['id']}/evidence/{form['document_id']}", json={"category": "claim_form", "confirmed": True}).status_code == 200
    reviewed = client.post(f"/api/claims/{case['id']}/confirm", json={"revision": case["revision"], "confirmed_fields": ["date", "country", "description", "treatment_type"], "confirmed": True})
    assert reviewed.status_code == 200, reviewed.text
    return reviewed.json()


def test_fresh_import_with_owned_exact_wording_can_prepare_real_export(client):
    case, policy = imported_case(client)
    assert next(c for c in case["prescreen"]["checks"] if c["id"] == "reviewed_rule")["status"] == "pass"
    case = complete_case(client, case)
    assert case["missing"] == []
    preview = client.post(f"/api/claims/{case['id']}/preview", json={"mode": "prepared"})
    assert preview.status_code == 200, preview.text
    response = client.post(f"/api/claims/{case['id']}/export", json={"token": preview.json()["token"], "confirmed": True})
    assert response.status_code == 200, response.text
    assert response.json()["actual_status"] == "PREPARED_NOT_SUBMITTED"
    assert response.json()["submitted"] is False
    assert client.get(response.json()["pdf_url"]).content.startswith(b"%PDF")
    assert client.get(response.json()["zip_url"]).content.startswith(b"PK")


@pytest.mark.attack
@pytest.mark.parametrize("variant", ["missing", "wrong_wording", "wrong_product", "wrong_insurer", "changed_bytes"])
def test_wording_identity_and_actual_owned_bytes_are_required(client, variant):
    case, policy = imported_case(client,
        wording="missing" if variant == "missing" else "wrong" if variant == "wrong_wording" else "exact",
        product="Unrelated Allianz travel product" if variant == "wrong_product" else "安联境外旅行（畅游版）互联网意外伤害保险",
        insurer="Fictional unrelated insurer" if variant == "wrong_insurer" else "安联人寿保险有限公司")
    if variant == "changed_bytes":
        wording = next(d for d in policy["documents"] if d["name"] == "Allianz-public-2023-wording.pdf")
        with core.get_db() as db:
            path = Path(db.execute("SELECT storage_path FROM documents WHERE id=?", (wording["id"],)).fetchone()[0])
        path.write_bytes(b"SYNTHETIC file changed after indexing")
        case = client.get(f"/api/claims/{case['id']}").json()
    assert next(c for c in case["prescreen"]["checks"] if c["id"] == "reviewed_rule")["status"] == "unresolved"
    case = complete_case(client, case)
    response = client.post(f"/api/claims/{case['id']}/preview", json={"mode": "prepared"})
    assert response.status_code == 409
    assert client.post(f"/api/claims/{case['id']}/preview", json={"mode": "draft"}).status_code == 200


@pytest.mark.attack
def test_hidden_seed_product_identifier_does_not_replace_deleted_wording(client):
    policy = client.get("/api/policies").json()["policies"][0]
    assert policy["fields"]["catalog_product_id"] == "allianz_changyou_2023"
    wording = next(d for d in policy["documents"] if d["name"] == "Allianz-public-2023-wording.pdf")
    assert client.delete(f"/api/documents/{wording['id']}").status_code == 200
    assert client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True}).status_code == 200
    response = client.post("/api/claims", json={"policy_id": policy["id"], "incident": {"date": "2026-10-17", "country": "Japan", "description": "Synthetic fall"}})
    assert response.status_code == 200, response.text
    assert next(c for c in response.json()["prescreen"]["checks"] if c["id"] == "reviewed_rule")["status"] == "unresolved"


def test_document_deletion_disclosure_does_not_promise_snapshot_erasure(client):
    policy = client.get("/api/policies").json()["policies"][0]
    document = client.get(f"/api/documents/{policy['document_id']}").json()
    assert "deployment snapshots" in document["retention"]
    result = client.delete(f"/api/documents/{document['id']}")
    assert result.status_code == 200
    assert result.json()["retrieval_removed"] is True
    assert "not erased" in result.json()["backup_notice"]
    assert "already downloaded" in result.json()["backup_notice"]
