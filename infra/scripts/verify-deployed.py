"""HTTPS preview smoke using two private synthetic workspaces, never provider keys.

Run with the project Python: python infra/scripts/verify-deployed.py https://preview.example
This creates two browser-like demo accounts and one synthetic claim, then removes
the claim and logs out. It does not submit claims or contact an insurer/model.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
import json
import sys
from urllib.parse import urlsplit
from zipfile import ZipFile

import httpx


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: set[str] = set()

    def handle_starttag(self, _tag, attrs):
        for key, value in attrs:
            if key in {"src", "href"} and value and value.startswith("/assets/"):
                self.urls.add(value)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python infra/scripts/verify-deployed.py https://preview.example")
    base = sys.argv[1].rstrip("/")
    parsed = urlsplit(base)
    assert parsed.scheme == "https" and parsed.netloc and parsed.path in {"", "/"}, "Use the public HTTPS origin."
    report = {"base_url": base, "checked_at": datetime.now(timezone.utc).isoformat(), "checks": {}}
    checks = report["checks"]

    def expect(response, status=200):
        assert response.status_code == status, f"{response.request.method} {response.request.url.path}: {response.status_code}, {response.text[:400]}"
        return response

    with httpx.Client(base_url=base, timeout=90, follow_redirects=False, headers={"Origin": base}) as a, \
            httpx.Client(base_url=base, timeout=90, follow_redirects=False, headers={"Origin": base}) as b:
        page = expect(a.get("/"))
        assert '<div id="root">' in page.text
        assets = Assets()
        assets.feed(page.text)
        assert assets.urls, "No built frontend assets found."
        for path in assets.urls:
            expect(a.get(path))
        checks["built_frontend_assets"] = "pass"
        expect(a.get("/ask"))
        checks["spa_deep_route"] = "pass"
        health = expect(a.get("/api/health")).json()
        assert health["status"] == "ok"
        assert health["ai"]["engine"] == "retrieval_only"
        assert health["ai"]["configured"] is False
        assert health["ai"]["retrieval_only_enforced"] is True
        assert health["integrations"]["insurer"] is False
        checks["forced_retrieval_no_insurer_connection"] = "pass"
        expect(a.get("/api/policies"), 401)
        emergency = expect(a.get("/api/emergency?country=Japan")).json()
        assert emergency["is_live_transfer"] is False
        assert {item["number"] for item in emergency["contacts"]} == {"119", "110", "050-3816-2787"}
        checks["private_guest_access_blocked_public_emergency_available"] = "pass"
        expect(a.post("/api/auth/demo", json={}, headers={"Origin": "https://attacker.example"}), 403)
        checks["cross_origin_mutations_blocked"] = "pass"

        first = expect(a.post("/api/auth/demo", json={}))
        second = expect(b.post("/api/auth/demo", json={}))
        assert first.json()["user"]["id"] != second.json()["user"]["id"]
        assert first.json()["synthetic"] is True and first.json()["shared_account"] is False
        cookie = first.headers.get("set-cookie", "").lower()
        assert all(flag in cookie for flag in ("secure", "httponly", "samesite=strict")), cookie
        expect(a.get("/api/auth/me"))
        checks["unique_synthetic_workspaces_and_secure_cookie"] = "pass"

        policy = expect(a.get("/api/policies")).json()["policies"][0]
        other = expect(b.get("/api/policies")).json()["policies"][0]
        pid = policy["id"]
        assert pid != other["id"] and policy["fields"]["synthetic"] is True
        expect(b.get(f"/api/policies/{pid}"), 404)
        expect(b.get(f"/api/documents/{policy['document_id']}/file"), 404)
        checks["cross_account_policy_and_file_denial"] = "pass"

        portfolio = expect(a.get("/api/portfolio")).json()
        assert "travel" in {item["family"] for item in portfolio["analysis"]["gaps"]}, "An unreviewed card cannot establish current cover."
        checks["unconfirmed_policy_does_not_hide_portfolio_gap"] = "pass"
        selling = expect(a.post("/api/buying/mis-selling-check", json={"text": "保证100%赔付，不用如实告知，今天必须购买"})).json()
        assert {item["id"] for item in selling["flags"]} >= {"guaranteed_payout", "non_disclosure", "pressure"}
        checks["chinese_guarantee_disclosure_and_pressure_screen"] = "pass"

        gate = expect(a.post("/api/chat", json={"message": "What outpatient claim documents are needed?", "policy_id": pid, "locale": "en"})).json()
        assert gate["clarification"]["type"] == "confirm_policy"
        expect(a.patch(f"/api/policies/{pid}", json={"fields": {}, "confirmed": True}))
        reply = expect(a.post("/api/chat", json={"message": "门诊医疗理赔需要哪些材料和证明？", "policy_id": pid, "locale": "zh"})).json()
        assert reply["engine"] == "retrieval_only" and reply["citations"]
        for citation in reply["citations"]:
            document = expect(a.get(f"/api/documents/{citation['document_id']}")).json()
            source_page = next(page for page in document["pages"] if page["page"] == citation["page"])
            assert citation["quote"] in source_page["text"]
        checks["fact_gate_and_source_page_citations"] = "pass"

        case_id = None
        acknowledgement_id = None
        try:
            case = expect(a.post("/api/claims", json={"policy_id": pid, "incident": {
                "date": "2026-10-17", "country": "Japan", "city": "Tokyo",
                "description": "SYNTHETIC deployment smoke: fictional walking slip and outpatient visit. No real patient.",
                "treatment_type": "outpatient", "third_party_involved": True}})).json()
            case_id = case["id"]
            assert next(item for item in case["checklist"] if item["category"] == "incident_evidence")["conditional"] is True
            assert case["official_channel_url"].startswith("https://") and case["prescreen"]["notice"]
            checks["conditional_incident_evidence_and_official_channel"] = "pass"
            expect(b.get(f"/api/claims/{case_id}"), 404)
            form = expect(a.post(f"/api/claims/{case_id}/generate-form", json={})).json()
            assert form["document_id"]
            preview = expect(a.post(f"/api/claims/{case_id}/preview", json={"mode": "draft"})).json()
            export = expect(a.post(f"/api/claims/{case_id}/export", json={"token": preview["token"], "confirmed": True})).json()
            assert export["actual_status"] == "DRAFT" and export["submitted"] is False
            pdf = expect(a.get(export["pdf_url"])).content
            assert pdf.startswith(b"%PDF") and len(pdf) > 1000
            archive = ZipFile(BytesIO(expect(a.get(export["zip_url"])).content))
            manifest = json.loads(archive.read("02-manifest.json"))
            assert manifest["mode"] == "draft" and manifest["missing"]
            assert b"NOT SUBMITTED" in archive.read("README.txt")
            expect(b.get(export["pdf_url"]), 404)
            expect(a.post(f"/api/claims/{case_id}/export", json={"token": preview["token"], "confirmed": True}), 409)
            checks["real_synthetic_form_pdf_zip_single_use_token"] = "pass"
            fresh_case = expect(a.get(f"/api/claims/{case_id}")).json()
            saved = next(item for item in fresh_case["exports"] if item["id"] == export["export_id"])
            assert expect(a.get(saved["pdf_url"])).content == pdf
            checks["saved_export_retrievable_after_case_reload"] = "pass"
            acknowledgement_bytes = b"SYNTHETIC acknowledgement fixture. No insurer issued this document."
            acknowledgement = expect(a.post("/api/documents", data={"kind": "evidence", "claim_id": case_id}, files={"file": ("SYNTHETIC-acknowledgement.txt", acknowledgement_bytes, "text/plain")})).json()
            acknowledgement_id = acknowledgement.get("document", acknowledgement)["id"]
            update = expect(a.post(f"/api/claims/{case_id}/updates", json={"provenance": "acknowledgement_uploaded", "document_id": acknowledgement_id, "note": "SYNTHETIC tester-uploaded acknowledgement; no insurer verification."})).json()
            assert update["actual_status"] == "DRAFT"
            recorded = next(item for item in update["updates"] if item["document_id"] == acknowledgement_id)
            assert recorded["provenance"] == "acknowledgement_uploaded" and "not insurer verified" in recorded["label"]
            assert expect(a.get(f"/api/documents/{acknowledgement_id}/file")).content == acknowledgement_bytes
            expect(b.get(f"/api/documents/{acknowledgement_id}/file"), 404)
            checks["uploaded_acknowledgement_provenance_and_owned_original"] = "pass"
            simulation = expect(a.post(f"/api/claims/{case_id}/simulation", json={"stage": "RECEIVED"})).json()
            assert simulation["actual_status"] == "DRAFT"
            assert simulation["simulation"]["events"][0]["is_simulated"] is True
            checks["insurer_simulation_separate_from_actual_status"] = "pass"
        finally:
            if acknowledgement_id:
                expect(a.delete(f"/api/documents/{acknowledgement_id}"))
            if case_id:
                expect(a.delete(f"/api/claims/{case_id}?confirmed=true"))
            expect(a.post("/api/auth/logout", json={}))
            expect(b.post("/api/auth/logout", json={}))
            expect(a.get("/api/auth/me"), 401)
            checks["claim_cleanup_and_logout"] = "pass"

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
