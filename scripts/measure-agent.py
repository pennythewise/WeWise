"""Measure a small real local NDJSON agent run, using disposable synthetic data.

This is an acceptance measurement, not a statistical SLA, a live model/token
benchmark, or insurer execution. Review tokens, cookies and report originals are
never written into the measurement report.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import statistics
import time

import httpx


def percentile(values, percent):
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * percent / 100
    lo, hi = int(position), min(int(position) + 1, len(ordered) - 1)
    return round(ordered[lo] + (ordered[hi] - ordered[lo]) * (position - lo), 2)


def request(client, method, path, **kwargs):
    response = client.request(method, "/api" + path, **kwargs)
    if not response.is_success:
        raise RuntimeError(f"{method} {path}: HTTP {response.status_code}")
    return response.json()


def valid_plan(result, catalogue):
    plan = result.get("plan", {})
    completed, errors = set(), []
    steps = plan.get("steps", [])
    if plan.get("source") != "deterministic_validated" or len(steps) > 8:
        errors.append("invalid_plan_source_or_budget")
    for step in steps:
        spec = catalogue.get(step.get("tool"))
        if not spec:
            errors.append("unregistered_tool")
            continue
        if plan.get("goal") not in spec["goals"]:
            errors.append("tool_goal_not_allowed")
        if step.get("id") in completed or not set(step.get("depends_on", [])).issubset(completed):
            errors.append("invalid_step_dependencies")
        for name in spec.get("required_arguments", []):
            if step.get("args", {}).get(name) in (None, ""):
                errors.append("missing_required_argument:" + name)
        if set(step.get("args", {})) & {"user_id", "role", "admin", "api_key", "confirmation_token"}:
            errors.append("forbidden_argument")
        completed.add(step.get("id"))
    return {"valid": not errors, "step_count": len(steps), "tools": [s["tool"] for s in steps], "errors": errors}


def check_sources(client, result, cache):
    checks = []
    for citation in result.get("citations", []):
        document_id, page, quote = citation.get("document_id"), citation.get("page"), citation.get("quote")
        if not document_id or not isinstance(page, int) or not isinstance(quote, str):
            checks.append({"match": False, "reason": "citation_missing_document_page_quote"})
            continue
        if document_id not in cache:
            cache[document_id] = request(client, "GET", f"/documents/{document_id}")
        original = next((p["text"] for p in cache[document_id].get("pages", []) if p["page"] == page), None)
        checks.append({"match": bool(original is not None and quote in original), "page": page,
                       "quote_length": len(quote), "source_ref": hashlib.sha256(document_id.encode()).hexdigest()[:10]})
    return checks


def measure(client, case, payload, catalogue, source_cache):
    started = time.perf_counter()
    first, final, result, event_count = None, None, None, 0
    boundaries = []
    with client.stream("POST", "/api/chat/stream", json=payload) as response:
        if response.status_code != 200:
            raise RuntimeError(f"Stream {case['id']}: HTTP {response.status_code}")
        if not response.headers.get("content-type", "").startswith("application/x-ndjson"):
            raise RuntimeError("The measured endpoint did not return NDJSON.")
        for line in response.iter_lines():
            if not line.strip():
                continue
            stamp = round((time.perf_counter() - started) * 1000, 2)
            item = json.loads(line)
            if first is None:
                first = stamp
            if item.get("type") == "event":
                event_count += 1
                event = item.get("event", {})
                boundaries.append({key: event[key] for key in ("stage", "status", "tool", "step_id", "latency_ms") if key in event} | {"received_ms": stamp})
            elif item.get("type") == "result":
                final, result = stamp, item
    if result is None:
        raise RuntimeError(f"Stream {case['id']} ended without a final result.")
    plan = valid_plan(result, catalogue)
    sources = check_sources(client, result, source_cache)
    actual_goal = result.get("plan", {}).get("goal")
    goal_match = actual_goal == case["goal"]
    special = True
    if case.get("expect") == "clarification":
        special = result.get("clarification", {}).get("type") == "select_policy" and len(result.get("clarification", {}).get("options", [])) >= 2
    elif case.get("expect") == "resume":
        special = any(e.get("stage") == "understand" and isinstance(e.get("detail"), dict) and e["detail"].get("resumed") for e in result.get("trace", []))
    elif case.get("expect") == "correction":
        special = any(e.get("stage") == "replan" and e.get("status") == "ok" for e in result.get("trace", [])) and result.get("state", {}).get("policy_id") == payload.get("policy_id")
    elif case.get("expect") == "no_tools":
        special = not result.get("plan", {}).get("steps")
    failed_tools = [e for e in result.get("trace", []) if e.get("tool") and e.get("status") in {"failed", "blocked"}]
    passed = goal_match and plan["valid"] and all(c["match"] for c in sources) and bool(result.get("answer")) and special and not failed_tools
    return {"id": case["id"], "message": case["message"], "requested_goal": case["goal"], "actual_goal": actual_goal,
            "goal_match": goal_match, "first_event_ms": first, "time_to_final_ms": final, "event_count": event_count,
            "plan": plan, "citation_checks": sources, "citation_count": len(sources), "special_acceptance_pass": special,
            "tool_failure_count": len(failed_tools), "boundaries": boundaries, "pass": passed}, result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8017")
    parser.add_argument("--output", type=Path, default=Path("docs/qa/agent-measurements-local.json"))
    args = parser.parse_args()
    from urllib.parse import urlparse
    if urlparse(args.base_url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("This bounded measurement is deliberately local-only.")
    report = {"measured_at": datetime.now(timezone.utc).isoformat(), "environment": "local real HTTP / NDJSON", "synthetic_only": True,
              "limits": ["Twelve selected acceptance turns, not a random sample or statistical SLA.", "First streamed event is not a generated first token.", "No external model or insurer call is made. Token usage and model cost are unmeasured, not estimated as free."], "cases": []}
    conversations, policies, claims, errors = set(), [], [], []
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=120, follow_redirects=False) as client:
        try:
            health = request(client, "GET", "/health")
            if not health.get("ai", {}).get("retrieval_only_enforced") or health.get("ai", {}).get("configured") or health.get("jev", {}).get("configured"):
                raise RuntimeError("Measurement requires enforced retrieval-only mode with external models/JEV disabled.")
            report["runtime"] = {"version": health.get("version"), "retrieval_engine": health.get("retrieval", {}).get("engine"), "external_generation_enforced_disabled": True, "jev_enforced_disabled": True}
            demo = request(client, "POST", "/auth/demo", json={})
            if demo.get("synthetic") is not True or demo.get("shared_account") is not False:
                raise RuntimeError("Disposable private demo creation was not confirmed.")
            primary = request(client, "GET", "/policies")["policies"][0]
            policies.append(primary["id"])
            request(client, "PATCH", f"/policies/{primary['id']}", json={"fields": {}, "confirmed": True})
            text = "SYNTHETIC MEASUREMENT POLICY - NOT ISSUED\nInsurer: Synthetic insurer\nProduct: Synthetic second China travel policy\nPolicy number: SYNTHETIC-MEASURE-SECOND\nInsured name: Synthetic test person\nStart date: 2026-10-15\nEnd date: 2026-10-25\nDestination: Japan\nSelected benefit: Accidental outpatient expenses - synthetic only\n"
            uploaded = request(client, "POST", "/documents", data={"kind": "policy"}, files={"file": ("SYNTHETIC-measure-second.txt", text.encode(), "text/plain")})
            secondary = uploaded["policy"]
            policies.append(secondary["id"])
            request(client, "PATCH", f"/policies/{secondary['id']}", json={"fields": {}, "confirmed": True})
            case = request(client, "POST", "/claims", json={"policy_id": primary["id"], "incident": {"date": "2026-10-17", "country": "Japan", "city": "Tokyo", "description": "SYNTHETIC measurement walking fall, no real patient.", "treatment_type": "outpatient"}})
            claims.append(case["id"])
            catalogue = {x["name"]: x for x in request(client, "GET", "/tools")["tools"]}
            report["registered_tool_count"] = len(catalogue)
            cases = [
                {"id": "clarify_policy", "message": "What outpatient evidence does my policy require?", "goal": "policy_question", "expect": "clarification", "group": "policy"},
                {"id": "resume_original_question", "message": "Use my first travel policy.", "goal": "policy_question", "expect": "resume", "group": "policy", "policy_id": primary["id"]},
                {"id": "correct_to_other_policy", "message": "Correction, use the other policy. What outpatient evidence is needed?", "goal": "policy_question", "expect": "correction", "group": "policy", "policy_id": secondary["id"]},
                {"id": "correct_back_original", "message": "Correction, use my original travel policy. What exclusions matter?", "goal": "policy_question", "expect": "correction", "group": "policy", "policy_id": primary["id"]},
                {"id": "source_coverage_observations", "message": "Show my coverage gaps and overlaps.", "goal": "coverage_analysis"},
                {"id": "capture_buying_needs", "message": "Compare insurance for a trip to Japan; my budget is CNY 500 and I have one dependant.", "goal": "buying"},
                {"id": "prepare_reviewable_draft", "message": "Prepare my claim package for review.", "goal": "claim_preview", "claim_id": case["id"]},
                {"id": "actual_claim_tracking", "message": "What is my claim status?", "goal": "claim_status", "claim_id": case["id"]},
                {"id": "explain_actual_delay", "message": "Explain the delay in this claim.", "goal": "claim_explanation", "claim_id": case["id"]},
                {"id": "incident_guidance", "message": "Show the incident guide for a China travel policy.", "goal": "incidents"},
                {"id": "urgent_human_contacts", "message": "I need urgent emergency contacts in Japan.", "goal": "emergency"},
                {"id": "out_of_scope_refusal", "message": "Buy Bitcoin for me.", "goal": "outside_scope", "expect": "no_tools"},
            ]
            group_state, source_cache = {}, {}
            for item in cases:
                payload = {"message": item["message"], "locale": "en"}
                for key in ("policy_id", "claim_id"):
                    if item.get(key):
                        payload[key] = item[key]
                if item.get("group") in group_state:
                    old = group_state[item["group"]]
                    payload.update(conversation_id=old["id"], expected_revision=old["revision"])
                measured, result = measure(client, item, payload, catalogue, source_cache)
                conversations.add(result["conversation_id"])
                if item.get("group"):
                    group_state[item["group"]] = {"id": result["conversation_id"], "revision": result["conversation_revision"]}
                report["cases"].append(measured)
            firsts = [x["first_event_ms"] for x in report["cases"]]
            finals = [x["time_to_final_ms"] for x in report["cases"]]
            citations = [c for x in report["cases"] for c in x["citation_checks"]]
            total_steps = sum(x["plan"]["step_count"] for x in report["cases"])
            report["summary"] = {"turns": len(cases), "acceptance_passed": sum(x["pass"] for x in report["cases"]), "goals_matched": sum(x["goal_match"] for x in report["cases"]),
                                 "plans_valid": sum(x["plan"]["valid"] for x in report["cases"]), "planned_tool_calls": total_steps,
                                 "source_quotes_checked": len(citations), "source_quotes_matched": sum(c["match"] for c in citations),
                                 "first_event_ms": {"p50": round(statistics.median(firsts), 2), "p95": percentile(firsts, 95)},
                                 "time_to_final_ms": {"p50": round(statistics.median(finals), 2), "p95": percentile(finals, 95)},
                                 "external_generation_calls": 0, "model_tokens": None, "model_cost": None,
                                 "generation_evidence": "Runtime forces external generation/JEV disabled; this script invokes only local app endpoints."}
        except Exception as exc:
            errors.append(type(exc).__name__ + ": " + str(exc))
        finally:
            cleanup = {"conversations_deleted": 0, "claims_deleted": 0, "policies_deleted": 0, "signed_out": False}
            for cid in conversations:
                if client.delete("/api/conversations/" + cid).is_success:
                    cleanup["conversations_deleted"] += 1
            for claim_id in claims:
                if client.delete(f"/api/claims/{claim_id}?confirmed=true").is_success:
                    cleanup["claims_deleted"] += 1
            for pid in policies:
                if client.delete("/api/policies/" + pid).is_success:
                    cleanup["policies_deleted"] += 1
            cleanup["signed_out"] = client.post("/api/auth/logout", json={}).is_success
            report["cleanup"] = cleanup
    report["errors"] = errors
    report["pass"] = not errors and len(report["cases"]) == 12 and all(x["pass"] for x in report["cases"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"pass": report["pass"], "summary": report.get("summary"), "errors": errors, "report": str(args.output)}, ensure_ascii=False))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
