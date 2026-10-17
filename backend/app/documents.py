"""Real local document ingestion with per-page provenance and owner checks."""
from __future__ import annotations

from datetime import date
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
from typing import Any

import pymupdf as fitz
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .core import ROOT, DATA_DIR, UPLOAD_DIR, audit, current_user, get_db, now_iso, uid

router = APIRouter(prefix="/api", tags=["documents and portfolio"])
MAX_SIZE = 15 * 1024 * 1024
MAX_PAGES = 100
MAX_TEXT = 1_500_000
INJECTION = re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions?|system\s*prompt|developer\s*message|reveal\s+(?:secrets?|api[_ ]?key|password)|<\|(?:im_start|system)|忽略.{0,10}(?:指令|规则)|泄露.{0,10}(?:密钥|密码)", re.I)
_ocr = None
_ocr_error = None


def clean_pdf_text(text: str) -> str:
    """Remove repeated PDF overprint lines while retaining order and page scope."""
    lines, recent = [], []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and stripped in recent[-5:]:
            continue
        lines.append(line.rstrip())
        if stripped:
            recent.append(stripped)
    return "\n".join(lines).strip()


def ocr_image(image: bytes) -> str:
    global _ocr, _ocr_error
    if _ocr_error:
        raise RuntimeError(_ocr_error)
    if _ocr is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            # Models ship with this package. No remote model download on upload.
            _ocr = RapidOCR()
        except Exception:
            _ocr_error = "CPU OCR engine is unavailable; use a text PDF or manually enter facts."
            raise RuntimeError(_ocr_error)
    result, _ = _ocr(image)
    return "\n".join(str(item[1]) for item in (result or []))


def extract_pages(raw: bytes, media_type: str) -> tuple[list[dict], str]:
    if media_type == "text/plain":
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(422, "Text files must use UTF-8 encoding.")
        if len(text) > MAX_TEXT or "\x00" in text:
            raise HTTPException(422, "Invalid or oversized text content.")
        return [{"page": 1, "text": text, "method": "text", "warnings": []}], "text_extracted"
    try:
        doc = fitz.open(stream=raw, filetype="pdf" if media_type == "application/pdf" else None)
    except Exception:
        raise HTTPException(422, "The document could not be read. Upload a valid PDF, JPG, PNG or UTF-8 text file.")
    with doc:
        if doc.needs_pass:
            raise HTTPException(422, "Password-protected PDFs are unsupported. Upload an unlocked copy.")
        if not 1 <= len(doc) <= MAX_PAGES:
            raise HTTPException(422, f"Documents must contain between 1 and {MAX_PAGES} pages.")
        pages, total_chars, ocr_count = [], 0, 0
        for index, page in enumerate(doc):
            text = clean_pdf_text(page.get_text("text"))
            method, warnings = "pdf_text", []
            if len(text) < 30:
                if ocr_count >= 12:
                    warnings.append("OCR page quota reached. Split the document or enter missing facts manually.")
                    method = "manual_required"
                else:
                    try:
                        width, height = page.rect.width, page.rect.height
                        scale = min(2.0, 2400 / max(width, height, 1))
                        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                        text = ocr_image(pix.tobytes("png"))
                        method = "cpu_ocr"
                        ocr_count += 1
                        if not text.strip():
                            warnings.append("No text recognized. Manual review is required.")
                    except Exception:
                        method = "manual_required"
                        warnings.append("OCR unavailable for this page. No text was invented; manual review is required.")
            total_chars += len(text)
            if total_chars > MAX_TEXT:
                raise HTTPException(422, "Extracted text exceeds the processing quota.")
            pages.append({"page": index + 1, "text": text, "method": method, "warnings": warnings, "extractor_version": 2})
        status = "manual_required" if any(p["method"] == "manual_required" for p in pages) else "ocr_extracted" if ocr_count else "text_extracted"
        return pages, status


def chunk_text(text: str, size: int = 700) -> list[str]:
    # Retain complete short paragraphs and bounded overlap without modifying quotes.
    paragraphs = [x.strip() for x in re.split(r"\n\s*\n|\n(?=\s*(?:\d+[、．]\s*[^\d\n]|\d+\.\d+\s))", text) if x.strip()]
    result = []
    for paragraph in paragraphs:
        if len(paragraph) <= size:
            result.append(paragraph)
        else:
            for start in range(0, len(paragraph), size - 100):
                result.append(paragraph[start:start + size])
    return result


def index_document(db, document_id: str, user_id: str, pages: list[dict]):
    db.execute("DELETE FROM document_chunks WHERE document_id=? AND user_id=?", (document_id, user_id))
    try:
        db.execute("DELETE FROM chunks_fts WHERE document_id=? AND user_id=?", (document_id, user_id))
    except sqlite3.OperationalError:
        pass
    quarantine_count = 0
    for page in pages:
        for text in chunk_text(page["text"]):
            chunk_id = uid("chk_")
            quarantined = bool(INJECTION.search(text))
            quarantine_count += int(quarantined)
            db.execute("INSERT INTO document_chunks VALUES(?,?,?,?,?,?)", (chunk_id, user_id, document_id, page["page"], text, int(quarantined)))
            if not quarantined:
                try:
                    db.execute("INSERT INTO chunks_fts(id,user_id,document_id,text) VALUES(?,?,?,?)", (chunk_id, user_id, document_id, text))
                except sqlite3.OperationalError:
                    pass
    if quarantine_count:
        audit(db, user_id, "untrusted_document_instruction_quarantined", "document", document_id, {"chunks": quarantine_count})


def field_candidates(pages: list[dict], document_id: str) -> dict:
    text = "\n".join(p["text"] for p in pages)
    fields: dict[str, Any] = {"benefits": [], "exclusions": [], "critical_sources": {}, "synthetic": bool(re.search(r"SYNTHETIC|演示|合成", text, re.I))}
    for family, hints in [("travel", ["旅行", "旅游", "travel", "Japan"]), ("critical_illness", ["重大疾病", "重疾"]), ("motor", ["机动车", "车险"]), ("home", ["家庭财产", "房屋"]), ("medical", ["医疗保险", "医疗费用", "medical"]), ("accident", ["意外伤害"]), ("life", ["终身寿险", "定期寿险"]), ("savings", ["年金", "万能险"]), ("sme", ["企业财产", "雇主责任"])]:
        if any(hint.lower() in text.lower() for hint in hints):
            fields["family"] = family
            break
    patterns = {
        "insurer": r"(?:Insurer|保险公司|承保机构)\s*[:：]\s*([^\n]{2,100})",
        "product_name": r"(?:Product|产品名称|保险产品)\s*[:：]\s*([^\n]{2,140})",
        "policy_number": r"(?:Policy\s*(?:number|no\.?)|保单号(?:码)?)\s*[:：]\s*([A-Za-z0-9_\-]{4,70})",
        "insured_name": r"(?:Insured(?:\s+name)?|被保险人)\s*[:：]\s*([^\n]{1,80})",
        "start_date": r"(?:Start\s*date|生效日期|保险起期)\s*[:：]\s*(\d{4}-\d{2}-\d{2})",
        "end_date": r"(?:End\s*date|到期日期|保险止期)\s*[:：]\s*(\d{4}-\d{2}-\d{2})",
        "destination": r"(?:Destination|目的地)\s*[:：]\s*([^\n]{1,80})",
        "treatment_date": r"(?:Treatment\s*date|就诊日期|诊疗日期)\s*[:：]\s*(\d{4}-\d{2}-\d{2})",
        "recorded_diagnosis": r"(?:Diagnosis|诊断|診断)\s*[:：]\s*([^\n]{1,180})",
        "hospital": r"(?:Hospital|医疗机构|医院|病院)\s*[:：]\s*([^\n]{1,160})",
        "expense_total": r"(?:Total\s*(?:amount|expense)?|费用合计|合计金额|総額)\s*[:：]\s*([^\n]{1,100})",
    }
    for key, pattern in patterns.items():
        for page in pages:
            match = re.search(pattern, page["text"], re.I)
            if match:
                fields[key] = match.group(1).strip()
                fields["critical_sources"][key] = {"document_id": document_id, "page": page["page"], "quote": match.group(0)}
                break
    if "安联" in text and not fields.get("insurer"):
        fields["insurer"] = "安联人寿保险有限公司"
    for page in pages:
        for line in page["text"].splitlines():
            if any(term in line for term in ["意外伤害医疗", "Accidental outpatient", "医疗费用保险金"]):
                fields["benefits"].append({"name": line.strip()[:150], "source": {"document_id": document_id, "page": page["page"], "quote": line.strip()}})
                if len(fields["benefits"]) >= 6:
                    break
    return fields


def document_dict(row, include_pages=False):
    result = {k: row[k] for k in ("id", "kind", "claim_id", "name", "media_type", "size", "sha256", "ocr_status", "created_at")}
    pages = json.loads(row["pages_json"])
    result.update({"page_count": len(pages), "file_url": f"/api/documents/{row['id']}/file", "saved": True,
                   "retention": "Explicitly saved until you delete it; local demo has no external backups."})
    if include_pages:
        result["pages"] = pages
        result["extracted_fields"] = field_candidates(pages, row["id"])
        result["safety_warnings"] = ["Untrusted instruction-like text quarantined from retrieval."] if any(INJECTION.search(p["text"]) for p in pages) else []
    return result


def policy_dict(db, row):
    result = dict(row)
    result["fields"] = json.loads(result.pop("fields_json"))
    result.pop("user_id", None)
    result["confirmed"] = bool(result["confirmed"])
    docs = db.execute("SELECT d.* FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE pd.policy_id=? AND d.user_id=? ORDER BY d.created_at", (row["id"], row["user_id"])).fetchall()
    result["documents"] = [document_dict(d) for d in docs]
    result["confirmation_required"] = not result["confirmed"]
    result["coverage_warning"] = "Confirmed extracted facts are not an insurer coverage or payout decision."
    return result


def save_document(db, user_id, raw, name, media_type, kind, claim_id=None, pages=None, status=None):
    if pages is None:
        pages, status = extract_pages(raw, media_type)
    identifier = uid("doc_")
    suffix = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "text/plain": ".txt"}[media_type]
    path = UPLOAD_DIR / (identifier + suffix)
    path.write_bytes(raw)
    db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", (identifier, user_id, kind, claim_id, name, media_type, len(raw), str(path), json.dumps(pages, ensure_ascii=False), "\n".join(p["text"] for p in pages), hashlib.sha256(raw).hexdigest(), status, now_iso()))
    index_document(db, identifier, user_id, pages)
    return db.execute("SELECT * FROM documents WHERE id=?", (identifier,)).fetchone()


def create_policy(db, document, fields=None):
    fields = fields or field_candidates(json.loads(document["pages_json"]), document["id"])
    identifier, stamp = uid("pol_"), now_iso()
    title = fields.get("product_name") or Path(document["name"]).stem
    db.execute("INSERT INTO policies VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (identifier, document["user_id"], document["id"], title, fields.get("insurer", ""), fields.get("policy_number", ""), fields.get("insured_name", ""), fields.get("start_date", ""), fields.get("end_date", ""), fields.get("family", "other"), json.dumps(fields, ensure_ascii=False), 0, 1, stamp, stamp))
    db.execute("INSERT INTO policy_documents VALUES(?,?)", (identifier, document["id"]))
    return db.execute("SELECT * FROM policies WHERE id=?", (identifier,)).fetchone()


@router.post("/documents")
def upload_document(file: UploadFile = File(...), kind: str = Form("policy"), claim_id: str | None = Form(None), policy_id: str | None = Form(None), save: bool = Form(True), user=Depends(current_user)):
    if not save:
        raise HTTPException(422, "Only explicitly saved uploads are supported. Select Save to portfolio/case to continue.")
    if kind not in {"policy", "evidence"}:
        raise HTTPException(422, "Document kind must be policy or evidence.")
    raw = file.file.read(MAX_SIZE + 1)
    if not raw or len(raw) > MAX_SIZE:
        raise HTTPException(413, "Upload a nonempty document of at most 15 MB.")
    media = file.content_type or ""
    if raw.startswith(b"%PDF-"):
        media = "application/pdf"
    elif raw.startswith(b"\x89PNG\r\n\x1a\n"):
        media = "image/png"
    elif raw.startswith(b"\xff\xd8\xff"):
        media = "image/jpeg"
    elif media == "text/plain" or (file.filename or "").lower().endswith(".txt"):
        media = "text/plain"
    else:
        raise HTTPException(415, "Supported formats: PDF, JPEG, PNG and UTF-8 TXT. File content must match its type.")
    name = Path((file.filename or "document").replace("\\", "/")).name[:180]
    with get_db() as db:
        if policy_id and not db.execute("SELECT 1 FROM policies WHERE id=? AND user_id=?", (policy_id, user["id"])).fetchone():
            raise HTTPException(404, "Policy not found.")
        if claim_id:
            try:
                claim = db.execute("SELECT id FROM claims WHERE id=? AND user_id=?", (claim_id, user["id"])).fetchone()
            except sqlite3.OperationalError:
                claim = None
            if not claim:
                raise HTTPException(404, "Case not found.")
        quota = db.execute("SELECT COALESCE(SUM(size),0) FROM documents WHERE user_id=?", (user["id"],)).fetchone()[0]
        if quota + len(raw) > 150 * 1024 * 1024:
            raise HTTPException(413, "Your demo storage quota is 150 MB. Delete unneeded documents first.")
        document = save_document(db, user["id"], raw, name, media, kind, claim_id)
        policy = None
        if kind == "policy":
            if policy_id:
                _remove_derived_exports(db, user["id"], [policy_id])
                db.execute("INSERT INTO policy_documents VALUES(?,?)", (policy_id, document["id"]))
                db.execute("UPDATE policies SET confirmed=0,revision=revision+1,updated_at=? WHERE id=? AND user_id=?", (now_iso(), policy_id, user["id"]))
                policy = db.execute("SELECT * FROM policies WHERE id=?", (policy_id,)).fetchone()
            else:
                policy = create_policy(db, document)
        audit(db, user["id"], "document_saved", "document", document["id"], {"kind": kind, "bytes": len(raw), "ocr_status": document["ocr_status"]})
        return {"document": document_dict(document, True), "policy": policy_dict(db, policy) if policy else None}


@router.get("/documents")
def list_documents(user=Depends(current_user)):
    with get_db() as db:
        return {"documents": [document_dict(d) for d in db.execute("SELECT * FROM documents WHERE user_id=? ORDER BY created_at DESC", (user["id"],))]}


@router.get("/documents/{document_id}")
def get_document(document_id: str, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (document_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Document not found.")
        audit(db, user["id"], "document_viewed", "document", document_id)
        return document_dict(row, True)


@router.get("/documents/{document_id}/file")
def get_file(document_id: str, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (document_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Document not found.")
        path = Path(row["storage_path"]).resolve()
        if path.parent != UPLOAD_DIR.resolve() or not path.is_file():
            raise HTTPException(404, "File is no longer available.")
        audit(db, user["id"], "document_downloaded", "document", document_id)
        return FileResponse(path, media_type=row["media_type"], filename=row["name"], headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


def _remove_derived_exports(db, user_id: str, identifiers: list[str]):
    """Revoke local package copies referencing deleted source evidence."""
    affected = set(identifiers)
    if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='claims'").fetchone():
        for claim in db.execute("SELECT id,policy_id FROM claims WHERE user_id=?", (user_id,)).fetchall():
            if claim["policy_id"] in affected:
                affected.add(claim["id"])
    if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='claim_evidence'").fetchone():
        for evidence in db.execute("SELECT claim_id,document_id FROM claim_evidence WHERE user_id=?", (user_id,)).fetchall():
            if evidence["document_id"] in affected:
                affected.add(evidence["claim_id"])
    identifiers = list(affected)
    if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='claims'").fetchone():
        for identifier in identifiers:
            db.execute("UPDATE claims SET status='DRAFT',confirmed_revision=NULL,updated_at=? WHERE id=? AND user_id=?", (now_iso(), identifier, user_id))
    if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_actions'").fetchone():
        for action in db.execute("SELECT token_hash,entity_id,payload_json FROM workflow_actions WHERE user_id=?", (user_id,)).fetchall():
            if any(identifier == action["entity_id"] or identifier in action["payload_json"] for identifier in identifiers):
                db.execute("DELETE FROM workflow_actions WHERE token_hash=? AND user_id=?", (action["token_hash"], user_id))
    for confirmation in db.execute("SELECT id,entity_id,payload_json FROM confirmations WHERE user_id=?", (user_id,)).fetchall():
        if any(identifier == confirmation["entity_id"] or identifier in confirmation["payload_json"] for identifier in identifiers):
            db.execute("DELETE FROM confirmations WHERE id=? AND user_id=?", (confirmation["id"], user_id))
    if not db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_exports'").fetchone():
        return
    for export in db.execute("SELECT id,pdf_path,zip_path,snapshot_json FROM workflow_exports WHERE user_id=?", (user_id,)).fetchall():
        if not any(identifier in export["snapshot_json"] for identifier in identifiers):
            continue
        for key in ("pdf_path", "zip_path"):
            if not export[key]:
                continue
            path = Path(export[key]).resolve()
            try:
                path.relative_to(DATA_DIR.resolve())
            except ValueError:
                continue
            path.unlink(missing_ok=True)
        db.execute("DELETE FROM workflow_exports WHERE id=? AND user_id=?", (export["id"], user_id))


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (document_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Document not found.")
        linked = db.execute("SELECT policy_id FROM policy_documents WHERE document_id=?", (document_id,)).fetchall()
        _remove_derived_exports(db, user["id"], [document_id, *[p[0] for p in linked]])
        for link in linked:
            db.execute("UPDATE policies SET confirmed=0,revision=revision+1,updated_at=? WHERE id=? AND user_id=?", (now_iso(), link[0], user["id"]))
        try:
            db.execute("DELETE FROM chunks_fts WHERE document_id=? AND user_id=?", (document_id, user["id"]))
        except sqlite3.OperationalError:
            pass
        db.execute("DELETE FROM documents WHERE id=? AND user_id=?", (document_id, user["id"]))
        if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='claim_evidence'").fetchone():
            db.execute("DELETE FROM claim_evidence WHERE document_id=? AND user_id=?", (document_id, user["id"]))
        path = Path(row["storage_path"]).resolve()
        if path.parent == UPLOAD_DIR.resolve():
            path.unlink(missing_ok=True)
        audit(db, user["id"], "document_deleted", "document", document_id, {"retrieval_removed": True, "local_original_removed": True})
    return {"ok": True, "deleted_id": document_id, "retrieval_removed": True, "backup_notice": "Local hackathon store has no configured external backups."}


@router.delete("/policies/{policy_id}")
def delete_policy(policy_id: str, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM policies WHERE id=? AND user_id=?", (policy_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Policy not found.")
        documents = db.execute("SELECT d.* FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE pd.policy_id=? AND d.user_id=?", (policy_id, user["id"])).fetchall()
        _remove_derived_exports(db, user["id"], [policy_id, *[d["id"] for d in documents]])
        db.execute("DELETE FROM policies WHERE id=? AND user_id=?", (policy_id, user["id"]))
        deleted_ids = []
        for document in documents:
            if db.execute("SELECT 1 FROM policy_documents WHERE document_id=?", (document["id"],)).fetchone():
                continue
            try:
                db.execute("DELETE FROM chunks_fts WHERE document_id=? AND user_id=?", (document["id"], user["id"]))
            except sqlite3.OperationalError:
                pass
            db.execute("DELETE FROM documents WHERE id=? AND user_id=?", (document["id"], user["id"]))
            path = Path(document["storage_path"]).resolve()
            if path.parent == UPLOAD_DIR.resolve():
                path.unlink(missing_ok=True)
            deleted_ids.append(document["id"])
        audit(db, user["id"], "policy_deleted", "policy", policy_id, {"documents_deleted": len(deleted_ids), "retrieval_removed": True})
    return {"ok": True, "deleted_policy_id": policy_id, "deleted_document_ids": deleted_ids, "retrieval_removed": True}


@router.get("/policies")
def list_policies(user=Depends(current_user)):
    with get_db() as db:
        return {"policies": [policy_dict(db, row) for row in db.execute("SELECT * FROM policies WHERE user_id=? ORDER BY created_at DESC", (user["id"],))]}


@router.get("/policies/{policy_id}")
def get_policy(policy_id: str, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM policies WHERE id=? AND user_id=?", (policy_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Policy not found.")
        return policy_dict(db, row)


class PolicyUpdate(BaseModel):
    fields: dict[str, Any] = Field(default_factory=dict)
    confirmed: bool = False


@router.patch("/policies/{policy_id}")
def update_policy(policy_id: str, payload: PolicyUpdate, user=Depends(current_user)):
    allowed = {"title", "product_name", "insurer", "policy_number", "insured_name", "start_date", "end_date", "family", "destination", "benefits", "deductible", "premium", "wording_reviewed"}
    if set(payload.fields) - allowed:
        raise HTTPException(422, "Unsupported policy fields.")
    if len(json.dumps(payload.fields)) > 25000:
        raise HTTPException(422, "Policy fields are too large.")
    with get_db() as db:
        row = db.execute("SELECT * FROM policies WHERE id=? AND user_id=?", (policy_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Policy not found.")
        fields = json.loads(row["fields_json"])
        original_values = {key: fields.get(key) for key in payload.fields}
        fields.update(payload.fields)
        for key in ("insurer", "policy_number", "insured_name", "start_date", "end_date", "destination", "title", "product_name", "family"):
            if key in fields and not isinstance(fields[key], str):
                raise HTTPException(422, f"{key} must be text.")
            if isinstance(fields.get(key), str) and len(fields[key]) > 200:
                raise HTTPException(422, f"{key} is too long.")
        if fields.get("family") and fields["family"] not in {"travel", "medical", "critical_illness", "accident", "life", "motor", "home", "savings", "sme", "other"}:
            raise HTTPException(422, "Unknown insurance family.")
        if "benefits" in fields and (not isinstance(fields["benefits"], list) or len(fields["benefits"]) > 30):
            raise HTTPException(422, "Benefits must be a list of at most 30 reviewed entries.")
        if fields.get("start_date") or fields.get("end_date"):
            try:
                start, end = date.fromisoformat(fields.get("start_date", "")), date.fromisoformat(fields.get("end_date", ""))
                if end < start:
                    raise ValueError()
            except ValueError:
                raise HTTPException(422, "Enter a valid policy period in YYYY-MM-DD format; expiry cannot precede inception.")
        if payload.confirmed:
            missing = [k for k in ("insurer", "policy_number", "insured_name", "start_date", "end_date") if not fields.get(k)]
            if missing:
                raise HTTPException(422, {"message": "Confirm all critical facts first.", "missing": missing})
        fields["last_confirmation"] = {"at": now_iso(), "user_id": user["id"], "critical_fields_confirmed": payload.confirmed}
        corrections = fields.setdefault("user_corrections", {})
        for key, value in payload.fields.items():
            if original_values[key] != value:
                corrections[key] = {"value": value, "at": now_iso(), "provenance": "user_corrected", "original_source": fields.get("critical_sources", {}).get(key)}
        title = fields.get("title") or fields.get("product_name") or row["title"]
        _remove_derived_exports(db, user["id"], [policy_id])
        db.execute("UPDATE policies SET title=?,insurer=?,policy_number=?,insured_name=?,start_date=?,end_date=?,family=?,fields_json=?,confirmed=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=?", (title, fields.get("insurer", row["insurer"]), fields.get("policy_number", row["policy_number"]), fields.get("insured_name", row["insured_name"]), fields.get("start_date", row["start_date"]), fields.get("end_date", row["end_date"]), fields.get("family", row["family"]), json.dumps(fields, ensure_ascii=False), int(payload.confirmed), now_iso(), policy_id, user["id"]))
        audit(db, user["id"], "policy_facts_confirmed" if payload.confirmed else "policy_facts_corrected", "policy", policy_id, {"revision": row["revision"] + 1, "fields_changed": list(payload.fields)})
        return policy_dict(db, db.execute("SELECT * FROM policies WHERE id=?", (policy_id,)).fetchone())


@router.get("/portfolio")
def portfolio(user=Depends(current_user)):
    with get_db() as db:
        policies = [policy_dict(db, row) for row in db.execute("SELECT * FROM policies WHERE user_id=? ORDER BY end_date", (user["id"],))]
    coverage = {}
    renewals = []
    for p in policies:
        coverage.setdefault(p["family"], []).append({"policy_id": p["id"], "title": p["title"], "confirmed": p["confirmed"]})
        if p["end_date"]:
            try:
                days = (date.fromisoformat(p["end_date"]) - date.today()).days
                if days <= 30:
                    renewals.append({"policy_id": p["id"], "title": p["title"], "days_remaining": days, "status": "expired" if days < 0 else "review_due", "notice": "A reminder does not renew or extend cover."})
            except ValueError:
                pass
    return {"policies": policies, "coverage_by_family": coverage, "renewals": renewals,
            "analysis": {"status": "needs_review", "gaps": [{"family": f, "status": "not_evidenced", "explanation": "No confirmed document in this portfolio demonstrates this cover; this is not proof you are uninsured."} for f in ["medical", "critical_illness", "accident", "travel", "motor", "home"] if f not in coverage],
                         "overlaps": [{"family": f, "policy_ids": [p["policy_id"] for p in ps], "status": "possible_overlap_needs_clause_review"} for f, ps in coverage.items() if len(ps) > 1],
                         "notice": "Insurance limits are not asset values and are never summed as wealth or guaranteed combined reimbursement."}}


def seed_demo_documents():
    """Seed real public wording plus an obviously synthetic schedule for usr_mei."""
    with get_db() as db:
        if not db.execute("SELECT id FROM users WHERE id='usr_mei'").fetchone():
            return
        existing = db.execute("SELECT * FROM policies WHERE user_id='usr_mei' ORDER BY created_at LIMIT 1").fetchone()
        wording_path = ROOT / "backend" / "fixtures" / "allianz-changyou-2023-wording.pdf"
        if existing:
            if wording_path.is_file() and not db.execute("SELECT d.id FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE pd.policy_id=? AND d.name='Allianz-public-2023-wording.pdf'", (existing["id"],)).fetchone():
                wording = save_document(db, "usr_mei", wording_path.read_bytes(), "Allianz-public-2023-wording.pdf", "application/pdf", "policy")
                db.execute("INSERT INTO policy_documents VALUES(?,?)", (existing["id"], wording["id"]))
                db.execute("UPDATE policies SET confirmed=0,revision=revision+1,updated_at=? WHERE id=?", (now_iso(), existing["id"]))
            for document in db.execute("SELECT d.* FROM documents d JOIN policy_documents pd ON pd.document_id=d.id WHERE pd.policy_id=? AND d.name='Allianz-public-2023-wording.pdf'", (existing["id"],)).fetchall():
                if any(page.get("extractor_version", 1) < 2 for page in json.loads(document["pages_json"])):
                    pages, status = extract_pages(Path(document["storage_path"]).read_bytes(), "application/pdf")
                    db.execute("UPDATE documents SET pages_json=?,text=?,ocr_status=? WHERE id=?", (json.dumps(pages, ensure_ascii=False), "\n".join(p["text"] for p in pages), status, document["id"]))
                    index_document(db, document["id"], "usr_mei", pages)
                    db.execute("UPDATE policies SET confirmed=0,revision=revision+1,updated_at=? WHERE id=?", (now_iso(), existing["id"]))
            return
        schedule_text = """SYNTHETIC DEMONSTRATION — NOT AN ISSUED POLICY
Insurer: 安联人寿保险有限公司
Product: 安联境外旅行（畅游版）互联网意外伤害保险 — synthetic Japan schedule
Policy number: DEMO-ALLIANZ-JP-2026
Insured name: 林美 (fictional customer)
Start date: 2026-10-15
End date: 2026-10-25
Destination: Japan / 日本
Selected benefit: Accidental outpatient medical expenses / 意外伤害医疗费用
Illustrative medical limit: CNY 100000 — synthetic selected limit, not a live quote
This synthetic schedule is paired only for demonstration with published 2023 wording.
There is no insurer partnership, issued policy, verified live product sale or payment guarantee.
"""
        doc = fitz.open()
        page = doc.new_page()
        page.insert_font(fontname="china-s")
        page.insert_textbox(fitz.Rect(36, 35, 560, 810), schedule_text, fontsize=11, fontname="china-s", lineheight=1.5)
        raw = doc.tobytes()
        doc.close()
        schedule = save_document(db, "usr_mei", raw, "SYNTHETIC-Japan-policy-schedule.pdf", "application/pdf", "policy")
        fields = field_candidates(json.loads(schedule["pages_json"]), schedule["id"])
        fields["synthetic"] = True
        fields["catalog_product_id"] = "allianz_changyou_2023"
        fields["source_url"] = "https://pts.allianz.com.cn/portal/resources/material/clauses/NLC_AXWL02_231.pdf"
        policy = create_policy(db, schedule, fields)
        if wording_path.is_file():
            wording = save_document(db, "usr_mei", wording_path.read_bytes(), "Allianz-public-2023-wording.pdf", "application/pdf", "policy")
            db.execute("INSERT INTO policy_documents VALUES(?,?)", (policy["id"], wording["id"]))
        audit(db, "usr_mei", "synthetic_demo_seeded", "policy", policy["id"], {"confirmed": False, "real_insurer_connection": False})
