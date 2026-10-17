"""Code-owned claims preparation, comparisons and isolated insurer simulation.

No endpoint submits a claim, sells a policy, contacts an agent or calls a phone.
All personal rows/files are owner-scoped. Export authorization binds a single-use
token to the exact current policy, incident, evidence and recipient snapshot.
"""
from __future__ import annotations

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
from .exports import pdf_bytes, zip_bytes

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


def _policy_supported(policy):
    fields = json.loads(policy["fields_json"])
    title = str(policy["title"]).lower()
    version_match = fields.get("product_id", fields.get("catalog_product_id")) == "allianz_changyou_2023" or fields.get("source_url") == WORDING_URL
    return version_match and ("畅游" in title or "changyou" in title) and ("安联" in policy["insurer"] or "allianz" in policy["insurer"].lower())


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
    required = ["policy", "identity", "travel_proof", "medical_record", "original_expense", "claim_form"]
    conditional = []
    if incident.get("treatment_type") == "inpatient":
        conditional.append("discharge_record")
    if incident.get("police_involved") or incident.get("third_party_involved"):
        conditional.append("incident_evidence")
    entries = []
    for category in required + conditional:
        matching = [item for item in evidence if item["category"] == category and item["exists"]]
        confirmed = [item for item in matching if item["confirmed"]]
        # A verified imported policy is actual owned evidence, not a mock checklist tick.
        if category == "policy" and policy and policy["confirmed"] and claim["policy_revision"] == policy["revision"]:
            files = _policy_files(db, policy)
            if any(d["document_id"] == policy["document_id"] and d["exists"] for d in files) and any(d["is_wording"] and d["exists"] for d in files):
                confirmed.extend({"document_id": d["document_id"]} for d in files if d["exists"])
            else:
                confirmed = []
        entries.append({"category": category, "label": CATEGORIES[category], "required": True, "conditional": category in conditional,
                        "condition": "Inpatient treatment" if category == "discharge_record" else "Relevant police/third-party incident" if category == "incident_evidence" else None,
                        "accepted_document_ids": [item["document_id"] for item in confirmed], "uploaded_document_ids": [item["document_id"] for item in matching], "confirmed": bool(confirmed), "missing": not bool(confirmed),
                        "source": {"url": WORDING_URL, "section": "4.3", "page": 12}, "note": "User preparation check only; insurer may request additional documents or originals."})
    return entries


def _prescreen(claim, policy):
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
    destination = str(fields.get("destination", "")).lower()
    japan = str(incident.get("country", "")).lower() in ("japan", "jp", "日本")
    territory_known = japan and any(term in destination for term in ("japan", "日本", "worldwide", "全球", "asia", "亚洲"))
    checks.append({"id": "territory", "status": "pass" if territory_known else "unresolved", "detail": "Japan matches the confirmed schedule destination; contract exclusions remain to be checked." if territory_known else "The schedule territory does not establish this destination. Confirm with insurer."})
    supported = _policy_supported(policy) and claim["benefit"] == "outpatient_accident" and incident.get("treatment_type") == "outpatient"
    checks.append({"id": "reviewed_rule", "status": "pass" if supported else "unresolved", "detail": "Reviewed Allianz 2023 accident-outpatient preparation path." if supported else "This policy/benefit is outside the deeply reviewed hackathon path. Export a draft and ask the insurer for its checklist."})
    checks.append({"id": "contract_conditions", "status": "unresolved", "detail": "Selected benefits, reasonable/necessary expenses, hospital definition, exclusions and insurer assessment still apply."})
    result = "possible_exclusion" if any(c["status"] == "possible_exclusion" for c in checks) else "potentially_relevant" if current and supported and territory_known else "insufficient_information"
    return {"result": result, "checks": checks, "sources": [{"url": WORDING_URL, "section": "4.2-4.3", "pages": [11, 12]}], "is_approval": False,
            "notice": "For this wording, outpatient claims should notify assistance as soon as possible within 15 days; inpatient/medical transport needs immediate notice. Contact the insurer to confirm current instructions. Emergency care must not wait for evidence."}


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
    return {"id": claim["id"], "policy_id": claim["policy_id"], "policy_revision": claim["policy_revision"], "current_policy_revision": policy["revision"] if policy else None,
            "policy_title": policy["title"] if policy else "Removed policy", "revision": claim["revision"], "benefit": claim["benefit"], "incident": json.loads(claim["incident_json"]),
            "confirmed_revision": claim["confirmed_revision"] if current else None, "actual_status": actual, "status": actual, "checklist": checklist, "evidence": evidence,
            "missing": [x["category"] for x in checklist if x["missing"]], "prescreen": _prescreen(claim, policy), "updates": updates, "simulation": {"label": "SIMULATED - no insurer connection", "events": simulations},
            "exports": exports, "created_at": claim["created_at"], "updated_at": claim["updated_at"], "official_channel_url": CLAIM_CHANNEL_URL, "disclosure": DISCLOSURE}


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


class ClaimCreate(StrictModel):
    policy_id: str = Field(min_length=1, max_length=100)
    benefit: str = Field(default="outpatient_accident", max_length=80)
    incident: Incident


class ClaimPatch(StrictModel):
    incident: Incident | None = None
    benefit: str | None = Field(default=None, max_length=80)
    expected_revision: int | None = Field(default=None, ge=1)


class EvidenceConfirmation(StrictModel):
    category: Literal["policy", "identity", "travel_proof", "medical_record", "original_expense", "claim_form", "incident_evidence", "discharge_record", "other"]
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
    stage: Literal["RECEIVED", "IN_REVIEW", "INFO_REQUESTED", "APPROVED", "DECLINED", "PAID"] = "RECEIVED"


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
        for table in ("claim_evidence", "claim_updates", "claim_simulations", "workflow_exports"):
            db.execute(f"DELETE FROM {table} WHERE claim_id=? AND user_id=?", (claim_id, user["id"]))
        db.execute("DELETE FROM workflow_actions WHERE entity_id=? AND user_id=?", (claim_id, user["id"]))
        db.execute("DELETE FROM claims WHERE id=? AND user_id=?", (claim_id, user["id"]))
        audit(db, user["id"], "claim_and_local_packages_deleted", "claim", claim_id, {"retrieval_removed": True})
    return {"ok": True, "deleted_id": claim_id, "retrieval_removed": True, "notice": "Local case files and generated packages removed. Policy documents shared with the portfolio are retained there. No insurer submission existed to revoke."}


@router.put("/claims/{claim_id}/evidence/{document_id}")
def confirm_evidence(claim_id: str, document_id: str, payload: EvidenceConfirmation, user=Depends(current_user)):
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
            if not _policy_supported(policy) or claim["benefit"] != "outpatient_accident":
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
        archive = zip_bytes(content, manifest, documents)
        pdf_path.write_bytes(content)
        zip_path.write_bytes(archive)
        db.execute("INSERT INTO workflow_exports VALUES(?,?,?,?,?,?,?,?,?,?)", (export_id, user["id"], claim_id, token["action"], current["mode"], str(pdf_path), str(zip_path), _json(manifest), hashlib.sha256(content).hexdigest(), now_iso()))
        db.execute("UPDATE workflow_actions SET used_at=?,payload_json='{}' WHERE token_hash=? AND user_id=? AND used_at IS NULL", (now_iso(), token["token_hash"], user["id"]))
        if current["mode"] == "prepared":
            db.execute("UPDATE claims SET status='PREPARED_NOT_SUBMITTED',updated_at=? WHERE id=? AND user_id=?", (now_iso(), claim_id, user["id"]))
        audit(db, user["id"], "claim_package_exported_not_submitted", "claim", claim_id, {"export_id": export_id, "mode": current["mode"], "document_count": len(documents)})
    return {"export_id": export_id, "pdf_url": f"/api/exports/{export_id}/pdf", "zip_url": f"/api/exports/{export_id}/zip", "actual_status": "PREPARED_NOT_SUBMITTED" if current["mode"] == "prepared" else "DRAFT", "mode": current["mode"], "submitted": False, "recipient": "User download only", "sha256": hashlib.sha256(content).hexdigest()}


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
        _claim(db, claim_id, user["id"])
        notes = {"RECEIVED": "SIMULATED receipt; no insurer received this case.", "IN_REVIEW": "SIMULATED review; no underwriting/claim review occurred.", "INFO_REQUESTED": "SIMULATED request for supplementary evidence.", "APPROVED": "SIMULATED approval; no claim decision occurred.", "DECLINED": "SIMULATED decline; no claim decision occurred.", "PAID": "SIMULATED payment; no money moved."}
        db.execute("INSERT INTO claim_simulations VALUES(?,?,?,?,?,?)", (uid("sim_"), claim_id, user["id"], payload.stage, notes[payload.stage], now_iso()))
        audit(db, user["id"], "isolated_insurer_simulation", "claim", claim_id, {"stage": payload.stage, "is_simulated": True})
        return _view(db, *_claim(db, claim_id, user["id"]))


class Needs(StrictModel):
    family: str = Field(default="travel", max_length=40)
    budget: float | None = Field(default=None, ge=0, le=10000000)
    destination: str = Field(default="Japan", max_length=80)
    priorities: list[str] = Field(default_factory=lambda: ["accidental_medical", "emergency_assistance"], max_length=20)
    purpose: str = Field(default="leisure", max_length=100)
    notes: str = Field(default="", max_length=2000)


class CompareRequest(StrictModel):
    needs: Needs


class Contact(StrictModel):
    name: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=50)


class BriefPreview(StrictModel):
    needs: Needs
    selected_product_ids: list[str] = Field(default_factory=list, max_length=5)
    contact: Contact = Field(default_factory=Contact)
    consent_to_include_contact: bool = False


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
        existing = [dict(row) for row in db.execute("SELECT id,title,family,confirmed,end_date FROM policies WHERE user_id=? AND family=?", (user["id"], needs["family"]))]
    return {"needs": needs, "products": products, "criteria": priorities, "existing_cover": existing, "existing_cover_notice": "Your existing cover may already meet this need. Review it before considering another policy.",
            "judge": {"type": "deterministic_feature_match", "price_used": False, "claims_probability_used": False}, "disclosure": "Educational comparison of a limited reference catalogue. Not licensed advice, a live quote or proof of current sale. A proposed licensed partner must perform suitability and final advice. Commercial commission does not affect this score."}


@router.post("/buying/mis-selling-check")
def check_selling(payload: SellingCheck):
    rules = [("guaranteed_payout", r"guaranteed?\s+(?:claim|payout|return)|一定赔|保证赔|保证收益|包赔", "An unsupported guarantee needs contract evidence and licensed review."),
             ("non_disclosure", r"(?:do not|don't|no need to)\s+(?:disclose|mention|declare)|不用告知|隐瞒|无需告知", "Do not omit requested facts or encourage non-disclosure."),
             ("pressure", r"(?:buy|sign)\s+(?:now|immediately)|马上签|立即购买|最后机会", "Pressure language can prevent informed comparison; request time and written terms."),
             ("universal_best", r"best for everyone|适合所有人|最便宜.*最好", "Suitability depends on the person's needs; cheapest is not automatically best.")]
    flags = [{"id": key, "message": message} for key, pattern, message in rules if re.search(pattern, payload.text, re.I)]
    return {"flags": flags, "result": "review_needed" if flags else "no_pattern_detected", "notice": "Pattern screening only; absence of a flag does not prove compliance or suitability. No text is saved."}


@router.post("/buying/brief/preview")
def preview_brief(payload: BriefPreview, user=Depends(current_user)):
    known = {p["id"] for p in CATALOG}
    if any(p not in known for p in payload.selected_product_ids):
        raise HTTPException(422, "Unknown product reference.")
    if any(payload.contact.model_dump().values()) and not payload.consent_to_include_contact:
        raise HTTPException(409, "Explicitly approve including selected contact information.")
    snapshot = {"needs": payload.needs.model_dump(), "selected_product_ids": payload.selected_product_ids, "contact": payload.contact.model_dump() if payload.consent_to_include_contact else {}, "consent_to_include_contact": payload.consent_to_include_contact,
                "recipient": "User download only", "excluded": ["Original medical records", "Financial statements", "Full portfolio", "Conversation history", "Personal memory"], "no_external_delivery": True, "partner_status": "Proposed licensed partner demonstration - no real partner connection"}
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
                items.append(dict(row) | {"days_until_expiry": days, "state": "expired" if days < 0 else "review_due", "steps": ["Reconfirm changed circumstances", "Review existing and proposed cover", "Discuss with licensed agent", "Record a new policy only after issuance evidence"], "renewed": False})
    return {"date_basis": today.isoformat(), "timezone": "Asia/Shanghai", "reminders": items, "notice": "A reminder or handoff does not renew, extend or issue a policy."}
