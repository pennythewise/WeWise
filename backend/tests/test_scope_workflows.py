"""Acceptance for the previously missing tracking / decision-support scope."""
from datetime import date
import json

import pytest

from backend.app import core
from backend.tests.test_workflows import create_case, prepared_case, confirm_case, upload_evidence, confirmed_policy

pytestmark = pytest.mark.task


def post(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def simulator(client, case, stage="RECEIVED"):
    return post(client, f"/api/claims/{case['id']}/simulation", {"stage": stage})


def test_actual_tracker_and_notifications_survive_reload(client):
    case, _ = create_case(client)
    tracker = case["tracker"]["actual"]
    assert tracker["current_stage"] == "INCIDENT_REVIEWED"
    assert tracker["stages"][0]["state"] == "done"
    assert tracker["is_simulated"] is False and tracker["submitted"] is False
    notification = case["notifications"][0]
    assert notification["read_at"] is None and notification["is_simulated"] is False
    post(client, f"/api/claims/{case['id']}/notifications/{notification['id']}/ack", {})
    saved = client.get(f"/api/claims/{case['id']}").json()
    assert next(n for n in saved["notifications"] if n["id"] == notification["id"])["read_at"]
    assert len(saved["notifications"]) == len(case["notifications"])
    assert saved["tracker"]["actual"]["stages"][-1]["state"] == "upcoming"


def test_prepared_download_does_not_complete_official_handoff(client):
    case, _ = prepared_case(client)
    preview = post(client, f"/api/claims/{case['id']}/preview", {"mode": "prepared"})
    post(client, f"/api/claims/{case['id']}/export", {"token": preview["token"], "confirmed": True})
    fresh = client.get(f"/api/claims/{case['id']}").json()
    assert fresh["tracker"]["actual"]["current_stage"] == "OFFICIAL_HANDOFF"
    assert fresh["actual_status"] == "PREPARED_NOT_SUBMITTED"
    assert fresh["tracker"]["actual"]["submitted"] is False


def test_confirmed_simulated_submit_is_idempotent_and_isolated(client):
    case, _ = prepared_case(client)
    preview = post(client, f"/api/claims/{case['id']}/simulation/submit-preview", {})
    assert preview["preview"]["is_simulated"] and "nothing is sent" in preview["preview"]["action"]
    path = f"/api/claims/{case['id']}/simulation/submit"
    assert client.post(path, json={"token": preview["token"], "confirmed": False}).status_code == 409
    first = post(client, path, {"token": preview["token"], "confirmed": True})
    second = post(client, path, {"token": preview["token"], "confirmed": True})
    assert first["tracker"]["insurer_simulation"]["receipt_reference"] == second["tracker"]["insurer_simulation"]["receipt_reference"]
    assert len(second["simulation"]["events"]) == 1
    assert second["actual_status"] == "DRAFT"
    assert second["tracker"]["actual"]["submitted"] is False
    assert second["tracker"]["insurer_simulation"]["start_mode"] == "user_confirmed_demo"


@pytest.mark.attack
def test_simulation_confirmation_cannot_survive_evidence_change(client):
    case, _ = prepared_case(client)
    preview = post(client, f"/api/claims/{case['id']}/simulation/submit-preview", {})
    upload_evidence(client, case, "other")
    response = client.post(f"/api/claims/{case['id']}/simulation/submit", json={"token": preview["token"], "confirmed": True})
    assert response.status_code == 409


def test_incomplete_case_needs_review_for_confirmed_simulation(client):
    case, _ = create_case(client)
    assert client.post(f"/api/claims/{case['id']}/simulation/submit-preview", json={}).status_code == 409
    # Explicit preset story remains available, clearly labelled.
    fresh = simulator(client, case, "PAID")
    assert fresh["actual_status"] == "DRAFT"
    assert len(fresh["simulation"]["events"]) == 5
    assert all(e["label"] == "SIMULATED" for e in fresh["simulation"]["events"])


def test_invalid_simulator_transitions_and_clock_waiting_on_customer(client):
    case, _ = create_case(client)
    simulator(client, case)
    path = f"/api/claims/{case['id']}/simulation"
    assert client.post(path + "/transition", json={"stage": "PAID", "confirmed": True}).status_code == 409
    advanced = post(client, path + "/advance", {"days": 3})
    sim = advanced["tracker"]["insurer_simulation"]
    assert sim["current_stage"] == "INFO_REQUESTED"
    assert sim["clock_day"] == 3
    assert sim["allowed_next_stages"] == ["ASSESSMENT"]
    assert [e["clock_day"] for e in sim["events"]] == [0, 1, 3]
    later = post(client, path + "/advance", {"days": 30})
    assert later["tracker"]["insurer_simulation"]["current_stage"] == "INFO_REQUESTED"
    assert later["actual_status"] == "DRAFT"
    explanation = client.get(f"/api/claims/{case['id']}/explanation?mode=simulation").json()
    assert "itemised" in explanation["why"] and "You" in explanation["waiting_on"]


def test_decline_and_appeal_are_source_labelled_simulations(client):
    case, _ = create_case(client)
    simulator(client, case, "ASSESSMENT")
    fresh = post(client, f"/api/claims/{case['id']}/simulation/advance", {"days": 2, "outcome": "declined"})
    assert fresh["tracker"]["insurer_simulation"]["current_stage"] == "DECLINED"
    explanation = client.get(f"/api/claims/{case['id']}/explanation?mode=simulation").json()
    assert explanation["is_simulated"] and "SYNTHETIC" in explanation["letter"]["source_label"]
    assert explanation["clause"]["page"] == 12 and "医疗费用原始凭证" in explanation["clause"]["quote"]
    source = client.get(f"/api/documents/{explanation['clause']['document_id']}").json()
    assert explanation["clause"]["quote"] in next(p["text"] for p in source["pages"] if p["page"] == 12)
    assert "cannot overturn" in " ".join(explanation["appeal"]["steps"])
    appealed = post(client, f"/api/claims/{case['id']}/simulation/transition", {"stage": "APPEAL_REQUESTED", "confirmed": True})
    assert appealed["tracker"]["insurer_simulation"]["current_stage"] == "APPEAL_REQUESTED"
    assert appealed["actual_status"] == "DRAFT"
    actual = client.get(f"/api/claims/{case['id']}/explanation").json()
    assert actual["is_simulated"] is False and actual["letter"] is None


@pytest.mark.attack
def test_tracker_notifications_and_simulator_are_owner_scoped(client, stranger):
    case, _ = create_case(client)
    notification = case["notifications"][0]
    for path in (f"/api/claims/{case['id']}/notifications", f"/api/claims/{case['id']}/explanation"):
        assert stranger.get(path).status_code == 404
    for suffix, body in ((f"/notifications/{notification['id']}/ack", {}), ("/simulation/advance", {"days": 3}), ("/simulation", {"stage": "PAID"})):
        assert stranger.post(f"/api/claims/{case['id']}" + suffix, json=body).status_code == 404


def test_incident_library_has_nine_china_families_with_sourced_reference_docs(client):
    library = client.get("/api/incidents").json()
    assert len(library["families"]) == 9
    assert {i["family"] for i in library["items"]} == {f["id"] for f in library["families"]}
    assert all(i["source_url"].startswith("https://") and i["rule_status"] == "reference_only" for i in library["items"])
    assert all(i["purchase_documents"] and i["claim_documents"] for i in library["items"])
    medical = client.get("/api/incidents?family=medical&country=China").json()["items"]
    assert len(medical) == 1 and medical[0]["family"] == "medical"


def test_role_prior_settlement_and_benefit_change_document_requirements(client):
    case, _ = create_case(client, applicant_role="guardian", prior_reimbursement=True, disability=True)
    assert {"authority", "prior_settlement", "disability_report"} <= {i["category"] for i in case["checklist"]}
    flight = post(client, "/api/claims", {"policy_id": case["policy_id"], "benefit": "flight_delay", "incident": {"date": "2026-10-17", "description": "Synthetic delay", "country": "Japan"}})
    assert "carrier_report" in {i["category"] for i in flight["checklist"]}
    assert flight["prescreen"]["result"] == "insufficient_information"
    assert all(i["rule_status"] == "reference_only" for i in flight["checklist"])


def test_reviewed_evidence_mismatch_blocks_prepared_package(client):
    case, _ = prepared_case(client)
    doc = next(e for e in case["evidence"] if e["category"] == "medical_record")
    response = client.put(f"/api/claims/{case['id']}/evidence/{doc['document_id']}", json={"category": "medical_record", "confirmed": True, "fields": {"patient_name": "Different synthetic person", "admission_date": "2026-10-19", "discharge_date": "2026-10-18"}})
    assert response.status_code == 200
    view = response.json()
    assert {x["code"] for x in view["validation"]["inconsistencies"]} >= {"PATIENT_NAME_MISMATCH", "DISCHARGE_BEFORE_ADMISSION"}
    confirm_case(client, case)
    assert client.post(f"/api/claims/{case['id']}/preview", json={"mode": "prepared"}).status_code == 409


def test_code_cost_example_caps_insurer_payment_without_invented_catalog_values(client):
    result = post(client, "/api/buying/cost-estimate", {"bill_amount": 12000, "currency": "CNY", "terms": {"limit": 8000, "deductible": 1000, "coinsurance_percent": 20, "confirmed": True, "source_note": "Synthetic user-reviewed schedule example"}})
    assert result["known"] and result["insurer_pays"] == 8000 and result["you_pay"] == 4000
    assert result["is_claim_decision"] is False
    unknown = post(client, "/api/buying/cost-estimate", {"bill_amount": 12000, "terms": {"confirmed": True, "source_note": "No selected terms supplied"}})
    assert not unknown["known"] and unknown["insurer_pays"] is None and unknown["you_pay"] is None


@pytest.mark.parametrize("field,value", [("limit", -1), ("deductible", -1), ("coinsurance_percent", 101), ("limit", "NaN")])
def test_cost_inputs_reject_invalid_arithmetic(client, field, value):
    terms = {"limit": 10000, "deductible": 0, "coinsurance_percent": 0, "confirmed": True, "source_note": "Synthetic schedule", field: value}
    assert client.post("/api/buying/cost-estimate", json={"bill_amount": 1000, "terms": terms}).status_code == 422


def test_comparison_has_balanced_arguments_unknown_terms_and_ties(client):
    result = post(client, "/api/buying/compare", {"needs": {"goal": "Overseas treatment", "dependants": 2, "risk_tolerance": "low", "age": 30, "budget": 500, "city": "Shanghai"}})
    assert len(result["advocates"]) == 3
    assert all(a["case_for"] and a["cautions"] and a["when_it_wins"] for a in result["advocates"])
    assert result["judge"]["engine"] == "deterministic_rules" and result["judge"]["no_unique_winner"]
    assert len(result["judge"]["tied_product_ids"]) == 3
    assert len(result["comparison_rows"]) >= 8
    assert all(p["premium"] is None for p in result["products"])
    assert client.get("/api/buying/needs").json()["needs"]["dependants"] == 2


def test_optional_scenario_uses_only_named_user_reviewed_product_terms(client):
    result = post(client, "/api/buying/compare", {"needs": {}, "scenario": {"bill_amount": 8000, "currency": "CNY", "terms": [{"product_id": "allianz_changyou_2023", "limit": 10000, "deductible": 1000, "coinsurance_percent": 10, "source_note": "Synthetic selected terms", "confirmed": True}]}})
    assert result["cost_examples"][0]["insurer_pays"] == 6300
    assert result["cost_examples"][0]["you_pay"] == 1700
    assert result["judge"]["price_used"] is False


@pytest.mark.attack
def test_saved_needs_and_premium_history_are_private(client, stranger):
    policy = confirmed_policy(client)
    post(client, "/api/buying/compare", {"needs": {"goal": "Synthetic private need"}})
    assert stranger.get("/api/buying/needs").json()["needs"] is None
    assert stranger.get(f"/api/policies/{policy['id']}/premium-history").status_code == 404
    assert stranger.post(f"/api/policies/{policy['id']}/premium-history", json={"year": 2026, "premium": 1000, "source_note": "test", "confirmed": True}).status_code == 404


def test_demo_agent_matching_explains_language_location_and_limits(client):
    result = client.get("/api/buying/agents?language=en&city=Shanghai").json()
    assert result["is_simulated"] and result["agents"][0]["id"] == "demo_agent_zh_sh"
    assert all(agent["why_chosen"] and agent["is_simulated"] for agent in result["agents"])
    assert client.post("/api/buying/brief/preview", json={"needs": {}, "agent_id": "not-a-real-agent"}).status_code == 422
    preview = post(client, "/api/buying/brief/preview", {"needs": {}, "agent_id": "demo_agent_zh_sh"})
    assert preview["payload"]["matched_demo_agent"]["id"] == "demo_agent_zh_sh"
    assert preview["payload"]["no_external_delivery"]


def test_premium_history_hikes_and_renewal_are_user_reviewed(client):
    policy = confirmed_policy(client)
    path = f"/api/policies/{policy['id']}/premium-history"
    for year, premium in [(2025, 1000), (2026, 1250)]:
        result = post(client, path, {"year": year, "premium": premium, "currency": "CNY", "source_note": "Synthetic annual premium notice", "confirmed": True})
    assert result["hikes"][0]["change_percent"] == 25
    assert all(e["provenance"] == "user_reviewed" for e in result["entries"])
    # Re-saving the same source year corrects it, rather than adding a duplicate.
    corrected = post(client, path, {"year": 2026, "premium": 1100, "source_note": "Corrected synthetic notice", "confirmed": True})
    assert len(corrected["entries"]) == 2 and corrected["hikes"][0]["change_percent"] == 10
    reminder = next(r for r in client.get("/api/renewals").json()["reminders"] if r["id"] == policy["id"])
    assert reminder["hike_warning"] and reminder["renewed"] is False
    comparison = post(client, "/api/buying/renewal-compare", {"policy_id": policy["id"], "proposed_product_id": "picc_overseas_2022"})
    assert comparison["no_extension"] and comparison["questions"]


def test_surrender_loss_calculator_is_explicit_about_user_facts_and_rights(client):
    result = post(client, "/api/buying/surrender-check", {"premiums_paid": 20000, "cash_value": 12000, "new_premium": 3000, "current_premium": 2500, "lost_benefits": ["Synthetic existing guarantee"], "source_note": "Synthetic cash-value statement", "confirmed": True})
    assert result["capital_loss"] == 8000 and result["loss_percent"] == 40
    assert result["annual_premium_change"] == 500
    assert "No universal number" in result["cooling_off_notice"]
    assert result["action_executed"] is False


def test_deleting_case_removes_tracker_private_rows(client):
    case, _ = create_case(client)
    simulator(client, case, "DECLINED")
    assert client.delete(f"/api/claims/{case['id']}?confirmed=true").status_code == 200
    with core.get_db() as db:
        for table in ("claim_notifications", "claim_simulator_state", "claim_simulation_details", "claim_simulations"):
            assert db.execute(f"SELECT COUNT(*) FROM {table} WHERE claim_id=?", (case["id"],)).fetchone()[0] == 0


@pytest.mark.attack
def test_wording_and_confirmed_identity_do_not_replace_selected_schedule_benefit(client):
    case, policy = create_case(client)
    assert next(c for c in case["prescreen"]["checks"] if c["id"] == "selected_benefit")["status"] == "pass"
    # User review cannot turn a bare product identity into purchased benefits.
    changed = client.patch(f"/api/policies/{policy['id']}", json={"fields": {"benefits": []}, "confirmed": True})
    assert changed.status_code == 200
    fresh = client.get(f"/api/claims/{case['id']}").json()
    assert next(c for c in fresh["prescreen"]["checks"] if c["id"] == "selected_benefit")["status"] == "unresolved"
    assert next(c for c in fresh["prescreen"]["checks"] if c["id"] == "reviewed_rule")["status"] == "unresolved"
    assert fresh["prescreen"]["result"] == "insufficient_information"


def reviewed_waiting_case(client, value="90", source_number="90"):
    policy = confirmed_policy(client)
    text = f"SYNTHETIC endorsement for arithmetic only\nWaiting period: {source_number} days\nExclusion: synthetic hazardous activity\n"
    result = client.post("/api/documents", data={"kind": "policy", "policy_id": policy["id"]}, files={"file": ("SYNTHETIC-endorsement.txt", text.encode(), "text/plain")})
    assert result.status_code == 200, result.text
    document_id = result.json()["document"]["id"]
    policy = client.get(f"/api/policies/{policy['id']}").json()
    # Use the public exact-page term-review contract, not private fixture values.
    result = client.patch(f"/api/policies/{policy['id']}/terms", json={"expected_revision": policy["revision"], "confirmed": True, "terms": [
        {"field": "waiting_period_days", "type": "waiting", "value": value, "source": {"document_id": document_id, "page": 1, "quote": f"Waiting period: {source_number} days"}},
        {"field": "exclusions", "type": "exclusion", "value": "Exclusion: synthetic hazardous activity", "source": {"document_id": document_id, "page": 1, "quote": "Exclusion: synthetic hazardous activity"}},
    ]})
    assert result.status_code == 200, result.text
    assert client.patch(f"/api/policies/{policy['id']}", json={"fields": {}, "confirmed": True}).status_code == 200
    return post(client, "/api/claims", {"policy_id": policy["id"], "incident": {"date": "2026-10-17", "country": "Japan", "description": "SYNTHETIC fall"}})


@pytest.mark.parametrize("value", ["90", "90 days"])
def test_prescreen_waiting_dates_and_exclusions_use_exact_reviewed_source(client, value):
    case = reviewed_waiting_case(client, value=value)
    waiting = case["prescreen"]["waiting_period"]
    assert waiting["known"] and waiting["days"] == 90
    assert waiting["eligible_from"] == "2027-01-13" and waiting["satisfied"] is False
    assert case["prescreen"]["result"] == "possible_exclusion"
    assert case["prescreen"]["exclusions"][0]["text"] == "Exclusion: synthetic hazardous activity"
    assert case["prescreen"]["is_approval"] is False


@pytest.mark.attack
def test_reviewed_number_does_not_match_substring_in_source(client):
    case = reviewed_waiting_case(client, value="90", source_number="190")
    assert case["prescreen"]["waiting_period"]["known"] is False


@pytest.mark.parametrize("benefit_format", ["objects", "legacy_ui_strings"])
def test_actual_private_demo_bootstrap_and_browser_policy_confirmation_reach_reviewed_path(client, benefit_format):
    assert client.post("/api/auth/demo", json={}).status_code == 200
    policy = client.get("/api/policies").json()["policies"][0]
    fields = {key: policy.get(key, "") for key in ("title", "insurer", "policy_number", "insured_name", "start_date", "end_date", "family")}
    fields["destination"] = policy["fields"].get("destination", "")
    fields["benefits"] = policy["fields"]["benefits"] if benefit_format == "objects" else [item["name"] for item in policy["fields"]["benefits"]]
    response = client.patch(f"/api/policies/{policy['id']}", json={"fields": fields, "confirmed": True})
    assert response.status_code == 200, response.text
    case = post(client, "/api/claims", {"policy_id": policy["id"], "incident": {"date": "2026-10-17", "country": "Japan", "city": "Tokyo", "description": "SYNTHETIC walking fall", "treatment_type": "outpatient"}})
    checks = {item["id"]: item for item in case["prescreen"]["checks"]}
    assert checks["selected_benefit"]["status"] == "pass"
    assert checks["reviewed_rule"]["status"] == "pass"


def test_typed_unprinted_benefit_cannot_qualify_as_schedule_evidence(client):
    case, policy = create_case(client)
    response = client.patch(f"/api/policies/{policy['id']}", json={"fields": {"benefits": ["Selected benefit: Accidental outpatient unlimited 999999999 payout"]}, "confirmed": True})
    assert response.status_code == 200
    fresh = client.get(f"/api/claims/{case['id']}").json()
    assert next(c for c in fresh["prescreen"]["checks"] if c["id"] == "selected_benefit")["status"] == "unresolved"
