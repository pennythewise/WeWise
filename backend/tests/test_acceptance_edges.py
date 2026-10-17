"""Regression checks found during the independent teammate-release audit."""
from datetime import date, datetime, timedelta, timezone

import pytest

from backend.app import documents, intelligence, workflows

pytestmark = pytest.mark.task


def add_policy(client, *, confirmed=False, start=None, end=None):
    today = date.fromisoformat(client.get("/api/portfolio").json()["date_basis"])
    content = (
        "SYNTHETIC TRAVEL POLICY FOR ACCEPTANCE TESTS\n"
        "Insurer: Fictional insurer\nPolicy number: SYNTHETIC-EDGE-TEST\n"
        "Insured name: Fictional customer\nDestination: Japan\n"
        f"Start date: {start or today.isoformat()}\n"
        f"End date: {end or (today + timedelta(days=20)).isoformat()}\n"
    )
    uploaded = client.post("/api/documents", data={"kind": "policy"}, files={"file": ("synthetic-edge.txt", content.encode(), "text/plain")})
    assert uploaded.status_code == 200, uploaded.text
    policy = uploaded.json()["policy"]
    if confirmed:
        reviewed = client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True})
        assert reviewed.status_code == 200, reviewed.text
        policy = reviewed.json()
    return policy


def test_unconfirmed_upload_does_not_hide_current_cover_gap(client):
    result = client.get("/api/portfolio").json()
    assert "travel" in result["coverage_by_family"]
    assert "travel" in {g["family"] for g in result["analysis"]["gaps"]}
    add_policy(client)
    result = client.get("/api/portfolio").json()
    assert "travel" in {g["family"] for g in result["analysis"]["gaps"]}
    assert result["analysis"]["overlaps"] == []


@pytest.mark.parametrize("period", ["expired", "future"])
def test_reviewed_out_of_period_policy_does_not_hide_current_cover_gap(client, period):
    today = date.fromisoformat(client.get("/api/portfolio").json()["date_basis"])
    start = today - timedelta(days=20) if period == "expired" else today + timedelta(days=2)
    end = today - timedelta(days=1) if period == "expired" else today + timedelta(days=20)
    added = add_policy(client, confirmed=True, start=start.isoformat(), end=end.isoformat())
    result = client.get("/api/portfolio").json()
    assert added["id"] in {p["id"] for p in result["policies"]}
    assert "travel" in {g["family"] for g in result["analysis"]["gaps"]}
    assert result["analysis"]["overlaps"] == []


def test_overlap_uses_reviewed_current_policies_and_keeps_unreviewed_cards(client):
    # The seeded policy remains unconfirmed. Only the two reviewed, currently
    # dated policies may participate in a possible-overlap finding.
    a, b = add_policy(client, confirmed=True), add_policy(client, confirmed=True)
    unreviewed = add_policy(client)
    result = client.get("/api/portfolio").json()
    assert unreviewed["id"] in {p["policy_id"] for p in result["coverage_by_family"]["travel"]}
    assert "travel" not in {g["family"] for g in result["analysis"]["gaps"]}
    overlap = next(item for item in result["analysis"]["overlaps"] if item["family"] == "travel")
    assert set(overlap["policy_ids"]) == {a["id"], b["id"]}
    assert overlap["status"] == "possible_overlap_needs_clause_review"


def test_portfolio_and_renewal_use_china_calendar_after_utc_midnight_boundary(client, monkeypatch):
    class ChinaMidnight(datetime):
        @classmethod
        def now(cls, tz=None):
            moment = cls(2026, 10, 18, 0, 30, tzinfo=timezone(timedelta(hours=8)))
            return moment.astimezone(tz) if tz else moment.replace(tzinfo=None)

    monkeypatch.setattr(documents, "datetime", ChinaMidnight)
    monkeypatch.setattr(workflows, "datetime", ChinaMidnight)
    portfolio = client.get("/api/portfolio").json()
    renewals = client.get("/api/renewals").json()
    assert portfolio["date_basis"] == renewals["date_basis"] == "2026-10-18"
    assert portfolio["timezone"] == renewals["timezone"] == "Asia/Shanghai"
    expiry = portfolio["policies"][0]["end_date"]
    assert portfolio["renewals"][0]["days_remaining"] == (date.fromisoformat(expiry) - date(2026, 10, 18)).days


@pytest.mark.parametrize("question", [
    "What documents do I need for an outpatient accident claim in Japan?",
    "门诊医疗理赔需要哪些材料和证明？",
    "I fell while walking in Japan. What claim evidence should I keep?",
])
def test_outpatient_evidence_query_returns_application_list_without_top_k_padding(client, question):
    policy = client.get("/api/policies").json()["policies"][0]
    assert client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True}).status_code == 200
    response = client.post("/api/chat", json={"message": question, "policy_id": policy["id"], "locale": "en"})
    assert response.status_code == 200, response.text
    answer = response.json()
    assert answer["engine"] == "retrieval_only"
    assert answer["citations"][0]["page"] == 12
    assert all(intelligence.is_medical_document_section(c["quote"].lower()) for c in answer["citations"])
    assert len(answer["answer"]) < 900
    for citation in answer["citations"]:
        source = client.get(f"/api/documents/{citation['document_id']}").json()
        page = next(p for p in source["pages"] if p["page"] == citation["page"])
        assert citation["quote"] in page["text"]
        excerpt, partial = intelligence.verbatim_window(citation["quote"], question)
        assert len(excerpt) <= 400 and excerpt in citation["quote"]
        assert excerpt in answer["answer"]
        if partial:
            assert "…" in answer["answer"]


def test_exclusion_question_is_not_reduced_to_medical_application_list(client):
    policy = client.get("/api/policies").json()["policies"][0]
    client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True})
    response = client.post("/api/chat", json={"message": "What outpatient medical exclusions could apply?", "policy_id": policy["id"], "locale": "en"})
    assert response.status_code == 200
    answer = response.json()
    assert answer["citations"]
    assert any(not intelligence.is_medical_document_section(c["quote"].lower()) for c in answer["citations"])
