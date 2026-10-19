"""Private temporary ingestion, explicit saving and a source-of-truth vault.

Temporary originals have a strict access deadline and are never added to the
policy index. Expired files are purged opportunistically and by the cleanup API;
historical hosting snapshots remain a separate retention boundary.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict

from . import core, documents

router = APIRouter(prefix="/api", tags=["temporary ingestion and private vault"])
KINDS = {"policy", "evidence", "medical_report", "financial_report"}
TTL = 24 * 60 * 60


def init_db():
    with core.get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS temporary_documents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,kind TEXT NOT NULL,media_type TEXT NOT NULL,size INTEGER NOT NULL,storage_path TEXT NOT NULL,pages_json TEXT NOT NULL,ocr_status TEXT NOT NULL,sha256 TEXT NOT NULL,expires_at REAL NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS processing_consents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,purpose TEXT NOT NULL,granted INTEGER NOT NULL,entity_id TEXT,created_at TEXT NOT NULL);
        """)
    purge_expired()


def consent(db, user_id, purpose, granted, entity_id=None):
    db.execute("INSERT INTO processing_consents VALUES(?,?,?,?,?,?)", (core.uid("cns_"), user_id, purpose, int(granted), entity_id, core.now_iso()))


def purge_expired(user_id=None):
    with core.get_db() as db:
        query = "SELECT * FROM temporary_documents WHERE expires_at<=?"
        args = [time.time()]
        if user_id:
            query += " AND user_id=?"
            args.append(user_id)
        rows = db.execute(query, args).fetchall()
        for row in rows:
            path = Path(row["storage_path"]).resolve()
            if path.parent == core.UPLOAD_DIR.resolve():
                path.unlink(missing_ok=True)
            db.execute("DELETE FROM temporary_documents WHERE id=?", (row["id"],))
            core.audit(db, row["user_id"], "temporary_upload_expired", "document", row["id"])
        return len(rows)


def view(row, pages=False):
    result = {k: row[k] for k in ("id", "name", "kind", "media_type", "size", "ocr_status", "sha256", "created_at")}
    result.update(saved=False, expires_at=datetime.fromtimestamp(row["expires_at"], timezone.utc).isoformat(),
                  file_url=f"/api/temporary-documents/{row['id']}/file", page_count=len(json.loads(row["pages_json"])),
                  retention="Access ends after 24 hours. Current-store purge runs on access, cleanup and startup; hosting snapshots and downloaded copies have separate retention.", indexed=False)
    if pages:
        result["pages"] = json.loads(row["pages_json"])
        result["extracted_fields"] = documents.field_candidates(result["pages"], row["id"])
    return result


def owned(db, identifier, user_id):
    row = db.execute("SELECT * FROM temporary_documents WHERE id=? AND user_id=? AND expires_at>?", (identifier, user_id, time.time())).fetchone()
    if not row:
        raise HTTPException(404, "Temporary document not found or expired.")
    return row


@router.post("/temporary-documents")
def upload_temporary(file: UploadFile = File(...), kind: str = Form("policy"), user=Depends(core.current_user)):
    if kind not in KINDS:
        raise HTTPException(422, "Unsupported document kind.")
    purge_expired(user["id"])
    raw = file.file.read(documents.MAX_SIZE + 1)
    if not raw or len(raw) > documents.MAX_SIZE:
        raise HTTPException(413, "Upload a nonempty file of at most 15 MB.")
    media = "application/pdf" if raw.startswith(b"%PDF-") else "image/png" if raw.startswith(b"\x89PNG\r\n\x1a\n") else "image/jpeg" if raw.startswith(b"\xff\xd8\xff") else "text/plain" if (file.filename or "").lower().endswith(".txt") else None
    if not media:
        raise HTTPException(415, "Use PDF, JPG, PNG or UTF-8 TXT with matching content.")
    pages, status = documents.extract_pages(raw, media)
    identifier = core.uid("tmp_")
    suffix = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "text/plain": ".txt"}[media]
    path = core.UPLOAD_DIR / (identifier + suffix)
    with core.get_db() as db:
        total = db.execute("SELECT COALESCE(SUM(size),0) FROM temporary_documents WHERE user_id=?", (user["id"],)).fetchone()[0]
        stored = db.execute("SELECT COALESCE(SUM(size),0) FROM documents WHERE user_id=?", (user["id"],)).fetchone()[0]
        if total + stored + len(raw) > 150 * 1024 * 1024:
            raise HTTPException(413, "Workspace storage quota exceeded.")
        path.write_bytes(raw)
        name = Path((file.filename or "document").replace("\\", "/")).name[:180]
        db.execute("INSERT INTO temporary_documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (identifier, user["id"], name, kind, media, len(raw), str(path), json.dumps(pages, ensure_ascii=False), status, hashlib.sha256(raw).hexdigest(), time.time() + TTL, core.now_iso()))
        consent(db, user["id"], "temporary_document_processing", True, identifier)
        core.audit(db, user["id"], "temporary_document_processed", "document", identifier, {"indexed": False})
        return {"document": view(owned(db, identifier, user["id"]), True), "policy": None}


@router.get("/temporary-documents")
def list_temporary(user=Depends(core.current_user)):
    purge_expired(user["id"])
    with core.get_db() as db:
        return {"documents": [view(r) for r in db.execute("SELECT * FROM temporary_documents WHERE user_id=? AND expires_at>? ORDER BY created_at DESC", (user["id"], time.time()))]}


@router.get("/temporary-documents/{identifier}")
def get_temporary(identifier: str, user=Depends(core.current_user)):
    purge_expired(user["id"])
    with core.get_db() as db:
        return view(owned(db, identifier, user["id"]), True)


@router.get("/temporary-documents/{identifier}/file")
def get_temporary_file(identifier: str, user=Depends(core.current_user)):
    purge_expired(user["id"])
    with core.get_db() as db:
        row = owned(db, identifier, user["id"])
        path = Path(row["storage_path"]).resolve()
        if path.parent != core.UPLOAD_DIR.resolve() or not path.is_file():
            raise HTTPException(404, "Original not available.")
        return FileResponse(path, media_type=row["media_type"], filename=row["name"], headers={"Cache-Control": "no-store"})


@router.delete("/temporary-documents/{identifier}")
def delete_temporary(identifier: str, user=Depends(core.current_user)):
    with core.get_db() as db:
        row = owned(db, identifier, user["id"])
        path = Path(row["storage_path"]).resolve()
        if path.parent == core.UPLOAD_DIR.resolve():
            path.unlink(missing_ok=True)
        db.execute("DELETE FROM temporary_documents WHERE id=? AND user_id=?", (identifier, user["id"]))
        consent(db, user["id"], "temporary_document_retention", False, identifier)
        core.audit(db, user["id"], "temporary_document_deleted", "document", identifier)
    return {"ok": True, "indexed": False, "notice": "Removed from the current store. Historical snapshots or downloaded copies are outside this deletion."}


class SaveTemporary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["policy", "evidence", "medical_report", "financial_report"] = "policy"
    policy_id: str | None = None
    claim_id: str | None = None
    consent: bool


@router.post("/temporary-documents/{identifier}/save")
def save_temporary(identifier: str, payload: SaveTemporary, user=Depends(core.current_user)):
    if not payload.consent:
        raise HTTPException(422, "Explicit saving consent is required.")
    purge_expired(user["id"])
    with core.get_db() as db:
        db.execute("BEGIN IMMEDIATE")
        temp = owned(db, identifier, user["id"])
        for table, value in (("policies", payload.policy_id), ("claims", payload.claim_id)):
            if value and not db.execute(f"SELECT 1 FROM {table} WHERE id=? AND user_id=?", (value, user["id"])).fetchone():
                raise HTTPException(404, "Linked resource not found.")
        path = Path(temp["storage_path"]).resolve()
        if path.parent != core.UPLOAD_DIR.resolve() or not path.is_file():
            raise HTTPException(404, "Temporary original not available.")
        document = documents.save_document(db, user["id"], path.read_bytes(), temp["name"], temp["media_type"], payload.kind, payload.claim_id, json.loads(temp["pages_json"]), temp["ocr_status"])
        policy = None
        if payload.kind == "policy":
            if payload.policy_id:
                documents._remove_derived_exports(db, user["id"], [payload.policy_id])
                db.execute("INSERT INTO policy_documents VALUES(?,?)", (payload.policy_id, document["id"]))
                db.execute("UPDATE policies SET confirmed=0,revision=revision+1 WHERE id=? AND user_id=?", (payload.policy_id, user["id"]))
                policy = db.execute("SELECT * FROM policies WHERE id=? AND user_id=?", (payload.policy_id, user["id"])).fetchone()
            else:
                policy = documents.create_policy(db, document)
        consent(db, user["id"], "save_document_until_deleted", True, document["id"])
        db.execute("DELETE FROM temporary_documents WHERE id=? AND user_id=?", (identifier, user["id"]))
        path.unlink(missing_ok=True)
        core.audit(db, user["id"], "temporary_document_explicitly_saved", "document", document["id"])
        return {"document": documents.document_dict(document, True), "policy": documents.policy_dict(db, policy) if policy else None}


@router.post("/temporary-documents/cleanup/expired")
def cleanup(user=Depends(core.current_user)):
    return {"deleted": purge_expired(user["id"])}


@router.get("/vault")
def vault(user=Depends(core.current_user)):
    purge_expired(user["id"])
    with core.get_db() as db:
        exports = [dict(r) | {"pdf_url": f"/api/exports/{r['id']}/pdf", "zip_url": f"/api/exports/{r['id']}/zip" if r["zip_path"] else None} for r in db.execute("SELECT id,kind,mode,created_at,zip_path FROM workflow_exports WHERE user_id=? ORDER BY created_at DESC", (user["id"],))] if db.execute("SELECT 1 FROM sqlite_master WHERE name='workflow_exports'").fetchone() else []
        return {"documents": [documents.document_dict(r) for r in db.execute("SELECT * FROM documents WHERE user_id=? ORDER BY created_at DESC", (user["id"],))],
                "temporary_documents": [view(r) for r in db.execute("SELECT * FROM temporary_documents WHERE user_id=? AND expires_at>?", (user["id"], time.time()))],
                "exports": [{k: v for k, v in e.items() if k != "zip_path"} for e in exports],
                "consents": [dict(r) for r in db.execute("SELECT id,purpose,granted,entity_id,created_at FROM processing_consents WHERE user_id=? ORDER BY created_at DESC LIMIT 200", (user["id"],))],
                "notice": "Temporary files are excluded from policy retrieval. Saving and deletion act on current app storage, not separately retained snapshots or copies you download."}


@router.delete("/vault/exports/{identifier}")
def delete_export(identifier: str, confirmed: bool = Query(False), user=Depends(core.current_user)):
    if not confirmed:
        raise HTTPException(422, "Confirm deleting this current-store export.")
    with core.get_db() as db:
        row = db.execute("SELECT * FROM workflow_exports WHERE id=? AND user_id=?", (identifier, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Export not found.")
        for key in ("pdf_path", "zip_path"):
            if not row[key]:
                continue
            path = Path(row[key]).resolve()
            if core.DATA_DIR.resolve() in path.parents:
                path.unlink(missing_ok=True)
        db.execute("DELETE FROM workflow_exports WHERE id=? AND user_id=?", (identifier, user["id"]))
        core.audit(db, user["id"], "private_export_deleted", "export", identifier)
    return {"ok": True, "notice": "Current-store export revoked. Copies already downloaded and historical hosting snapshots are separate."}


@router.get("/consents")
def list_consents(user=Depends(core.current_user)):
    with core.get_db() as db:
        return {"consents": [dict(r) for r in db.execute("SELECT id,purpose,granted,entity_id,created_at FROM processing_consents WHERE user_id=? ORDER BY created_at DESC LIMIT 200", (user["id"],))]}
