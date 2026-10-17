"""Bounded deterministic plans, centralized tool gates and actual streamed traces.

This is a real execution coordinator, not a claim of LLM reasoning. Plans have a
fixed allowlist; neither documents nor generated text may introduce new tools.
External insurer delivery and money operations do not exist in this registry.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import re
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from . import core
from .workflows import CostEstimate, CompareRequest

router = APIRouter(prefix="/api", tags=["bounded plans and conversations"])
TOOLS = {
    "policy_get": {"tier": "T1", "goals": {"policy_question", "coverage_analysis", "claim_status", "claim_preview"}, "role": "orchestrator"},
    "policy_search_clauses": {"tier": "T1", "goals": {"policy_question"}, "role": "orchestrator"},
    "policy_explain": {"tier": "T1", "goals": {"policy_question"}, "role": "orchestrator"},
    "coverage_analyze": {"tier": "T1", "goals": {"coverage_analysis"}, "role": "orchestrator"},
    "claim_status_get": {"tier": "T1", "goals": {"claim_status", "claim_preview"}, "role": "orchestrator"},
    "claim_export_preview": {"tier": "T2", "goals": {"claim_preview"}, "role": "orchestrator"},
    "needs_defaults": {"tier": "T1", "goals": {"buying"}, "role": "orchestrator"},
    "needs_capture": {"tier": "T1", "goals": {"buying"}, "role": "orchestrator"},
    "emergency_contacts": {"tier": "T0", "goals": {"emergency"}, "role": "orchestrator"},
}
for _name, _goal in {
    "policy_list": "portfolio", "portfolio_summary": "portfolio", "policy_terms_get": "policy_terms", "policy_clauses_get": "policy_terms", "policy_summary": "policy_summary",
    "document_get": "document_question", "report_analysis": "report_analysis", "reports_list": "report_analysis", "vault_list": "vault", "memory_read": "memory", "audit_read": "audit",
    "renewal_alerts_list": "renewal", "premium_history_get": "premium_history", "claim_list": "claim_status", "claim_prescreen": "claim_checklist", "claim_checklist": "claim_checklist",
    "claim_notifications": "claim_status", "claim_explanation": "claim_explanation", "crossborder_kit": "crossborder", "incident_types_list": "incidents", "product_catalog": "buying",
    "agent_directory": "buying", "sales_pattern_check": "sales_check", "cost_estimator": "cost_estimate", "product_compare": "buying",
}.items():
    TOOLS[_name] = {"tier": "T0" if _name in {"incident_types_list", "product_catalog", "agent_directory", "sales_pattern_check"} else "T2" if _name == "product_compare" else "T1", "goals": {_goal}, "role": "orchestrator"}
REQUIRED_ARGS = {
    **{name: {"policy_id"} for name in ("policy_get", "policy_search_clauses", "policy_explain", "policy_terms_get", "policy_clauses_get", "policy_summary", "premium_history_get")},
    **{name: {"claim_id"} for name in ("claim_status_get", "claim_export_preview", "claim_prescreen", "claim_checklist", "claim_notifications", "claim_explanation", "crossborder_kit")},
    "document_get": {"document_id"}, "report_analysis": {"document_id"}, "cost_estimator": {"cost"}, "product_compare": {"comparison"},
    "sales_pattern_check": {"query"},
}


def init_db():
    with core.get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,state_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_turns(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,user_id TEXT NOT NULL,message TEXT NOT NULL,plan_json TEXT NOT NULL,events_json TEXT NOT NULL,result_json TEXT,status TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT);
        CREATE INDEX IF NOT EXISTS agent_turn_owner ON agent_turns(user_id,conversation_id,started_at);
        """)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ToolArgs(Strict):
    policy_id: str | None = Field(default=None, max_length=100)
    claim_id: str | None = Field(default=None, max_length=100)
    query: str = Field(default="", max_length=4000)
    locale: Literal["zh", "en", "ja"] = "zh"
    document_id: str | None = Field(default=None, max_length=100)
    family: str = Field(default="", max_length=40)
    country: str = Field(default="Japan", max_length=80)
    cost: CostEstimate | None = None
    comparison: CompareRequest | None = None


class Step(Strict):
    id: str = Field(min_length=1, max_length=40)
    tool: str = Field(min_length=1, max_length=80)
    args: ToolArgs
    depends_on: list[str] = Field(default_factory=list, max_length=8)
    purpose: str = Field(min_length=1, max_length=300)


class Plan(Strict):
    goal: str
    source: Literal["deterministic_validated"] = "deterministic_validated"
    steps: list[Step] = Field(max_length=8)
    missing_slots: list[str] = Field(default_factory=list)
    confirmations_required: list[str] = Field(default_factory=list)
    user_visible_summary: str


def owned_conversation(db, identifier, user_id):
    row = db.execute("SELECT * FROM conversations WHERE id=? AND user_id=?", (identifier, user_id)).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found.")
    return row


def safe_args(args):
    return {"policy_id": args.policy_id, "claim_id": args.claim_id, "document_id": args.document_id, "locale": args.locale, "query": "[private user question]" if args.query else "", "reviewed_cost_inputs": bool(args.cost), "reviewed_comparison_inputs": bool(args.comparison)}


def pep_validate(db, user, plan: Plan, step: Step, completed: set[str], role="orchestrator"):
    """The single gate used by all coordinator tool adapters."""
    spec = TOOLS.get(step.tool)
    if not spec or spec["role"] != role:
        raise HTTPException(403, "DENY:TOOL_ROLE")
    bound = next((s for s in plan.steps if s.id == step.id), None)
    if not bound or bound != step or plan.goal not in spec["goals"]:
        raise HTTPException(403, "DENY:UNBOUND_INTENT")
    if not set(step.depends_on).issubset(completed):
        raise HTTPException(409, "DENY:DEPENDENCIES")
    if len(plan.steps) > 8 or len({s.id for s in plan.steps}) != len(plan.steps):
        raise HTTPException(422, "DENY:PLAN_BUDGET")
    for field in REQUIRED_ARGS.get(step.tool, set()):
        if getattr(step.args, field) is None or getattr(step.args, field) == "":
            raise HTTPException(422, f"DENY:MISSING_ARGUMENT:{field}")
    for table, identifier in (("policies", step.args.policy_id), ("claims", step.args.claim_id), ("documents", step.args.document_id)):
        if identifier and not db.execute(f"SELECT 1 FROM {table} WHERE id=? AND user_id=?", (identifier, user["id"])).fetchone():
            raise HTTPException(404, "Resource not found.")
    if spec["tier"] == "T2" and (step.tool, plan.goal) not in {("claim_export_preview", "claim_preview"), ("product_compare", "buying")}:
        raise HTTPException(403, "DENY:UNBOUND_WRITE")
    return spec


def make_plan(goal, policy_id, claim_id, message, locale):
    args = ToolArgs(policy_id=policy_id, claim_id=claim_id, query=message, locale=locale)
    names = {
        "policy_question": ["policy_get", "policy_search_clauses", "policy_explain"] if policy_id else [],
        "coverage_analysis": ["coverage_analyze"],
        "claim_status": ["claim_status_get"] if claim_id else [],
        "claim_preview": ["claim_status_get", "claim_export_preview"] if claim_id else [],
        "buying": ["needs_defaults", "needs_capture"],
        "emergency": ["emergency_contacts"],
        "outside_scope": [],
        "portfolio": ["policy_list", "portfolio_summary"],
        "policy_terms": ["policy_terms_get", "policy_clauses_get"] if policy_id else [],
        "policy_summary": ["policy_summary"] if policy_id else [],
        "memory": ["memory_read"], "vault": ["vault_list"], "audit": ["audit_read"], "renewal": ["renewal_alerts_list"],
        "premium_history": ["premium_history_get"] if policy_id else [],
        "incidents": ["incident_types_list"], "sales_check": ["sales_pattern_check"], "report_analysis": ["reports_list"],
        "crossborder": ["crossborder_kit"] if claim_id else [],
        "claim_checklist": ["claim_prescreen", "claim_checklist"] if claim_id else [],
        "claim_explanation": ["claim_explanation"] if claim_id else [],
    }.get(goal, [])
    missing = ["policy_id"] if goal in {"policy_question", "policy_terms", "policy_summary", "premium_history"} and not policy_id else ["claim_id"] if goal in {"claim_status", "claim_preview", "crossborder", "claim_checklist", "claim_explanation"} and not claim_id else []
    steps = [Step(id=f"s{i+1}", tool=name, args=args, depends_on=[f"s{i}"] if i else [], purpose=goal) for i, name in enumerate(names)]
    return Plan(goal=goal, steps=steps, missing_slots=missing, confirmations_required=["exact_export_snapshot"] if goal == "claim_preview" else [], user_visible_summary=f"{goal}: " + ("ask for " + ", ".join(missing) if missing else " → ".join(names) or "respond without data tools"))


def detect_goal(message, base_route):
    if base_route in {"outside_scope", "emergency"}:
        return base_route
    for pattern, goal in ((r"销售说法|销售承诺|sales (?:claim|wording)|mis.?selling", "sales_check"),
                          (r"跨境资料|cross.?border kit", "crossborder"), (r"理赔清单|claim checklist|pre.?screen", "claim_checklist"),
                          (r"解释.*(?:拒赔|延迟)|explain.*(?:delay|decline|status)", "claim_explanation"),
                          (r"保费历史|premium history", "premium_history"), (r"续保提醒|renewal (?:alert|reminder)", "renewal"),
                          (r"我.*记忆|what.*remember|my memor", "memory"), (r"资料库|文件库|my vault|document vault", "vault"),
                          (r"操作记录|访问记录|audit|access history", "audit"), (r"医疗报告|财务报告|medical report|financial report", "report_analysis"),
                          (r"保单摘要|policy summary|translate.*policy|翻译.*保单", "policy_summary"), (r"等待期|免赔|waiting period|deductible|条款列表|search clauses", "policy_terms"),
                          (r"我的全部保单|我的保险组合|my portfolio|all my policies", "portfolio"), (r"事故指引|incident guide|incident types", "incidents")):
        if re.search(pattern, message, re.I):
            return goal
    if base_route == "buying":
        return base_route
    if re.search(r"保障缺口|重复保障|重叠|gap|overlap|coverage matrix", message, re.I):
        return "coverage_analysis"
    if re.search(r"理赔包|导出理赔|准备.*理赔|提交.*理赔|claim package|prepare.*claim|export.*claim|submit.*claim", message, re.I):
        return "claim_preview"
    if re.search(r"理赔进度|理赔状态|claim status|track.*claim|tracker", message, re.I):
        return "claim_status"
    return "policy_question"


async def invoke_tool(step, plan, completed, user):
    from . import intelligence, documents, workflows, memory, document_analysis, lifecycle
    with core.get_db() as db:
        pep_validate(db, user, plan, step, completed)
    args = step.args
    if step.tool == "policy_get":
        return await asyncio.to_thread(documents.get_policy, args.policy_id, user)
    if step.tool == "policy_search_clauses":
        def search():
            with core.get_db() as db:
                citations, engine = intelligence.retrieve(db, user["id"], args.policy_id, args.query)
            return {"citations": citations, "engine": engine}
        return await asyncio.to_thread(search)
    if step.tool == "policy_explain":
        return await intelligence._chat_answer(intelligence.ChatRequest(message=args.query, policy_id=args.policy_id, locale=args.locale), user)
    if step.tool == "coverage_analyze":
        with core.get_db() as db:
            return document_analysis.coverage_matrix(db, user["id"])
    if step.tool == "claim_status_get":
        return await asyncio.to_thread(workflows.get_claim, args.claim_id, user)
    if step.tool == "claim_export_preview":
        return await asyncio.to_thread(workflows.preview_claim, args.claim_id, workflows.PreviewRequest(mode="draft"), user)
    if step.tool == "needs_defaults":
        return await asyncio.to_thread(memory.needs_defaults, user["id"])
    if step.tool == "needs_capture":
        defaults = await asyncio.to_thread(memory.needs_defaults, user["id"])
        needs = dict(defaults["defaults"])
        match = re.search(r"(?:预算|budget|around|about|大约|约)\s*(?:CNY|RMB|人民币|¥|￥)?\s*(\d+(?:\.\d+)?)", args.query, re.I)
        if match:
            needs["budget"] = float(match.group(1))
            needs["budget_provenance"] = "current_user_message"
        if re.search(r"Japan|日本", args.query, re.I):
            needs["destination"] = "Japan"
        if re.search(r"hospital|住院|医疗", args.query, re.I):
            needs["goal"] = "medical_cover"
        elif re.search(r"travel|旅行|旅游", args.query, re.I):
            needs["goal"] = "travel_cover"
        if re.search(r"young kid|one child|一个.{0,4}孩|有个.{0,4}孩", args.query, re.I):
            needs["dependants"] = "one child mentioned by user"
        return {"needs": needs, "memory_provenance": defaults["provenance"], "missing_slots": [k for k in ("goal", "budget") if k not in needs], "notice": "Only explicitly stated details and approved defaults; no report-derived financial or health inference. Confirm the period/unit and any missing suitability details with a licensed professional."}
    if step.tool == "emergency_contacts":
        return workflows.emergency(country="Japan", locale=args.locale)
    if step.tool == "policy_list":
        return documents.list_policies(user)
    if step.tool == "portfolio_summary":
        return documents.portfolio(user)
    if step.tool == "policy_terms_get":
        return document_analysis.analyze_policy(args.policy_id, user)
    if step.tool == "policy_clauses_get":
        return document_analysis.clauses(args.policy_id, query="", type=None, user=user)
    if step.tool == "policy_summary":
        return document_analysis.policy_summary(args.policy_id, locale=args.locale, user=user)
    if step.tool == "document_get":
        return documents.get_document(args.document_id, user)
    if step.tool == "report_analysis":
        return document_analysis.analyze_document(args.document_id, user)
    if step.tool == "reports_list":
        return document_analysis.reports(user)
    if step.tool == "vault_list":
        return lifecycle.vault(user)
    if step.tool == "memory_read":
        return memory.list_memory(user)
    if step.tool == "audit_read":
        return memory.audit_events(user)
    if step.tool == "renewal_alerts_list":
        return workflows.renewal_reminders(user)
    if step.tool == "premium_history_get":
        return workflows.premium_history(args.policy_id, user)
    if step.tool == "claim_list":
        return workflows.list_claims(user)
    if step.tool in {"claim_prescreen", "claim_checklist"}:
        claim = workflows.get_claim(args.claim_id, user)
        return {"prescreen": claim["prescreen"]} if step.tool == "claim_prescreen" else {"checklist": claim["checklist"], "missing": claim["missing"], "validation": claim.get("validation", {})}
    if step.tool == "claim_notifications":
        return workflows.list_notifications(args.claim_id, user)
    if step.tool == "claim_explanation":
        return workflows.explain_claim_status(args.claim_id, mode="actual", user=user)
    if step.tool == "crossborder_kit":
        return workflows.crossborder_kit(args.claim_id, user)
    if step.tool == "incident_types_list":
        return workflows.incidents(family=args.family, country=args.country)
    if step.tool == "product_catalog":
        result = workflows.catalog()
        return {**result, "products": [p for p in result["products"] if not args.family or p["family"] == args.family]}
    if step.tool == "agent_directory":
        return workflows.demo_agent_directory(language=args.locale, city="")
    if step.tool == "sales_pattern_check":
        return workflows.check_selling(workflows.SellingCheck(text=args.query))
    if step.tool == "cost_estimator":
        return workflows.cost_estimate(args.cost, user)
    if step.tool == "product_compare":
        return workflows.compare_products(args.comparison, user)
    raise HTTPException(403, "DENY:UNKNOWN_TOOL")


def event(stage, status, detail, **extra):
    return {"stage": stage, "status": status, "detail": detail, "at": core.now_iso(), **extra}


async def stream_turn(payload, user):
    """Yield after actual boundaries, before waiting for each tool, never timers."""
    from . import intelligence, documents
    from .jev_adapter import suggest
    started = time.monotonic()
    now = core.now_iso()
    turn_id = core.uid("tr_")
    events, results = [], {}
    protected = intelligence.local_route(payload.message) in {"outside_scope", "emergency"} or bool(documents.INJECTION.search(payload.message))
    advice = ({"used": False, "reason": "deterministic_safety_priority", "engine": "deterministic_allowed_intents"} if protected else await suggest(intelligence.mask_pii(payload.message, user), question="intent"))
    with core.get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        if payload.conversation_id:
            conversation = owned_conversation(db, payload.conversation_id, user["id"])
            if payload.expected_revision is not None and payload.expected_revision != conversation["revision"]:
                raise HTTPException(409, "Conversation changed in another tab. Reload before sending.")
        else:
            identifier = core.uid("conv_")
            db.execute("INSERT INTO conversations VALUES(?,?,?,?,?,?,?)", (identifier, user["id"], payload.message[:80], "{}", 0, now, now))
            conversation = owned_conversation(db, identifier, user["id"])
        conversation_id = conversation["id"]
        state = json.loads(conversation["state_json"])
        if state.get("in_flight_until", 0) > time.time():
            raise HTTPException(409, "A turn is already running in this conversation. Wait for it to finish.")
        policy_id = payload.policy_id or state.get("policy_id")
        claim_id = payload.claim_id or state.get("claim_id")
        if payload.policy_id and payload.policy_id != state.get("policy_id") and not payload.claim_id:
            claim_id = None
        # Validate before revealing an existing conversation state or starting work.
        for table, identifier in (("policies", policy_id), ("claims", claim_id)):
            if identifier and not db.execute(f"SELECT 1 FROM {table} WHERE id=? AND user_id=?", (identifier, user["id"])).fetchone():
                raise HTTPException(404, "Resource not found.")
        message = payload.message.strip()
        pending = state.get("pending_question")
        correction = bool(re.search(r"不是|改用|纠正|correction|instead|wrong policy", message, re.I))
        if correction and not payload.policy_id:
            policy_id = None
            claim_id = payload.claim_id
        resumed = bool(pending and (payload.policy_id or payload.claim_id) and len(message) < 100)
        if resumed and not correction:
            message = pending
        goal = "outside_scope" if documents.INJECTION.search(message) else detect_goal(message, intelligence.local_route(message))
        adopted = False
        if advice.get("used") and goal == "policy_question" and not protected and not resumed and advice.get("suggestion") in {"policy_question", "coverage_analysis", "claim_status", "buying", "emergency", "outside_scope"}:
            goal = advice["suggestion"]
            adopted = True
        advice = advice | {"adopted": adopted}
        if not policy_id and goal in {"policy_question", "policy_terms", "policy_summary", "premium_history"}:
            policies = db.execute("SELECT id FROM policies WHERE user_id=? ORDER BY created_at", (user["id"],)).fetchall()
            if len(policies) == 1:
                policy_id = policies[0]["id"]
        if not claim_id and goal in {"claim_status", "claim_preview", "crossborder", "claim_checklist", "claim_explanation"}:
            claims = db.execute("SELECT id,policy_id FROM claims WHERE user_id=? ORDER BY created_at LIMIT 2", (user["id"],)).fetchall()
            if len(claims) == 1:
                claim_id = claims[0]["id"]
                policy_id = claims[0]["policy_id"]
        plan = make_plan(goal, policy_id, claim_id, message, payload.locale)
        db.execute("INSERT INTO agent_turns VALUES(?,?,?,?,?,?,NULL,?,?,NULL)", (turn_id, conversation_id, user["id"], payload.message, plan.model_dump_json(), "[]", "running", now))
        reserved_revision = conversation["revision"] + 1
        running_state = state | {"in_flight_until": time.time() + 50, "in_flight_turn": turn_id}
        db.execute("UPDATE conversations SET revision=?,state_json=?,updated_at=? WHERE id=? AND user_id=?", (reserved_revision, json.dumps(running_state), now, conversation_id, user["id"]))
    def record(item):
        events.append(item)
        with core.get_db() as db:
            db.execute("UPDATE agent_turns SET events_json=? WHERE id=? AND user_id=?", (json.dumps(events, ensure_ascii=False), turn_id, user["id"]))
    # PII stays in private messages. Inspector arguments and operational logs omit it.
    for item in (event("understand", "ok", {"intent": goal, "locale": payload.locale, "slots": {"policy_id": policy_id, "claim_id": claim_id}, "resumed": resumed}),
                 event("routing", "advisory_used" if advice.get("adopted") else "advisory_ignored" if advice.get("used") else "fallback", advice),
                 event("plan", "ok", plan.model_dump())):
        record(item)
        yield {"type": "event", "event": item, "conversation_id": conversation_id, "trace_id": turn_id}
    if correction or resumed:
        item = event("replan", "ok", "Previous resource-dependent steps replaced by a newly validated plan; no previous write is repeated.")
        record(item)
        yield {"type": "event", "event": item}
    completed = set()
    failure = None
    for step in plan.steps:
        if time.monotonic() - started > 45:
            failure = "turn_time_budget"
            break
        item = event("execute", "running", step.purpose, tool=step.tool, step_id=step.id, tier=TOOLS[step.tool]["tier"], args_masked=safe_args(step.args))
        record(item)
        yield {"type": "event", "event": item}
        tool_start = time.monotonic()
        try:
            results[step.tool] = await asyncio.wait_for(invoke_tool(step, plan, completed, user), timeout=max(1, 45 - (time.monotonic() - started)))
            completed.add(step.id)
            item = event("execute", "ok", "Tool returned; no external recipient was contacted.", tool=step.tool, step_id=step.id, latency_ms=round((time.monotonic()-tool_start)*1000))
        except HTTPException as exc:
            failure = str(exc.detail)
            item = event("safety", "blocked", failure, tool=step.tool, step_id=step.id)
        except Exception as exc:
            failure = type(exc).__name__
            item = event("execute", "failed", "Tool unavailable; preserved completed work and safe next steps.", tool=step.tool, step_id=step.id)
        record(item)
        yield {"type": "event", "event": item}
        if failure:
            break
    result = {"engine": "deterministic_planned", "citations": [], "cards": [], "chips": [], "answer": "", "disclaimer": intelligence.DISCLAIMER[payload.locale]}
    zh = payload.locale == "zh"
    if failure:
        result.update(answer="本步无法完成；已完成的只读检查保留。请打开对应页面核对后重试。" if zh else "This step could not finish. Completed reads are preserved; review the relevant page and retry.", uncertainty="tool_unavailable", cards=[{"type": "claim" if claim_id else "policy_review", "path": f"/claims/{claim_id}" if claim_id else f"/policies/{policy_id}", "policy_id": policy_id}])
    elif plan.missing_slots:
        with core.get_db() as db:
            table = "policies" if "policy_id" in plan.missing_slots else "claims"
            rows = db.execute(f"SELECT id FROM {table} WHERE user_id=? LIMIT 30", (user["id"],)).fetchall()
        result.update(answer=("请先选择要讨论的保单。" if table == "policies" else "请选择要准备或跟进的理赔记录。") if zh else ("Select the policy to continue." if table == "policies" else "Select the claim to continue."), clarification={"type": "select_policy" if table == "policies" else "select_claim", "options": [{"id": r["id"], "title": r["id"]} for r in rows]})
    elif goal == "policy_question":
        result.update(results.get("policy_explain", {}))
    elif goal == "coverage_analysis":
        matrix = results["coverage_analyze"]
        evidence = [e for area in matrix["areas"] for e in area["evidence"]][:8]
        result.update(answer="已按当前已确认保单中的原文整理保障观察。未找到条款不代表没有保障；重叠需要核对报销和给付规则。" if zh else "Source-based observations are ready. Missing passages do not prove absent cover; possible overlaps require reimbursement and benefit review.", cards=[{"type": "gap", "path": "/", "data": matrix}], citations=[{"id": f"C{i+1}", **e} for i,e in enumerate(evidence)])
    elif goal == "claim_status":
        claim = results["claim_status_get"]
        result.update(answer=(f"当前平台状态：{claim['actual_status']}。保险公司时间线另有模拟标记。" if zh else f"Current platform state: {claim['actual_status']}. Insurer events remain separately simulated."), cards=[{"type": "tracker", "path": f"/claims/{claim_id}", "data": claim}])
    elif goal == "claim_preview":
        preview = results["claim_export_preview"]
        result.update(answer="已准备当前版本的下载预览。请逐项核对并确认；这不会提交给保险公司。" if zh else "The current download preview is ready. Review the exact version and confirm; it will not be sent to an insurer.", pending_action={"kind": "export_claim_package", "token": preview["token"], "expires_at": preview["expires_at"], "claim_id": claim_id, "payload": preview["payload"], "recipient": "User download only"}, cards=[{"type": "claim", "path": f"/claims/{claim_id}"}])
    elif goal == "buying":
        captured = results.get("needs_capture", {})
        result.update(answer="已整理你明确表达的需求和批准偏好，先核对预算单位及目标，再比较有来源的产品；持牌人员完成最终建议和销售。" if zh else "Your stated needs and approved preferences are ready. Review the budget unit and goal before comparing sourced products; a licensed professional provides final advice and sales.",
                      cards=[{"type": "buying", "path": "/buy", "defaults": results.get("needs_defaults", {}), "data": captured}], needs=captured.get("needs", {}))
    elif goal == "emergency":
        result.update(answer="先确保人身安全，需要急救时立即联系当地应急服务，不要等待保险或取证步骤。" if zh else "Put safety first. Contact local emergency services immediately when urgent; do not wait for insurance or evidence.", cards=[{"type": "emergency", "path": "/emergency", "data": results.get("emergency_contacts", {})}])
    elif goal in {"policy_terms", "policy_summary", "premium_history"}:
        data = next(iter(results.values()), {})
        if goal == "policy_summary":
            answer = data.get("summary", "") + "\n\n" + data.get("notice", "")
        elif goal == "policy_terms":
            terms = [t for t in data.get("terms", []) if t.get("source")][:5]
            result["citations"] = [{"id": f"C{i+1}", **t["source"]} for i,t in enumerate(terms)]
            answer = ("已整理有出处的条款候选，置信度未测量。请核对等待期、免赔、限额和排除责任；原文摘要不代表个人保障结论。" if zh else "Source-bound term candidates are ready; confidence is unmeasured. Review waiting periods, deductibles, limits and exclusions. Extracts are not personal coverage conclusions.")
        else:
            answer = (f"已保存 {len(data.get('entries', []))} 条用户核对的历史保费记录；不同币种不会合并，记录不代表续保或实时报价。" if zh else f"Found {len(data.get('entries', []))} user-reviewed premium entries. Currencies are separate; these are not renewal or live quotes.")
        result.update(answer=answer, cards=[{"type": "policy_review", "policy_id": policy_id, "path": f"/policies/{policy_id}", "data": data}])
    elif goal in {"crossborder", "claim_checklist", "claim_explanation"}:
        result.update(answer="已读取本人的理赔资料与出处。请打开记录核对条件、缺失材料和下一步；保险公司状态仍独立标为模拟。" if zh else "Your own case evidence and guidance are ready. Open the record to review conditions, missing documents and next steps; insurer status remains separately simulated.", cards=[{"type": "claim", "path": f"/claims/{claim_id}", "data": results}])
    elif goal in {"portfolio", "memory", "vault", "audit", "renewal", "report_analysis", "incidents", "sales_check"}:
        paths = {"portfolio": "/", "memory": "/me", "vault": "/me", "audit": "/me", "renewal": "/", "report_analysis": "/reports", "incidents": "/incidents", "sales_check": "/buy"}
        answer = "已读取你有权限查看的实际记录，请打开对应页面核对详情。缺失资料保持未知，不自动推断健康、财富或保险资格。" if zh else "Your permitted records are ready. Open the relevant page to review details. Missing facts remain unknown; no health, wealth or eligibility is inferred."
        if goal == "sales_check":
            checked = results.get("sales_pattern_check", {})
            answer = "\n".join([checked.get("result", "")] + [f["message"] for f in checked.get("flags", [])] + [checked.get("notice", "")])
        result.update(answer=answer, cards=[{"type": "gap" if goal == "portfolio" else "buying" if goal in {"renewal", "sales_check"} else "workspace", "path": paths[goal], "data": results}])
    else:
        result.update(answer="我不能操作资金、更改收款账户或查看他人资料。我可以协助理解保单和准备材料。" if zh else "I cannot move money, change payout accounts or access another person's information. I can help with policies and evidence.", chips=["查看保障", "准备理赔材料", "紧急帮助"])
        record(event("safety", "blocked", "Requested action is outside the registry; no data tool executed."))
    for item in (event("verify", "ok" if not failure else "degraded", "Owner checks and source validation applied; extractive evidence is not an insurer decision."), event("respond", "ok", "Prepared response and reviewable cards.")):
        record(item)
        yield {"type": "event", "event": item}
    new_state = {"policy_id": policy_id, "claim_id": claim_id, "goal": goal, "pending_question": message if plan.missing_slots else None, "status": "awaiting_clarification" if plan.missing_slots else "awaiting_confirmation" if result.get("pending_action") else "completed"}
    revision = reserved_revision
    result.update(conversation_id=conversation_id, conversation_revision=revision, trace_id=turn_id, plan=plan.model_dump(), state=new_state,
                  trace=events + result.get("trace", []))
    with core.get_db() as db:
        updated = db.execute("UPDATE conversations SET state_json=?,updated_at=? WHERE id=? AND user_id=? AND revision=?", (json.dumps(new_state, ensure_ascii=False), core.now_iso(), conversation_id, user["id"], revision))
        if not updated.rowcount:
            raise HTTPException(409, "Conversation changed during this turn. Read the latest history.")
        db.execute("UPDATE agent_turns SET events_json=?,result_json=?,status=?,completed_at=? WHERE id=? AND user_id=?", (json.dumps(events, ensure_ascii=False), json.dumps(result, ensure_ascii=False), new_state["status"], core.now_iso(), turn_id, user["id"]))
        core.audit(db, user["id"], "agent_plan_completed", "trace", turn_id, {"goal": goal, "tools_completed": len(completed), "status": new_state["status"]})
    yield {"type": "result", **result}


async def run_turn(payload, user):
    result = None
    async for item in stream_turn(payload, user):
        if item["type"] == "result":
            result = {k: v for k, v in item.items() if k != "type"}
    return result


class NewConversation(Strict):
    title: str = Field(default="New insurance conversation", max_length=100)


@router.post("/conversations")
def new_conversation(payload: NewConversation, user=Depends(core.current_user)):
    identifier, now = core.uid("conv_"), core.now_iso()
    with core.get_db() as db:
        db.execute("INSERT INTO conversations VALUES(?,?,?,?,?,?,?)", (identifier, user["id"], payload.title, "{}", 0, now, now))
    return {"id": identifier, "conversation_id": identifier, "revision": 0, "messages": [], "turns": []}


@router.get("/conversations")
def list_conversations(user=Depends(core.current_user)):
    with core.get_db() as db:
        return {"conversations": [dict(r) for r in db.execute("SELECT id,title,revision,created_at,updated_at FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 100", (user["id"],))]}


@router.get("/conversations/{identifier}")
def get_conversation(identifier: str, user=Depends(core.current_user)):
    with core.get_db() as db:
        row = owned_conversation(db, identifier, user["id"])
        turns = db.execute("SELECT * FROM agent_turns WHERE conversation_id=? AND user_id=? ORDER BY started_at", (identifier, user["id"])).fetchall()
    messages = []
    for turn in turns:
        result = json.loads(turn["result_json"]) if turn["result_json"] else None
        messages.append({"role": "user", "content": turn["message"], "created_at": turn["started_at"]})
        if result:
            messages.append({"role": "assistant", "content": result["answer"], "result": result, "created_at": turn["completed_at"]})
    return {"id": identifier, "conversation_id": identifier, "title": row["title"], "revision": row["revision"], "state": json.loads(row["state_json"]), "messages": messages,
            "turns": [{"id": t["id"], "trace_id": t["id"], "status": t["status"], "started_at": t["started_at"], "completed_at": t["completed_at"]} for t in turns]}


@router.delete("/conversations/{identifier}")
def delete_conversation(identifier: str, user=Depends(core.current_user)):
    with core.get_db() as db:
        owned_conversation(db, identifier, user["id"])
        db.execute("DELETE FROM conversations WHERE id=? AND user_id=?", (identifier, user["id"]))
        core.audit(db, user["id"], "conversation_deleted", "conversation", identifier)
    return {"ok": True, "notice": "Private current-store messages and traces deleted. Saved documents, memories and hosting snapshots are separate."}


@router.get("/traces/{identifier}")
def get_trace(identifier: str, user=Depends(core.current_user)):
    with core.get_db() as db:
        row = db.execute("SELECT * FROM agent_turns WHERE id=? AND user_id=?", (identifier, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Trace not found.")
    result = json.loads(row["result_json"]) if row["result_json"] else {}
    events = json.loads(row["events_json"])
    return {"id": identifier, "trace_id": identifier, "conversation_id": row["conversation_id"], "plan": json.loads(row["plan_json"]), "events": events,
            "tools": [e for e in events if e.get("tool")], "safety": [e for e in events if e["stage"] == "safety"], "evidence": result.get("citations", []),
            "result": result, "started_at": row["started_at"], "completed_at": row["completed_at"]}


@router.get("/tools")
def tools_catalog(user=Depends(core.current_user)):
    return {"tools": [{"name": name, **spec, "goals": sorted(spec["goals"]), "required_arguments": sorted(REQUIRED_ARGS.get(name, set()))} for name, spec in TOOLS.items()], "arguments_schema": ToolArgs.model_json_schema(), "maximum_calls_per_turn": 8, "maximum_seconds_per_turn": 45, "no_external_delivery": True, "no_money_tools": True}


class DirectTool(Strict):
    tool: str = Field(min_length=1, max_length=80)
    args: ToolArgs = Field(default_factory=ToolArgs)


@router.post("/agent/tools/invoke")
async def explicit_read_tool(payload: DirectTool, user=Depends(core.current_user)):
    """Authenticated harness adapter. Writes must use reviewed workflow APIs."""
    spec = TOOLS.get(payload.tool)
    if not spec or spec["tier"] not in {"T0", "T1"}:
        raise HTTPException(403, "DENY:READ_ONLY_TOOL_ADAPTER")
    goal = sorted(spec["goals"])[0]
    step = Step(id="explicit_read", tool=payload.tool, args=payload.args, purpose="Explicit authenticated read request")
    plan = Plan(goal=goal, steps=[step], user_visible_summary="Execute the requested allowlisted read/computation only.")
    with core.get_db() as db:
        pep_validate(db, user, plan, step, set())
    result = await invoke_tool(step, plan, set(), user)
    with core.get_db() as db:
        core.audit(db, user["id"], "explicit_guarded_tool_read", "tool", payload.tool, {"tier": spec["tier"], "argument_names": sorted(payload.args.model_fields_set)})
    return {"tool": payload.tool, "tier": spec["tier"], "result": result, "no_external_delivery": True}


class ConfirmAction(Strict):
    conversation_id: str
    token: str = Field(min_length=16, max_length=200)
    confirmed: bool


@router.post("/agent/actions/confirm")
def confirm_action(payload: ConfirmAction, user=Depends(core.current_user)):
    from . import workflows
    if not payload.confirmed:
        raise HTTPException(422, "Explicit review is required.")
    with core.get_db() as db:
        conversation = owned_conversation(db, payload.conversation_id, user["id"])
        turn = db.execute("SELECT result_json FROM agent_turns WHERE conversation_id=? AND user_id=? ORDER BY started_at DESC LIMIT 1", (payload.conversation_id, user["id"])).fetchone()
        pending = (json.loads(turn[0]).get("pending_action") if turn and turn[0] else None)
        if not pending or pending.get("token") != payload.token or pending.get("kind") != "export_claim_package":
            raise HTTPException(409, "No matching pending action. Review a new preview.")
    result = workflows.export_claim(pending["claim_id"], workflows.ActionConfirmation(token=payload.token, confirmed=True), user)
    with core.get_db() as db:
        state = json.loads(conversation["state_json"])
        state["status"] = "completed"
        db.execute("UPDATE conversations SET state_json=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=?", (json.dumps(state), core.now_iso(), payload.conversation_id, user["id"]))
        core.audit(db, user["id"], "agent_reviewed_export_confirmed", "conversation", payload.conversation_id, {"external_delivery": False})
    return result | {"conversation_id": payload.conversation_id, "notice": "User download only; no insurer submission occurred."}
