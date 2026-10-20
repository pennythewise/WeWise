"""Code-owned claims preparation, comparisons and isolated insurer simulation.

No endpoint submits a claim, sells a policy, contacts an agent or calls a phone.
All personal rows/files are owner-scoped. Export authorization binds a single-use
token to the exact current policy, incident, evidence and recipient snapshot.
"""
from __future__ import annotations

import asyncio

from datetime import date, datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import secrets
import sqlite3
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from .core import get_db, current_user, now_iso, uid, DATA_DIR, UPLOAD_DIR, ROOT, audit
from .exports import archive_name, manifest_bytes, pdf_bytes, zip_bytes
from . import chain
from . import claims_tracker as tracking
from .insurance_features import DOCUMENT_LABELS, requirements, incident_library, estimate_cost, comparison, match_agents, DEMO_AGENTS

router = APIRouter(prefix="/api", tags=["workflows"])
WORDING_URL = "https://pts.allianz.com.cn/portal/resources/material/clauses/NLC_AXWL02_231.pdf"
CLAIM_CHANNEL_URL = "https://sales.allianz.com.cn/ewebsite/pages/quicknav/quicknav_lplc.shtml"
JNTO_URL = "https://www.japan.travel/en/plan/hotline/"
REVIEWED_ON = "2026-10-17"
DISCLOSURE = "Preparation and educational comparison only. No insurer submission, advice partnership, sale or payout has occurred."
EXPORT_DIR = DATA_DIR / "exports"

CATALOG = [
    {"id": "allianz_changyou_2023", "name": "安联境外旅行（畅游版）互联网意外伤害保险", "insurer": "安联人寿保险有限公司", "family": "travel", "source_url": WORDING_URL,
     "wording_version": "Published 2023 wording; issued schedule and endorsements govern", "benefits": ["accidental_medical", "overseas_travel", "emergency_assistance"],
     "benefit_notes": "Accidental outpatient relevance depends on selected benefits, limits, dates and exclusions. Illness cover is not inferred from this accident wording.", "limitations": ["Not proof of current sale or personal cover", "Schedule and endorsement review required"], "premium": None, "quote_status": "Official quote required", "verified_on": REVIEWED_ON, "simulation_label": "Real product wording reference; no binding quote", "catalogue_status": "reference"},
    {"id": "pingan_asia_wording", "name": "境外亚洲旅游保险适用条款", "insurer": "中国平安", "family": "travel", "source_url": "https://resources.pingan.com/app_upload/file/annuity/tiaokuan/jingwailiuyou_yz.pdf",
     "wording_version": "Official published wording; historical reference, live sale/selected plan unverified", "benefits": ["accidental_medical", "overseas_travel", "emergency_assistance"],
     "benefit_notes": "Published Asia travel wording; benefit selection, eligibility, deductibles and limits depend on the applicable contract and schedule.", "limitations": ["Exact issued wording/version must be matched", "Do not infer selected benefits or limits", "No live price or availability verified"], "premium": None, "quote_status": "Official quote required", "verified_on": REVIEWED_ON, "simulation_label": "Real published wording reference; no binding quote", "catalogue_status": "reference"},
    {"id": "picc_overseas_2022", "name": "境外旅行意外伤害保险（2022版）", "insurer": "中国人民财产保险股份有限公司", "family": "travel", "source_url": "https://www.epicc.com.cn/clauses_for_wap/tiaokuan/060445.pdf",
     "wording_version": "2022; registration C00000232312022062916943", "benefits": ["accidental_medical", "overseas_travel", "emergency_assistance"],
     "benefit_notes": "Death/disability is mandatory in the published wording; medical and rescue benefits are selectable and apply only when selected on the schedule.", "limitations": ["Medical/rescue selection unknown without schedule", "No live price or availability verified", "Published wording is not proof of personal cover"], "premium": None, "quote_status": "Official quote required", "verified_on": REVIEWED_ON, "simulation_label": "Real published wording reference; no binding quote", "catalogue_status": "reference"},
]

CATEGORIES = {
    "policy": "Policy schedule and applicable wording / 保单及适用条款",
    "identity": "Insured/applicant identity and authority / 身份及申请权限",
    "travel_proof": "Travel dates and entry/exit evidence / 旅程及出入境证明",
    "medical_record": "Outpatient record and recorded diagnosis / 门诊病历及诊断",
    "original_expense": "Original expense evidence and itemisation / 原始费用凭证及明细",
    "claim_form": "Reviewed claim application / 已核对理赔申请表",
    "incident_evidence": "Relevant incident evidence / 相关事故证明",
    "discharge_record": "Inpatient discharge record / 住院出院记录",
    "other": "Additional evidence / 补充材料",
}
CATEGORIES.update(DOCUMENT_LABELS)
CRITICAL_FIELDS = ["date", "country", "description", "treatment_type"]


def init_workflow_db():
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,policy_id TEXT NOT NULL,policy_revision INTEGER NOT NULL,benefit TEXT NOT NULL,incident_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,confirmed_revision INTEGER,status TEXT NOT NULL DEFAULT 'DRAFT',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS claims_owner ON claims(user_id);
        CREATE TABLE IF NOT EXISTS claim_evidence(claim_id TEXT NOT NULL,user_id TEXT NOT NULL,document_id TEXT NOT NULL,category TEXT NOT NULL,fields_json TEXT NOT NULL,confirmed_revision INTEGER,created_at TEXT NOT NULL,PRIMARY KEY(claim_id,document_id));
        CREATE TABLE IF NOT EXISTS claim_updates(id TEXT PRIMARY KEY,claim_id TEXT NOT NULL,user_id TEXT NOT NULL,provenance TEXT NOT NULL,document_id TEXT,note TEXT NOT NULL,event_at TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS claim_simulations(id TEXT PRIMARY KEY,claim_id TEXT NOT NULL,user_id TEXT NOT NULL,stage TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workflow_actions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,payload_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,expires_at REAL NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workflow_exports(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,claim_id TEXT,kind TEXT NOT NULL,mode TEXT NOT NULL,pdf_path TEXT NOT NULL,zip_path TEXT,snapshot_json TEXT NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS buying_callbacks(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,brief_export_id TEXT NOT NULL,created_at TEXT NOT NULL);
        """)
        tracking.init_tables(db)
        db.executescript("""
        CREATE TABLE IF NOT EXISTS policy_premium_history(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,year INTEGER NOT NULL,premium REAL NOT NULL,currency TEXT NOT NULL,source_note TEXT NOT NULL,document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,provenance TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,policy_id,year,currency));
        CREATE TABLE IF NOT EXISTS buying_needs(user_id TEXT PRIMARY KEY,needs_json TEXT NOT NULL,updated_at TEXT NOT NULL);
        """)
        db.execute("DELETE FROM workflow_actions WHERE expires_at<=?", (time.time(),))


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _hash(value):
    return hashlib.sha256(_json(value).encode()).hexdigest()


def _owned(db, table, identifier, user_id):
    # Table names are private constants at callsites, never supplied by request.
    row = db.execute(f"SELECT * FROM {table} WHERE id=? AND user_id=?", (identifier, user_id)).fetchone()
    if not row:
        raise HTTPException(404, "Not found.")
    return dict(row)


def _doc_valid(document):
    if not document or document["size"] <= 0:
        return False
    path = Path(document["storage_path"]).resolve()
    try:
        path.relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        return False
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == document["sha256"]


def _policy_supported(db, policy):
    title = str(policy["title"]).lower()
    identity_match = policy["family"] == "travel" and ("畅游" in title or "changyou" in title) and ("安联" in policy["insurer"] or "allianz" in policy["insurer"].lower())
    # Support comes from the customer's owned, byte-verified reviewed contract,
    # not an internal seed identifier or an editable name/URL assertion.
    return identity_match and any(document["is_wording"] and document["exists"] for document in _policy_files(db, policy)) and _selected_outpatient_benefit(db, policy)


def _selected_outpatient_benefit(db, policy):
    fields = json.loads(policy["fields_json"])
    def normalized(value):
        return re.sub(r"\s+", "", str(value)).casefold()
    primary = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (policy["document_id"], policy["user_id"])).fetchone()
    if not primary or not _doc_valid(primary):
        return False
    pages = json.loads(primary["pages_json"])
    for item in fields.get("benefits", []):
        name = item.get("name", "") if isinstance(item, dict) else str(item)
        if not re.search(r"accidental\s+outpatient|意外伤害医疗|意外医疗", name, re.I):
            continue
        source = item.get("source") if isinstance(item, dict) else None
        quotes = []
        if isinstance(source, dict) and source.get("document_id") == policy["document_id"] and _verified_fact_source(db, policy, source):
            quotes.append(str(source["quote"]))
        elif source is None:
            # Older clients submitted reviewed benefits as strings. Recover the
            # source only by matching that text to a printed selected-benefit
            # line on the actual primary schedule, with whitespace normalized.
            for page in pages:
                lines = page["text"].splitlines()
                quotes.extend("\n".join(lines[i:i+2]) for i in range(len(lines)) if re.search(r"selected\s+benefit\s*[:：]|已选(?:择)?(?:保障|责任)|已投保|所选(?:保障|责任)", lines[i], re.I))
        for quoted in quotes:
            selected = re.search(r"selected\s+benefit\s*[:：]|已选(?:择)?(?:保障|责任)|已投保|所选(?:保障|责任)", quoted, re.I)
            benefit = re.search(r"accidental\s+outpatient|意外伤害医疗|意外医疗", quoted, re.I)
            if selected and benefit and normalized(name) in normalized(quoted):
                return True
    return False


def _policy_files(db, policy):
    if not policy:
        return []
    documents = db.execute("SELECT d.* FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE pd.policy_id=? AND d.user_id=? ORDER BY d.id", (policy["id"], policy["user_id"])).fetchall()
    reviewed_wording = ROOT / "backend" / "fixtures" / "allianz-changyou-2023-wording.pdf"
    reviewed_hash = hashlib.sha256(reviewed_wording.read_bytes()).hexdigest() if reviewed_wording.is_file() else None
    return [{"document_id": d["id"], "name": d["name"], "sha256": d["sha256"], "exists": _doc_valid(d),
             "is_wording": bool(reviewed_hash and d["sha256"] == reviewed_hash)} for d in documents]


def _claim(db, claim_id, user_id):
    claim = _owned(db, "claims", claim_id, user_id)
    policy = db.execute("SELECT * FROM policies WHERE id=? AND user_id=?", (claim["policy_id"], user_id)).fetchone()
    policy = dict(policy) if policy else None
    return claim, policy


def _evidence(db, claim, policy):
    result = []
    for evidence in db.execute("SELECT * FROM claim_evidence WHERE claim_id=? AND user_id=?", (claim["id"], claim["user_id"])):
        evidence = dict(evidence)
        document = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (evidence["document_id"], claim["user_id"])).fetchone()
        valid = _doc_valid(document)
        result.append({"document_id": evidence["document_id"], "category": evidence["category"], "fields": json.loads(evidence["fields_json"]), "name": document["name"] if document else "Deleted document", "exists": valid,
                       "recognised": bool(document and document["text"]), "confirmed": bool(valid and evidence["confirmed_revision"] == claim["revision"] and policy and claim["policy_revision"] == policy["revision"] and policy["confirmed"]),
                       "sha256": document["sha256"] if document else None, "synthetic": bool(document and "SYNTHETIC" in document["text"].upper()), "file_url": f"/api/documents/{evidence['document_id']}/file" if document else None})
    return result


def _checklist(db, claim, policy, evidence):
    incident = json.loads(claim["incident_json"])
    family = policy["family"] if policy else "other"
    reference = requirements(family, claim["benefit"], incident)
    required = [item["id"] for item in reference if not item["condition"]]
    conditional = [item["id"] for item in reference if item["condition"]]
    reviewed = bool(policy and _policy_supported(db, policy) and claim["benefit"] == "outpatient_accident" and incident.get("treatment_type") == "outpatient")
    entries = []
    for category in required + conditional:
        matching = [item for item in evidence if item["category"] == category and item["exists"]]
        confirmed = [item for item in matching if item["confirmed"]]
        # A verified imported policy is actual owned evidence, not a mock checklist tick.
        if category == "policy" and policy and policy["confirmed"] and claim["policy_revision"] == policy["revision"]:
            files = _policy_files(db, policy)
            has_primary = any(d["document_id"] == policy["document_id"] and d["exists"] for d in files)
            has_exact_wording = any(d["is_wording"] and d["exists"] for d in files)
            reviewed_identity = policy["family"] == "travel" and ("畅游" in policy["title"] or "changyou" in policy["title"].lower()) and ("安联" in policy["insurer"] or "allianz" in policy["insurer"].lower())
            if has_primary and (has_exact_wording or not reviewed_identity):
                confirmed.extend({"document_id": d["document_id"]} for d in files if d["exists"])
            else:
                confirmed = []
        entries.append({"category": category, "label": CATEGORIES[category], "required": True, "conditional": category in conditional,
                        "condition": "Inpatient treatment" if category == "discharge_record" else "Relevant police/third-party incident" if category == "incident_evidence" else None,
                        "accepted_document_ids": [item["document_id"] for item in confirmed], "uploaded_document_ids": [item["document_id"] for item in matching], "confirmed": bool(confirmed), "missing": not bool(confirmed),
                        "source": {"url": WORDING_URL, "section": "4.3", "page": 12} if reviewed else {"url": next((i["source_url"] for i in reference if i["id"] == category), None), "section": None, "page": None},
                        "rule_status": "reviewed_example" if reviewed else "reference_only", "where_to_get": next((i["where_to_get"] for i in reference if i["id"] == category), "Issuer / your records"),
                        "note": "User preparation check only; insurer may request additional documents or originals." if reviewed else "Educational starting checklist, not the exact issued contract. Export remains a labelled draft pending insurer-specific review."})
    return entries


def _validation(claim, policy, checklist, evidence):
    """Flag factual conflicts for correction; do not diagnose or decide entitlement."""
    incident = json.loads(claim["incident_json"])
    issues, warnings = [], []
    def flag(item, code, message):
        issues.append({"document_id": item["document_id"], "code": code, "message": message, "source": "User-reviewed document fields"})
    for item in evidence:
        if not item["confirmed"]:
            continue
        fields = item["fields"]
        named = fields.get("patient_name") or fields.get("insured_name")
        if named and policy and re.sub(r"\s", "", str(named)).casefold() != re.sub(r"\s", "", str(policy["insured_name"])).casefold():
            flag(item, "PATIENT_NAME_MISMATCH", "The reviewed patient / insured name differs from the confirmed policy. Check spelling, identity and role; do not assume fraud.")
        dates = {}
        for key in ("admission_date", "discharge_date", "treatment_date", "document_date"):
            if fields.get(key):
                try:
                    dates[key] = date.fromisoformat(str(fields[key]))
                except ValueError:
                    flag(item, "INVALID_DATE", f"The reviewed {key.replace('_', ' ')} is not a valid ISO date.")
        if dates.get("admission_date") and dates.get("discharge_date") and dates["discharge_date"] < dates["admission_date"]:
            flag(item, "DISCHARGE_BEFORE_ADMISSION", "The discharge date is earlier than the admission date. Check the original record.")
        if dates.get("treatment_date") and incident.get("date"):
            try:
                if dates["treatment_date"] < date.fromisoformat(incident["date"]):
                    flag(item, "TREATMENT_BEFORE_INCIDENT", "The treatment date is before the recorded incident. Check both original facts.")
            except ValueError:
                pass
        amount = fields.get("expense_total", fields.get("total_amount"))
        if amount not in (None, ""):
            try:
                amount = float(str(amount).replace(",", ""))
                if not 0 <= amount <= 100000000:
                    flag(item, "INVALID_AMOUNT", "The reviewed expense amount is outside the supported range.")
                elif incident.get("expenses") is not None and fields.get("currency") == incident.get("currency") and abs(amount - incident["expenses"]) > .01:
                    flag(item, "EXPENSE_AMOUNT_MISMATCH", "This reviewed expense total differs from the incident total in the same recorded currency. Check whether it is a partial invoice.")
            except (ValueError, TypeError):
                flag(item, "INVALID_AMOUNT", "The reviewed expense total is not numeric; retain the original and correct the field.")
    if policy and policy["family"] != "travel":
        warnings.append("This is an educational family checklist; exact policy-specific preparation rules are not reviewed.")
    return {"inconsistencies": issues, "warnings": warnings, "ready": not any(i["missing"] for i in checklist) and not issues}


def _prescreen(db, claim, policy):
    incident = json.loads(claim["incident_json"])
    checks = []
    if not policy:
        return {"result": "insufficient_information", "checks": [{"id": "policy", "status": "missing", "detail": "Policy was removed."}], "sources": [], "is_approval": False}
    current = bool(policy["confirmed"] and policy["revision"] == claim["policy_revision"])
    checks.append({"id": "verified_policy", "status": "pass" if current else "unresolved", "detail": "Policy confirmation and version must still match the case."})
    try:
        inside = date.fromisoformat(policy["start_date"]) <= date.fromisoformat(incident["date"]) <= date.fromisoformat(policy["end_date"])
        checks.append({"id": "policy_period", "status": "pass" if inside else "possible_exclusion", "detail": "Incident date is within the recorded policy period." if inside else "Incident date falls outside the recorded policy period. Ask the insurer; no automatic rejection is made."})
    except (ValueError, KeyError, TypeError):
        checks.append({"id": "policy_period", "status": "unresolved", "detail": "Confirm incident and policy dates."})
    fields = json.loads(policy["fields_json"])
    reviewed_terms = fields.get("reviewed_terms", [])
    waiting_term = next((t for t in reviewed_terms if isinstance(t, dict) and t.get("type") == "waiting" and t.get("provenance") == "user_reviewed" and _verified_fact_source(db, policy, t.get("source"))), None)
    waiting = {"known": False, "start": policy["start_date"], "eligible_from": None, "incident_date": incident.get("date"), "days": None, "satisfied": None, "source": None}
    waiting_days = fields.get("waiting_period_days")
    waiting_source = fields.get("waiting_period_source") or fields.get("critical_sources", {}).get("waiting_period_days")
    if waiting_days is None and waiting_term:
        try:
            waiting_days = float(waiting_term["value"])
            waiting_source = waiting_term["source"]
        except (ValueError, TypeError, KeyError):
            values = re.findall(r"(?<!\d)(\d{1,4})\s*(?:天|日|calendar\s+days|days)(?![A-Za-z])", str(waiting_term.get("value", "")), re.I)
            if len(set(values)) == 1:
                waiting_days = int(values[0])
                waiting_source = waiting_term["source"]
    if isinstance(waiting_days, (int, float)) and not isinstance(waiting_days, bool) and 0 <= waiting_days <= 3650 and int(waiting_days) == waiting_days and _verified_fact_source(db, policy, waiting_source):
        # A reviewed numeric field still needs its number to occur in the quoted
        # source. Dates and elapsed time are always computed by code.
        if re.search(r"(?<!\d)" + str(int(waiting_days)) + r"(?!\d)", str(waiting_source.get("quote", ""))):
            try:
                eligible = date.fromisoformat(policy["start_date"]) + timedelta(days=int(waiting_days))
                satisfied = date.fromisoformat(incident["date"]) >= eligible
                waiting.update(known=True, eligible_from=eligible.isoformat(), days=int(waiting_days), satisfied=satisfied, source=waiting_source)
                checks.append({"id": "waiting_period", "status": "pass" if satisfied else "possible_exclusion", "detail": f"Recorded start {policy['start_date']} + source-reviewed {int(waiting_days)} calendar days = {eligible.isoformat()}; incident {incident['date']}. The insurer must confirm the applicable cause / benefit."})
            except (ValueError, KeyError):
                pass
    if not waiting["known"]:
        checks.append({"id": "waiting_period", "status": "unresolved", "detail": "No source-verified waiting-period number is available for this benefit. No zero-day period is assumed."})
    exclusions = []
    for item in fields.get("exclusions", []) if isinstance(fields.get("exclusions"), list) else []:
        if isinstance(item, dict) and _verified_fact_source(db, policy, item.get("source")):
            exclusions.append({"text": item.get("text", item["source"]["quote"]), "source": item["source"], "status": "needs_insurer_interpretation"})
    for item in reviewed_terms:
        if isinstance(item, dict) and item.get("type") == "exclusion" and _verified_fact_source(db, policy, item.get("source")):
            exclusions.append({"text": item["source"]["quote"], "source": item["source"], "status": "needs_insurer_interpretation"})
    selected_benefit = _selected_outpatient_benefit(db, policy)
    checks.append({"id": "selected_benefit", "status": "pass" if selected_benefit else "unresolved", "detail": "The primary schedule contains a reviewed selected accidental-outpatient benefit line." if selected_benefit else "The applicable selected benefit is not established by the primary schedule; wording alone is not proof it was purchased."})
    destination = str(fields.get("destination", "")).lower()
    japan = str(incident.get("country", "")).lower() in ("japan", "jp", "日本")
    territory_known = japan and any(term in destination for term in ("japan", "日本", "worldwide", "全球", "asia", "亚洲"))
    checks.append({"id": "territory", "status": "pass" if territory_known else "unresolved", "detail": "Japan matches the confirmed schedule destination; contract exclusions remain to be checked." if territory_known else "The schedule territory does not establish this destination. Confirm with insurer."})
    supported = _policy_supported(db, policy) and claim["benefit"] == "outpatient_accident" and incident.get("treatment_type") == "outpatient"
    checks.append({"id": "reviewed_rule", "status": "pass" if supported else "unresolved", "detail": "Reviewed Allianz 2023 accident-outpatient preparation path." if supported else "This policy/benefit is outside the deeply reviewed hackathon path. Export a draft and ask the insurer for its checklist."})
    checks.append({"id": "contract_conditions", "status": "unresolved", "detail": "Selected benefits, reasonable/necessary expenses, hospital definition, exclusions and insurer assessment still apply."})
    result = "possible_exclusion" if any(c["status"] == "possible_exclusion" for c in checks) else "potentially_relevant" if current and supported and territory_known else "insufficient_information"
    exact = _policy_supported(db, policy)
    return {"result": result, "checks": checks, "waiting_period": waiting, "exclusions": exclusions, "expenses": {"reported": incident.get("expenses"), "currency": incident.get("currency"), "insurer_pays": None, "notice": "Reported expense is not an eligible or payable amount. No payout is estimated from an unverified limit."},
            "sources": [{"url": WORDING_URL, "section": "4.2-4.3", "pages": [11, 12]}] if exact else [], "is_approval": False,
            "notice": "For this wording, outpatient claims should notify assistance as soon as possible within 15 days; inpatient/medical transport needs immediate notice. Contact the insurer to confirm current instructions. Emergency care must not wait for evidence." if exact else "The exact policy reporting instructions are not reviewed here. Contact the official insurer promptly; do not delay emergency care or assume a universal deadline."}


def _verified_fact_source(db, policy, source):
    if not isinstance(source, dict) or not source.get("quote") or not source.get("document_id") or not isinstance(source.get("page"), int):
        return False
    from .documents import INJECTION
    if INJECTION.search(source["quote"]):
        return False
    row = db.execute("SELECT d.* FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE d.id=? AND d.user_id=? AND pd.policy_id=?", (source["document_id"], policy["user_id"], policy["id"])).fetchone()
    if not row or not _doc_valid(row):
        return False
    return any(p.get("page") == source["page"] and source["quote"] in p.get("text", "") for p in json.loads(row["pages_json"]))


def _view(db, claim, policy):
    evidence = _evidence(db, claim, policy)
    checklist = _checklist(db, claim, policy, evidence)
    current = bool(policy and policy["confirmed"] and claim["policy_revision"] == policy["revision"])
    actual = claim["status"] if current else "DRAFT"
    updates = [dict(r) for r in db.execute("SELECT id,provenance,document_id,note,event_at,created_at FROM claim_updates WHERE claim_id=? AND user_id=? ORDER BY created_at", (claim["id"], claim["user_id"]))]
    for update in updates:
        update["label"] = "User reported" if update["provenance"] == "user_reported" else "Acknowledgement uploaded - not insurer verified"
    simulations = [dict(r) | {"label": "SIMULATED", "is_simulated": True} for r in db.execute("SELECT id,stage,note,created_at FROM claim_simulations WHERE claim_id=? AND user_id=? ORDER BY created_at", (claim["id"], claim["user_id"]))]
    exports = [dict(r) | {"pdf_url": f"/api/exports/{r['id']}/pdf", "zip_url": f"/api/exports/{r['id']}/zip"} for r in db.execute("SELECT id,mode,created_at FROM workflow_exports WHERE claim_id=? AND user_id=? ORDER BY created_at DESC", (claim["id"], claim["user_id"]))]
    validation = _validation(claim, policy, checklist, evidence)
    tracker = tracking.build(db, claim, policy, checklist, evidence, exports, validation)
    return {"id": claim["id"], "policy_id": claim["policy_id"], "policy_revision": claim["policy_revision"], "current_policy_revision": policy["revision"] if policy else None,
            "policy_title": policy["title"] if policy else "Removed policy", "policy_family": policy["family"] if policy else "other", "revision": claim["revision"], "benefit": claim["benefit"], "incident": json.loads(claim["incident_json"]),
            "confirmed_revision": claim["confirmed_revision"] if current else None, "actual_status": actual, "status": actual, "checklist": checklist, "evidence": evidence,
            "missing": [x["category"] for x in checklist if x["missing"]], "prescreen": _prescreen(db, claim, policy), "updates": updates, "simulation": {"label": "SIMULATED - no insurer connection", "events": simulations},
            "exports": exports, "validation": validation, "tracker": tracker, "notifications": tracking.notifications(db, claim),
            "created_at": claim["created_at"], "updated_at": claim["updated_at"], "official_channel_url": CLAIM_CHANNEL_URL, "disclosure": DISCLOSURE}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Incident(StrictModel):
    date: str = Field(default="", max_length=10)
    country: str = Field(default="Japan", max_length=80)
    city: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=4000)
    treatment_type: Literal["outpatient", "inpatient", "unknown"] = "outpatient"
    police_involved: bool = False
    third_party_involved: bool = False
    applicant_role: Literal["insured", "guardian", "authorized_representative", "beneficiary"] = "insured"
    contact_phone: str = Field(default="", max_length=50)
    hospital: str = Field(default="", max_length=200)
    expenses: float | None = Field(default=None, ge=0, le=100000000)
    currency: str = Field(default="JPY", max_length=8)
    english_summary: str = Field(default="", max_length=4000)
    event_type: str = Field(default="", max_length=80)
    prior_reimbursement: bool = False
    disability: bool = False
    death: bool = False
    minor: bool = False


class ClaimCreate(StrictModel):
    policy_id: str = Field(min_length=1, max_length=100)
    benefit: str = Field(default="outpatient_accident", max_length=80)
    incident: Incident


class ClaimPatch(StrictModel):
    incident: Incident | None = None
    benefit: str | None = Field(default=None, max_length=80)
    expected_revision: int | None = Field(default=None, ge=1)


class EvidenceConfirmation(StrictModel):
    category: str = Field(min_length=1, max_length=80)
    confirmed: bool = False
    fields: dict[str, str | int | float | bool | None] = Field(default_factory=dict, max_length=30)


class ClaimConfirmation(StrictModel):
    revision: int
    confirmed_fields: list[str] = Field(max_length=20)
    confirmed: bool


class PreviewRequest(StrictModel):
    mode: Literal["prepared", "draft"] = "prepared"
    action: Literal["export_claim_package", "export_crossborder_kit"] = "export_claim_package"
    recipient: Literal["User download only"] = "User download only"


class ActionConfirmation(StrictModel):
    token: str = Field(min_length=16, max_length=200)
    confirmed: bool


class SimulationRequest(StrictModel):
    stage: Literal["RECEIVED", "IN_REVIEW", "INFO_REQUESTED", "ASSESSMENT", "APPROVED", "DECLINED", "PAID"] = "RECEIVED"


class UpdateRequest(StrictModel):
    provenance: Literal["user_reported", "acknowledgement_uploaded"]
    document_id: str | None = Field(default=None, max_length=100)
    note: str = Field(min_length=1, max_length=1000)
    event_at: str = Field(default="", max_length=50)


@router.get("/catalog")
@router.get("/products")
def catalog():
    return {"products": CATALOG, "disclosure": "Curated educational references, not a whole-market comparison or live quote. Proposed licensed partner workflow is simulated. No affiliation with the displayed insurers is claimed.", "reviewed_on": REVIEWED_ON}


@router.get("/emergency")
def emergency(country: str = Query("Japan", max_length=80), locale: str = Query("zh", max_length=10)):
    if country.lower() not in ("japan", "jp", "日本"):
        return {"country": country, "contacts": [], "cards": [], "notice": "This demo verifies Japan contacts only. Seek official local emergency information immediately; do not wait for insurance intake.", "is_live_transfer": False}
    return {"country": "Japan", "verified_on": REVIEWED_ON, "guest_access": True, "history_saved": False, "is_live_transfer": False,
            "notice": "If there is immediate danger, call local emergency services now. AI does not dispatch help, diagnose, guarantee cover or send this summary. No three-way interpretation or summary receipt is promised.",
            "contacts": [
                {"id": "ambulance", "name": "Ambulance / fire · 救护车 / 消防", "number": "119", "dial_uri": "tel:119", "role": "local_emergency", "source_url": "https://www.fdma.go.jp/publication/portal/items/portal001_pamphiet_english.pdf", "verified_on": REVIEWED_ON},
                {"id": "police", "name": "Police · 警察", "number": "110", "dial_uri": "tel:110", "role": "local_emergency", "source_url": JNTO_URL, "verified_on": REVIEWED_ON},
                {"id": "jnto", "name": "Japan Visitor Hotline · 日本游客热线", "number": "050-3816-2787", "international_number": "+81-50-3816-2787", "dial_uri": "tel:+815038162787", "role": "visitor_assistance", "languages": ["Chinese", "English", "Japanese", "Korean"], "availability": "24/7/365 per official information; routing not tested", "source_url": JNTO_URL, "verified_on": REVIEWED_ON}],
            "insurer_assistance": {"number": None, "instruction": "Use the number printed on your issued policy/service certificate. Product-specific channels differ; no unverified number is substituted.", "source_url": CLAIM_CHANNEL_URL},
            "official_forms": [{"label": "JNTO medical information form / 医疗信息表", "url": "https://www.jnto.go.jp/emergency/common/pdf/guide_chi02_p7.pdf"}, {"label": "JNTO symptom pointing card / 症状指示卡", "url": "https://www.jnto.go.jp/emergency/common/pdf/guide_chi02_p8.pdf"}, {"label": "Official medical facility search", "url": "https://www.jnto.go.jp/emergency/eng/mi_guide.html"}],
            "cards": [{"zh": "请叫救护车。", "en": "Please call an ambulance.", "ja": "救急車を呼んでください。"}, {"zh": "我需要医疗帮助。", "en": "I need medical help.", "ja": "医療の助けが必要です。"}, {"zh": "请联系我的保险救援机构。", "en": "Please help me contact my insurer's assistance service.", "ja": "保険会社のアシスタンスサービスへの連絡を手伝ってください。"}],
            "steps": ["Get to a safe place and seek appropriate care; do not delay emergency contact.", "When safe, note the time/location and retain original clinical and expense records.", "Contact the assistance provider named on your policy and follow its instructions.", "Review a factual summary before sharing it yourself."], "translation_notice": "Basic communication support only. Use official reviewed forms and clinicians for medical meaning."}


@router.post("/claims")
def create_claim(payload: ClaimCreate, user=Depends(current_user)):
    with get_db() as db:
        policy = _owned(db, "policies", payload.policy_id, user["id"])
        if not policy["confirmed"]:
            raise HTTPException(409, "Confirm critical policy information before personalized claim guidance.")
        claim_id, stamp = uid("clm_"), now_iso()
        db.execute("INSERT INTO claims VALUES(?,?,?,?,?,?,1,NULL,'DRAFT',?,?)", (claim_id, user["id"], policy["id"], policy["revision"], payload.benefit, _json(payload.incident.model_dump()), stamp, stamp))
        audit(db, user["id"], "claim_created", "claim", claim_id, {"policy_id": policy["id"]})
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.get("/claims")
def list_claims(user=Depends(current_user)):
    with get_db() as db:
        items = [_view(db, *_claim(db, r["id"], user["id"])) for r in db.execute("SELECT id FROM claims WHERE user_id=? ORDER BY updated_at DESC", (user["id"],))]
    return {"claims": items}


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str, user=Depends(current_user)):
    with get_db() as db:
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.get("/claims/{claim_id}/crossborder-kit")
def crossborder_kit(claim_id: str, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        view = _view(db, claim, policy)
        incident = view["incident"]
    contacts = emergency(country=incident.get("country", "Japan"), locale="zh")
    return {"claim_id": claim_id, "revision": claim["revision"], "reviewed": view["confirmed_revision"] == claim["revision"],
            "incident": incident, "english_summary": incident.get("english_summary") or f"Incident date: {incident.get('date', '')}. Country: {incident.get('country', '')}. City: {incident.get('city', '')}. Treatment: {incident.get('treatment_type', '')}. Reported words (original language): {incident.get('description', '')}",
            "contacts": contacts["contacts"], "cards": contacts.get("cards", []), "official_forms": contacts.get("official_forms", []),
            "translation_notice": "User-review required. The reported words remain in their original language unless the user adds and confirms an English summary. No certified translation, provider contact, report receipt or insurance guarantee is claimed.",
            "export_action": "export_crossborder_kit", "recipient": "User download only", "is_live_transfer": False, "official_insurer_channel": CLAIM_CHANNEL_URL}


@router.patch("/claims/{claim_id}")
def patch_claim(claim_id: str, payload: ClaimPatch, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        if payload.expected_revision is not None and payload.expected_revision != claim["revision"]:
            raise HTTPException(409, "Case changed. Reload and review the current version.")
        if not policy or not policy["confirmed"]:
            raise HTTPException(409, "Reconfirm the policy before updating the case.")
        db.execute("UPDATE claims SET incident_json=?,benefit=?,policy_revision=?,revision=revision+1,confirmed_revision=NULL,status='DRAFT',updated_at=? WHERE id=? AND user_id=?", (_json(payload.incident.model_dump()) if payload.incident else claim["incident_json"], payload.benefit or claim["benefit"], policy["revision"], now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "claim_changed_confirmations_invalidated", "claim", claim_id)
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.delete("/claims/{claim_id}")
def delete_claim(claim_id: str, confirmed: bool = Query(False), user=Depends(current_user)):
    if not confirmed:
        raise HTTPException(409, "Explicitly confirm deleting this case and its private generated packages.")
    with get_db() as db:
        _claim(db, claim_id, user["id"])
        for export in db.execute("SELECT pdf_path,zip_path FROM workflow_exports WHERE claim_id=? AND user_id=?", (claim_id, user["id"])):
            for key in ("pdf_path", "zip_path"):
                if not export[key]:
                    continue
                path = Path(export[key]).resolve()
                if EXPORT_DIR.resolve() in path.parents:
                    path.unlink(missing_ok=True)
        for document in db.execute("SELECT * FROM documents WHERE claim_id=? AND user_id=?", (claim_id, user["id"])).fetchall():
            if db.execute("SELECT 1 FROM policy_documents WHERE document_id=?", (document["id"],)).fetchone():
                db.execute("UPDATE documents SET claim_id=NULL WHERE id=? AND user_id=?", (document["id"], user["id"]))
                continue
            try:
                db.execute("DELETE FROM chunks_fts WHERE document_id=? AND user_id=?", (document["id"], user["id"]))
            except sqlite3.OperationalError:
                pass
            db.execute("DELETE FROM documents WHERE id=? AND user_id=?", (document["id"], user["id"]))
            path = Path(document["storage_path"]).resolve()
            if UPLOAD_DIR.resolve() in path.parents:
                path.unlink(missing_ok=True)
        for table in ("claim_evidence", "claim_updates", "claim_simulations", "workflow_exports", "claim_simulator_state", "claim_simulation_details", "claim_notifications"):
            db.execute(f"DELETE FROM {table} WHERE claim_id=? AND user_id=?", (claim_id, user["id"]))
        db.execute("DELETE FROM workflow_actions WHERE entity_id=? AND user_id=?", (claim_id, user["id"]))
        db.execute("DELETE FROM claims WHERE id=? AND user_id=?", (claim_id, user["id"]))
        chain.forget(db, "claim_package", claim_id)  # Erasure: the salt goes, so the on-chain root can no longer be linked to this case.
        audit(db, user["id"], "claim_and_local_packages_deleted", "claim", claim_id, {"retrieval_removed": True})
    return {"ok": True, "deleted_id": claim_id, "retrieval_removed": True, "notice": "Local case files and generated packages removed. Policy documents shared with the portfolio are retained there. No insurer submission existed to revoke."}


@router.put("/claims/{claim_id}/evidence/{document_id}")
def confirm_evidence(claim_id: str, document_id: str, payload: EvidenceConfirmation, user=Depends(current_user)):
    if payload.category not in CATEGORIES:
        raise HTTPException(422, "Select a supported evidence category.")
    if len(_json(payload.fields)) > 20000:
        raise HTTPException(422, "Evidence fields are too large.")
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        document = _owned(db, "documents", document_id, user["id"])
        if document["claim_id"] and document["claim_id"] != claim_id:
            raise HTTPException(409, "This document belongs to another case.")
        if not _doc_valid(document):
            raise HTTPException(409, "The original file is missing or changed. Upload it again.")
        if not policy or not policy["confirmed"] or policy["revision"] != claim["policy_revision"]:
            raise HTTPException(409, "Policy changed. Update the case and review it again.")
        if payload.category == "claim_form" and document["ocr_status"] == "generated_review_required" and payload.confirmed:
            existing = db.execute("SELECT fields_json FROM claim_evidence WHERE claim_id=? AND document_id=? AND user_id=?", (claim_id, document_id, user["id"])).fetchone()
            generated_revision = json.loads(existing["fields_json"]).get("claim_revision") if existing else None
            if generated_revision != claim["revision"]:
                raise HTTPException(409, "This generated form contains an earlier incident version. Generate and review a fresh form.")
            payload.fields["claim_revision"] = generated_revision
        db.execute("UPDATE documents SET claim_id=? WHERE id=? AND user_id=?", (claim_id, document_id, user["id"]))
        db.execute("INSERT INTO claim_evidence VALUES(?,?,?,?,?,?,?) ON CONFLICT(claim_id,document_id) DO UPDATE SET category=excluded.category,fields_json=excluded.fields_json,confirmed_revision=excluded.confirmed_revision", (claim_id, user["id"], document_id, payload.category, _json(payload.fields), claim["revision"] if payload.confirmed else None, now_iso()))
        # Replacing evidence invalidates the case-wide review and all prior previews.
        db.execute("UPDATE claims SET confirmed_revision=NULL,status='DRAFT',updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "evidence_user_confirmed" if payload.confirmed else "evidence_attached", "claim", claim_id, {"document_id": document_id, "category": payload.category})
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.delete("/claims/{claim_id}/evidence/{document_id}")
def remove_evidence(claim_id: str, document_id: str, user=Depends(current_user)):
    with get_db() as db:
        _claim(db, claim_id, user["id"])
        db.execute("DELETE FROM claim_evidence WHERE claim_id=? AND document_id=? AND user_id=?", (claim_id, document_id, user["id"]))
        db.execute("UPDATE claims SET confirmed_revision=NULL,status='DRAFT',updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "evidence_detached", "claim", claim_id, {"document_id": document_id})
    return {"ok": True}


@router.post("/claims/{claim_id}/confirm")
def confirm_claim(claim_id: str, payload: ClaimConfirmation, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        incident = json.loads(claim["incident_json"])
        if not payload.confirmed or payload.revision != claim["revision"] or not set(CRITICAL_FIELDS).issubset(payload.confirmed_fields):
            raise HTTPException(409, "Review every critical field in the current case version.")
        if incident.get("english_summary") and "english_summary" not in payload.confirmed_fields:
            raise HTTPException(409, "Explicitly review the English summary before confirming this case.")
        if not policy or not policy["confirmed"] or claim["policy_revision"] != policy["revision"]:
            raise HTTPException(409, "Policy confirmation is stale.")
        if not all(str(incident.get(key, "")).strip() for key in CRITICAL_FIELDS):
            raise HTTPException(422, "Complete date, country, incident description and treatment type.")
        try:
            date.fromisoformat(incident["date"])
        except ValueError:
            raise HTTPException(422, "Incident date must be a real ISO calendar date.")
        db.execute("UPDATE claims SET confirmed_revision=revision,updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "claim_critical_fields_confirmed", "claim", claim_id, {"revision": claim["revision"]})
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.post("/claims/{claim_id}/generate-form")
def generate_form(claim_id: str, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        if not policy:
            raise HTTPException(409, "Policy is no longer available.")
        incident = json.loads(claim["incident_json"])
        content = pdf_bytes("Claim application preparation / 理赔申请准备表", "User-generated draft - NOT the insurer's official form. Transfer these reviewed facts into the official form if required.", [("Policy reference", {"Policy": policy["title"], "Policy number": policy["policy_number"], "Insured": policy["insured_name"]}), ("Incident facts to review", incident), ("Declaration", "Review all facts and attachments. This document does not submit a claim, verify authority or replace a mandated insurer form. User signature/official format may be required."), ("Official channel", CLAIM_CHANNEL_URL)])
        document_id = uid("doc_")
        path = UPLOAD_DIR / f"{document_id}.pdf"
        path.write_bytes(content)
        extracted = "USER-GENERATED CLAIM PREPARATION FORM\n" + _json(incident)
        db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", (document_id, user["id"], "claim_form", claim_id, "claim-application-preparation.pdf", "application/pdf", len(content), str(path), _json([{"page": 1, "text": extracted}]), extracted, hashlib.sha256(content).hexdigest(), "generated_review_required", now_iso()))
        db.execute("INSERT INTO claim_evidence VALUES(?,?,?,?,?,NULL,?)", (claim_id, user["id"], document_id, "claim_form", _json({"claim_revision": claim["revision"]}), now_iso()))
        db.execute("UPDATE claims SET confirmed_revision=NULL,status='DRAFT',updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "claim_form_generated_review_required", "claim", claim_id, {"document_id": document_id})
    return {"document_id": document_id, "category": "claim_form", "file_url": f"/api/documents/{document_id}/file", "confirmed": False, "notice": "Read and confirm this preparation form. The insurer may require its own form and signature."}


def _snapshot(db, claim, policy, mode, action, recipient):
    view = _view(db, claim, policy)
    return {"claim_id": claim["id"], "revision": claim["revision"], "policy_revision": policy["revision"] if policy else None, "policy_confirmed": bool(policy and policy["confirmed"]), "confirmed_revision": view["confirmed_revision"],
            "policy": {k: policy[k] for k in ("id", "title", "policy_number", "insured_name", "start_date", "end_date", "fields_json")} if policy else None,
            "policy_files": _policy_files(db, policy),
            "incident": view["incident"], "benefit": claim["benefit"], "evidence": view["evidence"], "checklist": view["checklist"], "missing": view["missing"], "prescreen": view["prescreen"], "mode": mode, "action": action, "recipient": recipient,
            "not_submitted": True}


def _make_token(db, user_id, entity_id, action, payload, snapshot_hash):
    # Expired review snapshots have no ongoing purpose. Keep only the one active
    # ten-minute approval payload; consumed approvals retain a replay tombstone.
    db.execute("DELETE FROM workflow_actions WHERE user_id=? AND expires_at<=?", (user_id, time.time()))
    token = secrets.token_urlsafe(32)
    expires = time.time() + 600
    db.execute("INSERT INTO workflow_actions VALUES(?,?,?,?,?,?,?,NULL,?)", (hashlib.sha256(token.encode()).hexdigest(), user_id, entity_id, action, _json(payload), snapshot_hash, expires, now_iso()))
    return {"token": token, "expires_at": datetime.fromtimestamp(expires, timezone.utc).isoformat(), "payload": payload, "single_use": True}


def _read_token(db, token, user_id, action=None):
    row = db.execute("SELECT * FROM workflow_actions WHERE token_hash=? AND user_id=?", (hashlib.sha256(token.encode()).hexdigest(), user_id)).fetchone()
    if not row or row["used_at"] or row["expires_at"] <= time.time() or (action and row["action"] != action):
        raise HTTPException(409, "Confirmation expired, was used, or belongs to a different action. Review again.")
    return dict(row)


@router.post("/claims/{claim_id}/preview")
def preview_claim(claim_id: str, payload: PreviewRequest, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        snapshot = _snapshot(db, claim, policy, payload.mode, payload.action, payload.recipient)
        if payload.mode == "prepared":
            if not policy or not policy["confirmed"] or claim["policy_revision"] != policy["revision"] or claim["confirmed_revision"] != claim["revision"]:
                raise HTTPException(409, "Confirm the current policy and all case facts before a prepared package. A labelled draft can still be exported.")
            if snapshot["missing"]:
                raise HTTPException(409, {"message": "Required evidence is missing or not user-confirmed.", "missing": snapshot["missing"]})
            validation = _validation(claim, policy, snapshot["checklist"], snapshot["evidence"])
            if validation["inconsistencies"]:
                raise HTTPException(409, {"message": "Resolve reviewed document inconsistencies first.", "inconsistencies": validation["inconsistencies"]})
            if not _policy_supported(db, policy) or claim["benefit"] != "outpatient_accident" or snapshot["incident"].get("treatment_type") != "outpatient":
                raise HTTPException(409, "This contract/benefit needs a reviewed insurer-specific checklist. Export a labelled draft.")
        # Claim facts already live in the owned case; approval storage needs only
        # action controls plus a hash, not another persistent copy of health data.
        controls = {"mode": payload.mode, "action": payload.action, "recipient": payload.recipient}
        result = _make_token(db, user["id"], claim_id, payload.action, controls, _hash(snapshot))
        result["payload"] = snapshot
        audit(db, user["id"], "export_preview_created", "claim", claim_id, {"mode": payload.mode, "action": payload.action, "document_count": len(snapshot["evidence"])})
    return result | {"missing": snapshot["missing"], "disclosure": "Download only. No documents will be sent to an insurer, agent, emergency service or any other recipient."}


def _claim_sections(snapshot):
    return [("Status / 状态", "PREPARED - NOT SUBMITTED" if snapshot["mode"] == "prepared" else "INCOMPLETE DRAFT - NOT SUBMITTED"),
            ("Policy information / 保单信息", {k: v for k, v in (snapshot["policy"] or {}).items() if k not in ("fields_json", "id")}),
            ("User-reviewed incident / 用户核对事故事实", snapshot["incident"]),
            ("English assistance summary - user-reviewed; reported words preserved", snapshot['incident'].get('english_summary') or f"The insured reports an incident on {snapshot['incident'].get('date', 'unknown date')} in {snapshot['incident'].get('city', '')}, {snapshot['incident'].get('country', '')}. Treatment type: {snapshot['incident'].get('treatment_type', '')}. Reported words (original language, not automatically translated): {snapshot['incident'].get('description', '')}. This is not a medical diagnosis, certified translation or coverage decision."),
            ("Evidence index / 材料目录", [{"category": e["category"], "name": e["name"], "user_confirmed": e["confirmed"], "original_available": e["exists"], "sha256": e["sha256"]} for e in snapshot["evidence"]]),
            ("Missing evidence / 缺失材料", snapshot["missing"] or ["None against this preparation checklist; insurer may request more."]),
            ("Conditional clause checks - not an approval", snapshot["prescreen"]["checks"]),
            ("Originals and translation", "Original user files are separate from this generated summary. Keep original expense evidence. AI language support does not establish insurer acceptance or certified translation."),
            ("Official source / 官方来源", [WORDING_URL, "Wording sections 4.2-4.3, pages 11-12; issued schedule and endorsements govern.", CLAIM_CHANNEL_URL]),
            ("Next action", "Use the insurer's current official channel and transfer the reviewed facts into its mandated application form. Downloading/exporting does not establish receipt, acceptance, approval or payment.")]


@router.post("/claims/{claim_id}/export")
def export_claim(claim_id: str, payload: ActionConfirmation, user=Depends(current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Explicit confirmation is required.")
    with get_db() as db:
        # A write lock makes single use atomic against concurrent requests.
        db.execute("BEGIN IMMEDIATE")
        token = _read_token(db, payload.token, user["id"])
        if token["entity_id"] != claim_id or token["action"] not in ("export_claim_package", "export_crossborder_kit"):
            raise HTTPException(409, "This confirmation is not for this case/export.")
        reviewed = json.loads(token["payload_json"])
        claim, policy = _claim(db, claim_id, user["id"])
        current = _snapshot(db, claim, policy, reviewed["mode"], token["action"], reviewed["recipient"])
        if _hash(current) != token["snapshot_hash"]:
            raise HTTPException(409, "Policy, incident, evidence or review changed. Preview and confirm the new package.")
        export_id = uid("exp_")
        title = "Cross-border assistance kit / 跨境协助资料" if token["action"] == "export_crossborder_kit" else "Claim preparation package / 理赔准备资料"
        sections = _claim_sections(current)
        if token["action"] == "export_crossborder_kit":
            # Call endpoint helpers with actual arguments: FastAPI's Query
            # defaults are dependency descriptors when invoked as plain Python.
            country = current["incident"].get("country", "Japan")
            public = emergency(country=country, locale="zh")
            sections += [(f"Destination help contacts - {country}", [{"name": c["name"], "number": c["number"], "source": c["source_url"]} for c in public.get("contacts", [])] or [public["notice"]]), ("Official communication forms", public.get("official_forms", []) or ["No reviewed communication form is available for this destination."]), ("No provider contact", "This kit was downloaded by the user only. No call, transfer or report delivery occurred.")]
        content = pdf_bytes(title, f"WeWise | {now_iso()} | {current['mode'].upper()} | Recipient: User download only", sections)
        pdf_path, zip_path = EXPORT_DIR / f"{export_id}.pdf", EXPORT_DIR / f"{export_id}.zip"
        documents = []
        selected = {e["document_id"] for e in current["evidence"] if e["exists"]}
        if policy:
            selected.add(policy["document_id"])
            selected.update(r["document_id"] for r in db.execute("SELECT document_id FROM policy_documents WHERE policy_id=?", (policy["id"],)))
        for identifier in sorted(selected):
            document = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (identifier, user["id"])).fetchone()
            if document and _doc_valid(document):
                documents.append(dict(document))
        manifest = current | {"created_at": now_iso(), "files": [{"id": d["id"], "name": d["name"], "sha256": d["sha256"]} for d in documents]}
        # Fingerprint every file in the package and anchor only the Merkle root (no claim data leaves the store).
        files = [("01-reviewed-summary.pdf", hashlib.sha256(content).hexdigest()), ("02-manifest.json", hashlib.sha256(manifest_bytes(manifest)).hexdigest())]
        files += [(archive_name(i, d), d["sha256"]) for i, d in enumerate(documents, 1)]
        proof = chain.anchor_package(db, user["id"], claim_id, files)
        archive = zip_bytes(content, manifest, documents, proof)
        pdf_path.write_bytes(content)
        zip_path.write_bytes(archive)
        db.execute("INSERT INTO workflow_exports VALUES(?,?,?,?,?,?,?,?,?,?)", (export_id, user["id"], claim_id, token["action"], current["mode"], str(pdf_path), str(zip_path), _json(manifest), hashlib.sha256(content).hexdigest(), now_iso()))
        db.execute("UPDATE workflow_actions SET used_at=?,payload_json='{}' WHERE token_hash=? AND user_id=? AND used_at IS NULL", (now_iso(), token["token_hash"], user["id"]))
        if current["mode"] == "prepared":
            db.execute("UPDATE claims SET status='PREPARED_NOT_SUBMITTED',updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "claim_package_exported_not_submitted", "claim", claim_id, {"export_id": export_id, "mode": current["mode"], "document_count": len(documents)})
    return {"export_id": export_id, "pdf_url": f"/api/exports/{export_id}/pdf", "zip_url": f"/api/exports/{export_id}/zip", "actual_status": "PREPARED_NOT_SUBMITTED" if current["mode"] == "prepared" else "DRAFT", "mode": current["mode"], "submitted": False, "recipient": "User download only", "sha256": hashlib.sha256(content).hexdigest(),
            "proof": {k: proof[k] for k in ("root", "status", "network", "contract", "real_chain", "tx_hash", "block", "version", "anchored_at", "explorer_tx", "explorer_contract") if k in proof} if proof else None}


@router.get("/exports/{export_id}/{format}")
def download_export(export_id: str, format: Literal["pdf", "zip"], user=Depends(current_user)):
    with get_db() as db:
        export = _owned(db, "workflow_exports", export_id, user["id"])
        value = export["pdf_path"] if format == "pdf" else export["zip_path"]
        if not value:
            raise HTTPException(404, "This export has no ZIP.")
        path = Path(value).resolve()
        try:
            path.relative_to(EXPORT_DIR.resolve())
        except ValueError:
            raise HTTPException(404, "Not found.")
        if not path.is_file():
            raise HTTPException(404, "The export was removed.")
        audit(db, user["id"], "private_export_downloaded", "export", export_id, {"format": format})
    return FileResponse(path, filename=f"wewise-{export_id}.{format}", media_type="application/pdf" if format == "pdf" else "application/zip", headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/claims/{claim_id}/updates")
def add_update(claim_id: str, payload: UpdateRequest, user=Depends(current_user)):
    with get_db() as db:
        _claim(db, claim_id, user["id"])
        if payload.provenance == "acknowledgement_uploaded":
            if not payload.document_id:
                raise HTTPException(422, "Attach the acknowledgement file.")
            document = _owned(db, "documents", payload.document_id, user["id"])
            if not _doc_valid(document):
                raise HTTPException(409, "Acknowledgement original is unavailable.")
            if document["claim_id"] and document["claim_id"] != claim_id:
                raise HTTPException(409, "This acknowledgement belongs to another case.")
        event_at = payload.event_at or now_iso()
        db.execute("INSERT INTO claim_updates VALUES(?,?,?,?,?,?,?,?)", (uid("upd_"), claim_id, user["id"], payload.provenance, payload.document_id, payload.note, event_at, now_iso()))
        audit(db, user["id"], "user_sourced_status_added", "claim", claim_id, {"provenance": payload.provenance})
        return _view(db, *_claim(db, claim_id, user["id"]))


@router.post("/claims/{claim_id}/simulation")
def simulate_claim(claim_id: str, payload: SimulationRequest, user=Depends(current_user)):
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        claim, _ = _claim(db, claim_id, user["id"])
        tracking.playback(db, claim, payload.stage)
        audit(db, user["id"], "isolated_insurer_simulation", "claim", claim_id, {"stage": payload.stage, "is_simulated": True})
        return _view(db, *_claim(db, claim_id, user["id"]))


class SimulationTransition(StrictModel):
    stage: Literal["IN_REVIEW", "INFO_REQUESTED", "ASSESSMENT", "APPROVED", "DECLINED", "APPEAL_REQUESTED", "PAID"]
    confirmed: bool


class SimulationAdvance(StrictModel):
    days: int = Field(ge=1, le=30)
    outcome: Literal["approved", "declined"] = "approved"


@router.post("/claims/{claim_id}/simulation/submit-preview")
def preview_simulated_submission(claim_id: str, user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        snapshot = _snapshot(db, claim, policy, "prepared", "simulate_claim_submit", "SIMULATED insurer only")
        validation = _validation(claim, policy, snapshot["checklist"], snapshot["evidence"])
        if not policy or not policy["confirmed"] or claim["policy_revision"] != policy["revision"] or claim["confirmed_revision"] != claim["revision"] or not validation["ready"]:
            raise HTTPException(409, "Prepare and review the current case first. The separate preset scenario can still demonstrate insurer stages without asserting readiness.")
        controls = {"mode": "prepared", "recipient": "SIMULATED insurer only", "action": "simulate_claim_submit"}
        result = _make_token(db, user["id"], claim_id, "simulate_claim_submit", controls, _hash(snapshot))
        preview = {"recipient": "SIMULATED insurer only", "action": "Create a synthetic simulator receipt; nothing is sent externally", "claim_id": claim_id, "revision": claim["revision"], "documents": [{"category": e["category"], "name": e["name"]} for e in snapshot["evidence"]], "is_simulated": True}
        result.update(preview=preview, payload=preview)
        return result


@router.post("/claims/{claim_id}/simulation/submit")
def confirm_simulated_submission(claim_id: str, payload: ActionConfirmation, user=Depends(current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Explicitly confirm the simulated action.")
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        claim, policy = _claim(db, claim_id, user["id"])
        hashed = hashlib.sha256(payload.token.encode()).hexdigest()
        existing = tracking.state(db, claim)
        # The same confirmed operation is idempotent even after its short-lived
        # review token expires. A different user's token cannot find this row.
        if existing and existing["confirmation_hash"] == hashed:
            return _view(db, claim, policy)
        token = _read_token(db, payload.token, user["id"], "simulate_claim_submit")
        if token["entity_id"] != claim_id:
            raise HTTPException(409, "This confirmation is for a different case.")
        snapshot = _snapshot(db, claim, policy, "prepared", "simulate_claim_submit", "SIMULATED insurer only")
        if _hash(snapshot) != token["snapshot_hash"]:
            raise HTTPException(409, "Case or documents changed. Review a fresh simulation preview.")
        if existing:
            raise HTTPException(409, "A simulator receipt already exists for this case. Continue its existing timeline.")
        tracking.start(db, claim, token_hash=hashed, mode="user_confirmed_demo")
        tracking.transition(db, claim, "RECEIVED")
        db.execute("UPDATE workflow_actions SET used_at=?,payload_json='{}' WHERE token_hash=? AND user_id=?", (now_iso(), hashed, user["id"]))
        audit(db, user["id"], "simulated_submission_confirmed_no_external_delivery", "claim", claim_id, {"is_simulated": True})
        return _view(db, claim, policy)


@router.post("/claims/{claim_id}/simulation/transition")
def transition_simulator(claim_id: str, payload: SimulationTransition, user=Depends(current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Confirm this simulator change.")
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        claim, policy = _claim(db, claim_id, user["id"])
        tracking.transition(db, claim, payload.stage)
        audit(db, user["id"], "simulated_stage_transition", "claim", claim_id, {"stage": payload.stage, "is_simulated": True})
        return _view(db, claim, policy)


@router.post("/claims/{claim_id}/simulation/advance")
def advance_simulator(claim_id: str, payload: SimulationAdvance, user=Depends(current_user)):
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        claim, policy = _claim(db, claim_id, user["id"])
        tracking.advance(db, claim, payload.days, payload.outcome)
        audit(db, user["id"], "simulation_clock_advanced", "claim", claim_id, {"days": payload.days, "is_simulated": True})
        return _view(db, claim, policy)


@router.get("/claims/{claim_id}/explanation")
def explain_claim_status(claim_id: str, mode: Literal["actual", "simulation"] = "actual", user=Depends(current_user)):
    with get_db() as db:
        claim, policy = _claim(db, claim_id, user["id"])
        clause = None
        for document in _policy_files(db, policy):
            if document["is_wording"] and document["exists"]:
                row = _owned(db, "documents", document["document_id"], user["id"])
                page = next((p for p in json.loads(row["pages_json"]) if p["page"] == 12), None)
                quote = next((line.strip() for line in page["text"].splitlines() if "医疗费用原始凭证" in line), None) if page else None
                if quote:
                    clause = {"document_id": document["document_id"], "page": 12, "section": "4.3", "quote": quote, "source_url": WORDING_URL, "notice": "Actual source document requirement; it does not make the synthetic decision an actual insurer decision."}
                    break
        return tracking.explanation(db, claim, mode, CLAIM_CHANNEL_URL, WORDING_URL, clause)


@router.post("/claims/{claim_id}/notifications/{notification_id}/ack")
def acknowledge_notification(claim_id: str, notification_id: str, user=Depends(current_user)):
    with get_db() as db:
        claim, _ = _claim(db, claim_id, user["id"])
        row = db.execute("SELECT id FROM claim_notifications WHERE id=? AND claim_id=? AND user_id=?", (notification_id, claim_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Notification not found.")
        db.execute("UPDATE claim_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND claim_id=? AND user_id=?", (now_iso(), notification_id, claim_id, user["id"]))
        return {"ok": True, "notifications": tracking.notifications(db, claim)}


@router.get("/claims/{claim_id}/notifications")
def list_notifications(claim_id: str, user=Depends(current_user)):
    with get_db() as db:
        claim, _ = _claim(db, claim_id, user["id"])
        return {"notifications": tracking.notifications(db, claim)}


@router.get("/incidents")
def incidents(family: str = Query("", max_length=40), country: str = Query("China", max_length=80)):
    return incident_library(family, country)


class Needs(StrictModel):
    family: str = Field(default="travel", max_length=40)
    budget: float | None = Field(default=None, ge=0, le=10000000)
    destination: str = Field(default="Japan", max_length=80)
    priorities: list[str] = Field(default_factory=lambda: ["accidental_medical", "emergency_assistance"], max_length=20)
    purpose: str = Field(default="leisure", max_length=100)
    notes: str = Field(default="", max_length=2000)
    goal: str = Field(default="", max_length=300)
    dependants: int = Field(default=0, ge=0, le=30)
    risk_tolerance: Literal["low", "medium", "high", "unspecified"] = "unspecified"
    age: int | None = Field(default=None, ge=0, le=120)
    occupation: str = Field(default="", max_length=120)
    existing_cover: str = Field(default="", max_length=1000)
    language: str = Field(default="zh", max_length=10)
    city: str = Field(default="", max_length=100)


class ReviewedTerms(StrictModel):
    product_id: str = Field(default="", max_length=100)
    limit: float | None = Field(default=None, ge=0, le=1000000000)
    deductible: float | None = Field(default=None, ge=0, le=1000000000)
    coinsurance_percent: float | None = Field(default=None, ge=0, le=100)
    premium: float | None = Field(default=None, ge=0, le=1000000000)
    waiting_days: int | None = Field(default=None, ge=0, le=3650)
    eligible: bool | None = None
    confirmed: bool = False
    source_note: str = Field(default="", max_length=1000)


class CostScenario(StrictModel):
    bill_amount: float = Field(ge=0, le=1000000000)
    currency: Literal["CNY", "JPY", "USD"] = "CNY"
    terms: list[ReviewedTerms] = Field(default_factory=list, max_length=3)


class CompareRequest(StrictModel):
    needs: Needs
    scenario: CostScenario | None = None


class Contact(StrictModel):
    name: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=50)


class BriefPreview(StrictModel):
    needs: Needs
    selected_product_ids: list[str] = Field(default_factory=list, max_length=5)
    contact: Contact = Field(default_factory=Contact)
    consent_to_include_contact: bool = False
    agent_id: str | None = Field(default=None, max_length=100)


class CallbackRequest(StrictModel):
    brief_export_id: str = Field(max_length=100)
    confirmed: bool


class SellingCheck(StrictModel):
    text: str = Field(min_length=1, max_length=6000)


@router.post("/buying/compare")
def compare_products(payload: CompareRequest, user=Depends(current_user)):
    needs = payload.needs.model_dump()
    priorities = sorted(set(needs["priorities"]))
    if any(len(p) > 80 for p in priorities):
        raise HTTPException(422, "Priority is too long.")
    products = []
    for product in CATALOG:
        if product["family"] != needs["family"]:
            continue
        matched = [p for p in priorities if p in product["benefits"]]
        unknown = [p for p in priorities if p not in product["benefits"]]
        products.append(product | {"score": len(matched), "score_basis": "One point per requested feature documented in this limited source catalogue; no price, claims-friction or payout score is invented.", "matched_priorities": matched,
                                   "unresolved_priorities": unknown, "affordability": "Unknown - obtain an official quote", "explanation": f"{len(matched)} of {len(priorities)} requested source-described features matched. Limits, exclusions, eligibility and suitability require licensed review."})
    products.sort(key=lambda x: (-x["score"], x["id"]))
    with get_db() as db:
        audit(db, user["id"], "catalogue_comparison_computed", "comparison", None, {"family": needs["family"], "product_count": len(products)})
        db.execute("INSERT INTO buying_needs VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET needs_json=excluded.needs_json,updated_at=excluded.updated_at", (user["id"], _json(needs), now_iso()))
        existing = [dict(row) for row in db.execute("SELECT id,title,family,confirmed,end_date FROM policies WHERE user_id=? AND family=?", (user["id"], needs["family"]))]
    debate = comparison(products, needs, payload.scenario.model_dump() if payload.scenario else None)
    return {"needs": needs, "products": products, "criteria": priorities, "existing_cover": existing, "existing_cover_notice": "Your existing cover may already meet this need. Review it before considering another policy.",
            **debate, "disclosure": "Educational comparison of a limited reference catalogue. Not licensed advice, a live quote or proof of current sale. A proposed licensed partner must perform suitability and final advice. Commercial commission does not affect this score."}


@router.post("/buying/compare/debate")
async def compare_debate(payload: CompareRequest, user=Depends(current_user)):
    """Same comparison, with AI advocates (one checked model call per product) when a model is configured."""
    from . import advocates
    return await advocates.debate(await asyncio.to_thread(compare_products, payload, user))


@router.get("/buying/needs")
def saved_buying_needs(user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT needs_json,updated_at FROM buying_needs WHERE user_id=?", (user["id"],)).fetchone()
        return {"needs": json.loads(row["needs_json"]) if row else None, "updated_at": row["updated_at"] if row else None, "source": "User-entered buying form, not automatically approved long-term memory"}


@router.delete("/buying/needs")
def delete_saved_buying_needs(user=Depends(current_user)):
    with get_db() as db:
        db.execute("DELETE FROM buying_needs WHERE user_id=?", (user["id"],))
        audit(db, user["id"], "buying_form_defaults_deleted", "buying")
    return {"ok": True, "notice": "Current saved buying-form defaults deleted. Exported briefs and approved memory are separate and can be managed independently."}


class CostEstimate(StrictModel):
    bill_amount: float = Field(ge=0, le=1000000000)
    currency: Literal["CNY", "JPY", "USD"] = "CNY"
    terms: ReviewedTerms


@router.post("/buying/cost-estimate")
def cost_estimate(payload: CostEstimate, user=Depends(current_user)):
    return estimate_cost(payload.bill_amount, payload.currency, payload.terms.model_dump())


@router.get("/buying/agents")
def demo_agent_directory(language: str = Query("zh", max_length=10), city: str = Query("", max_length=100)):
    return match_agents(language, city)


@router.post("/buying/mis-selling-check")
def check_selling(payload: SellingCheck):
    # Bounded surface patterns only. Mask a few explicit negations so ordinary
    # warnings such as "不能保证赔付" and "无需立即购买" do not become sales flags.
    screened = re.sub(r"(?:不能|无法|不会|不应|不作|不做|不)(?:提供|作出)?(?:任何)?(?:保证|承诺|确保)[^。！？!?\n，,；;]{0,24}(?:赔付|理赔|获赔|赔偿|收益|赔)", "", payload.text)
    screened = re.sub(r"\b(?:no|not|never|cannot|can't|do not|don't)\s+(?:a\s+)?guarantee(?:d|s)?[^.!?\n,;]{0,40}(?:claim|payout|payment|return|coverage)\b", "", screened, flags=re.I)
    screened = re.sub(r"(?:不要|不得|不可|不能|勿)\s*隐瞒", "", screened)
    screened = re.sub(r"\b(?:do not|don't|never)\s+(?:hide|conceal)\s+(?:your\s+)?(?:condition|illness|medical history)\b", "", screened, flags=re.I)
    screened = re.sub(r"(?:不用|不必|不需要|不要|无需|不应|不能|不得)\s*(?:今天|今日|现在|马上|立即|立刻)?\s*(?:购买|投保|签约|下单)", "", screened)
    screened = re.sub(r"\b(?:no need to|do not|don't|not required to)\s+(?:buy|sign|purchase)\s+(?:now|today|immediately)\b", "", screened, flags=re.I)
    rules = [("guaranteed_payout", r"\bguarantee(?:d|s)?(?:\s+(?:a|your|the|full|100%|successful|all)){0,4}\s+(?:claim|payout|payment|return|coverage)\b|\b100\s*%\s+guaranteed\b|(?:保证|承诺|确保)[^。！？!?\n，,；;]{0,16}(?:赔付|理赔|获赔|赔偿|收益)|(?:一定|肯定|必定|必然|绝对)(?:会|能|可以)?(?:赔|获赔|理赔)|保证赔|包赔|(?:百分之百|100\s*[%％])[^。！？!?\n，,；;]{0,6}(?:赔付|获赔|理赔)", "An unsupported guarantee needs contract evidence and licensed review."),
             ("non_disclosure", r"(?:do not|don't|no need to|need not|don't need to|do not need to)\s+(?:fully\s+|truthfully\s+)?(?:disclose|mention|declare)|(?:hide|conceal)\s+(?:your\s+)?(?:condition|illness|medical history)|(?:不用|无需|不必|不要|可以不|不需要)\s*(?:如实|主动|全部|完全)?\s*(?:告知|申报|披露)|隐瞒", "Do not omit requested facts or encourage non-disclosure."),
             ("pressure", r"\b(?:buy|sign|purchase)\s+(?:now|today|immediately)\b|\b(?:must|have to)\s+(?:buy|sign|purchase)\b|\bact\s+now\b|(?:今天|今日|现在|马上|立即|立刻)\s*(?:就|必须|务必|一定要|得)?\s*(?:购买|投保|签约|下单)|(?:必须|务必|一定要)\s*(?:今天|今日|现在|马上|立即|立刻)?\s*(?:购买|投保|签约|下单)|马上签|最后机会", "Pressure language can prevent informed comparison; request time and written terms."),
             ("universal_best", r"best for everyone|适合所有人|最便宜[^。！？!?\n]{0,30}最好", "Suitability depends on the person's needs; cheapest is not automatically best.")]
    flags = [{"id": key, "message": message} for key, pattern, message in rules if re.search(pattern, screened, re.I)]
    return {"flags": flags, "result": "review_needed" if flags else "no_pattern_detected", "notice": "Pattern screening only; absence of a flag does not prove compliance or suitability. No text is saved."}


@router.post("/buying/brief/preview")
def preview_brief(payload: BriefPreview, user=Depends(current_user)):
    known = {p["id"] for p in CATALOG}
    if any(p not in known for p in payload.selected_product_ids):
        raise HTTPException(422, "Unknown product reference.")
    if any(payload.contact.model_dump().values()) and not payload.consent_to_include_contact:
        raise HTTPException(409, "Explicitly approve including selected contact information.")
    matched_agent = next((a for a in DEMO_AGENTS if a["id"] == payload.agent_id), None) if payload.agent_id else None
    if payload.agent_id and not matched_agent:
        raise HTTPException(422, "Unknown demonstration agent.")
    snapshot = {"needs": payload.needs.model_dump(), "selected_product_ids": payload.selected_product_ids, "contact": payload.contact.model_dump() if payload.consent_to_include_contact else {}, "consent_to_include_contact": payload.consent_to_include_contact,
                "recipient": "User download only", "matched_demo_agent": matched_agent, "excluded": ["Original medical records", "Financial statements", "Full portfolio", "Conversation history", "Personal memory"], "no_external_delivery": True, "partner_status": "Proposed licensed partner demonstration - no real partner connection"}
    with get_db() as db:
        result = _make_token(db, user["id"], "buying_brief", "export_agent_brief", snapshot, _hash(snapshot))
        audit(db, user["id"], "agent_brief_preview_created", "buying")
    return result | {"disclosure": "Download only. No lead, callback request or contact information is sent externally."}


@router.post("/buying/brief/export")
def export_brief(payload: ActionConfirmation, user=Depends(current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Review and explicitly confirm the brief.")
    with get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        token = _read_token(db, payload.token, user["id"], "export_agent_brief")
        snapshot = json.loads(token["payload_json"])
        if _hash(snapshot) != token["snapshot_hash"]:
            raise HTTPException(409, "Brief changed. Preview again.")
        products = [p for p in CATALOG if p["id"] in snapshot["selected_product_ids"]]
        content = pdf_bytes("Agent conversation brief / 代理人沟通摘要", "USER DOWNLOAD ONLY - proposed licensed-partner demonstration. No lead delivered or sale occurred.", [("Customer-reviewed needs", snapshot["needs"]), ("Selected contact details", snapshot["contact"]), ("Product references to discuss - not advice", [{"name": p["name"], "source": p["source_url"], "quote": "Official quote required"} for p in products]), ("Excluded information", snapshot["excluded"]), ("Questions for a licensed agent", ["Does existing cover already meet the need?", "Confirm eligibility, exclusions, deductible, limits, affordability and exact wording.", "Explain why a suitable option fits, including reasons not to buy."]), ("Next step", "User chooses whether and where to share this brief. The platform has not transmitted it.")])
        export_id, path = uid("exp_"), EXPORT_DIR / f"{uid('brief_')}.pdf"
        path.write_bytes(content)
        db.execute("INSERT INTO workflow_exports VALUES(?,?,NULL,'export_agent_brief','reviewed',?,NULL,?,?,?)", (export_id, user["id"], str(path), _json(snapshot), hashlib.sha256(content).hexdigest(), now_iso()))
        db.execute("UPDATE workflow_actions SET used_at=?,payload_json='{}' WHERE token_hash=? AND user_id=?", (now_iso(), token["token_hash"], user["id"]))
        audit(db, user["id"], "agent_brief_exported_not_delivered", "export", export_id)
    return {"export_id": export_id, "pdf_url": f"/api/exports/{export_id}/pdf", "delivered": False, "recipient": "User download only", "callback_simulation_available": True}


@router.post("/buying/callback")
def simulated_callback(payload: CallbackRequest, user=Depends(current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Confirm the simulated callback request.")
    with get_db() as db:
        export = _owned(db, "workflow_exports", payload.brief_export_id, user["id"])
        if export["kind"] != "export_agent_brief":
            raise HTTPException(422, "A reviewed agent brief is required.")
        callback_id = uid("sim_callback_")
        db.execute("INSERT INTO buying_callbacks VALUES(?,?,?,?)", (callback_id, user["id"], export["id"], now_iso()))
        audit(db, user["id"], "callback_simulated_no_external_delivery", "callback", callback_id, {"is_simulated": True})
    return {"id": callback_id, "label": "SIMULATED CALLBACK REQUEST", "is_simulated": True, "delivered": False, "notice": "No agent was contacted. No callback time or real service is promised."}


@router.get("/renewals")
def renewal_reminders(user=Depends(current_user)):
    today = datetime.now(timezone(timedelta(hours=8))).date()
    items = []
    with get_db() as db:
        for row in db.execute("SELECT id,title,end_date,confirmed FROM policies WHERE user_id=? ORDER BY end_date", (user["id"],)):
            try:
                days = (date.fromisoformat(row["end_date"]) - today).days
            except ValueError:
                continue
            if days <= 60:
                history = _premium_history(db, row["id"], user["id"])
                items.append(dict(row) | {"days_until_expiry": days, "state": "expired" if days < 0 else "review_due", "steps": ["Reconfirm changed circumstances", "Review existing and proposed cover", "Discuss with licensed agent", "Record a new policy only after issuance evidence"], "premium_history": history["entries"], "hikes": history["hikes"], "hike_warning": bool(history["hikes"]), "renewed": False})
    return {"date_basis": today.isoformat(), "timezone": "Asia/Shanghai", "reminders": items, "notice": "A reminder or handoff does not renew, extend or issue a policy."}


def _premium_history(db, policy_id, user_id):
    entries = [dict(row) for row in db.execute("SELECT id,year,premium,currency,source_note,document_id,provenance,created_at FROM policy_premium_history WHERE policy_id=? AND user_id=? ORDER BY year,currency", (policy_id, user_id))]
    hikes, previous = [], {}
    for entry in entries:
        before = previous.get(entry["currency"])
        if before and before["premium"] > 0 and entry["premium"] > before["premium"]:
            hikes.append({"from_year": before["year"], "to_year": entry["year"], "change_percent": round((entry["premium"] - before["premium"]) / before["premium"] * 100, 2), "currency": entry["currency"], "notice": "An increase in your user-reviewed entries; compare benefit / term changes and obtain the insurer's explanation. This is not a regulatory cap or predicted renewal price."})
        previous[entry["currency"]] = entry
    return {"entries": entries, "hikes": hikes, "notice": "User-reviewed historical premiums, not insurer-verified quotes. Different currencies are never combined. A record does not renew or extend cover."}


class PremiumEntry(StrictModel):
    year: int = Field(ge=1900, le=2200)
    premium: float = Field(ge=0, le=1000000000)
    currency: Literal["CNY", "JPY", "USD"] = "CNY"
    source_note: str = Field(min_length=1, max_length=1000)
    document_id: str | None = Field(default=None, max_length=100)
    confirmed: bool


@router.get("/policies/{policy_id}/premium-history")
def premium_history(policy_id: str, user=Depends(current_user)):
    with get_db() as db:
        _owned(db, "policies", policy_id, user["id"])
        return _premium_history(db, policy_id, user["id"])


@router.post("/policies/{policy_id}/premium-history")
def save_premium_history(policy_id: str, payload: PremiumEntry, user=Depends(current_user)):
    if not payload.confirmed or not payload.source_note.strip():
        raise HTTPException(409, "Review the exact historical premium and its source before saving.")
    with get_db() as db:
        _owned(db, "policies", policy_id, user["id"])
        if payload.document_id:
            document = _owned(db, "documents", payload.document_id, user["id"])
            if not _doc_valid(document):
                raise HTTPException(409, "The supporting original is unavailable.")
        db.execute("INSERT INTO policy_premium_history VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,policy_id,year,currency) DO UPDATE SET premium=excluded.premium,source_note=excluded.source_note,document_id=excluded.document_id,created_at=excluded.created_at", (uid("prm_"), user["id"], policy_id, payload.year, payload.premium, payload.currency, payload.source_note, payload.document_id, "user_reviewed", now_iso()))
        audit(db, user["id"], "historical_premium_user_reviewed", "policy", policy_id, {"year": payload.year, "currency": payload.currency})
        return _premium_history(db, policy_id, user["id"])


class RenewalComparison(StrictModel):
    policy_id: str = Field(min_length=1, max_length=100)
    proposed_product_id: str = Field(min_length=1, max_length=100)


@router.post("/buying/renewal-compare")
def compare_renewal(payload: RenewalComparison, user=Depends(current_user)):
    proposed = next((p for p in CATALOG if p["id"] == payload.proposed_product_id), None)
    if not proposed:
        raise HTTPException(422, "Choose a product from the limited reference catalogue.")
    with get_db() as db:
        policy = _owned(db, "policies", payload.policy_id, user["id"])
        history = _premium_history(db, policy["id"], user["id"])
        return {"existing": {k: policy[k] for k in ("id", "title", "family", "start_date", "end_date", "confirmed")}, "premium_history": history, "proposed": proposed,
                "questions": ["Have your needs, dependants, occupation, travel or health disclosures changed?", "Does the new offer preserve existing benefits, exclusions, continuity and waiting-period treatment?", "Obtain a written current quote and compare the same term, limits, deductible and co-pay.", "Review non-renewal / cancellation / free-look conditions in the exact contract with a licensed agent."],
                "no_extension": True, "notice": "Comparison and a reminder do not renew, cancel, issue or extend any policy. The reference is not proof of sale or an actual renewal offer."}


class SurrenderCheck(StrictModel):
    premiums_paid: float = Field(ge=0, le=1000000000)
    cash_value: float = Field(ge=0, le=1000000000)
    new_premium: float | None = Field(default=None, ge=0, le=1000000000)
    current_premium: float | None = Field(default=None, ge=0, le=1000000000)
    lost_benefits: list[str] = Field(default_factory=list, max_length=20)
    currency: Literal["CNY", "JPY", "USD"] = "CNY"
    confirmed: bool
    source_note: str = Field(min_length=1, max_length=1000)


@router.post("/buying/surrender-check")
def surrender_check(payload: SurrenderCheck, user=Depends(current_user)):
    if not payload.confirmed or not payload.source_note.strip():
        raise HTTPException(409, "Confirm the actual cash-value statement and comparable premium period first.")
    if any(len(value) > 300 for value in payload.lost_benefits):
        raise HTTPException(422, "A benefit description is too long.")
    loss = max(0, round(payload.premiums_paid - payload.cash_value, 2))
    return {"engine": "deterministic_arithmetic", "currency": payload.currency, "capital_loss": loss,
            "loss_percent": round(loss / payload.premiums_paid * 100, 2) if payload.premiums_paid else None,
            "annual_premium_change": round(payload.new_premium - payload.current_premium, 2) if payload.new_premium is not None and payload.current_premium is not None else None,
            "lost_benefits": payload.lost_benefits, "source_note": payload.source_note,
            "cooling_off_notice": "Check the exact issued contract and official seller for any free-look / cancellation right, start date, period and deductions. No universal number of days is assumed.",
            "warnings": ["Cash value is user reviewed, not independently verified by the insurer.", "Past protection consumed and time value are not included in this simple paid-premium-minus-cash-value comparison.", "Replacement can restart underwriting or waiting periods and lose guarantees or existing benefits. Compare written terms before any irreversible surrender.", "The app cannot surrender, refund, purchase or move money. Discuss the actual policy with a licensed professional."], "action_executed": False}
