"""Explicitly approved memory; never an authority for policy or action decisions.

SQLite is the approval ledger. Optional Tencent MemoryCore mirrors only this
ledger into one private team+agent namespace per customer. Nothing is auto-learned
from chat, medical reports, claim evidence or uploaded instructions.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .core import audit, current_user, get_db, now_iso, uid

router = APIRouter(prefix="/api", tags=["approved memory and transparency"])
MEMORY_KEYS = {"preferred_language", "travel_preferences", "budget_preferences", "communication_preferences", "accessibility_preferences"}
UNSAFE_MEMORY = re.compile(r"ignore (?:all|previous)|system prompt|developer message|bypass|override|忽略.{0,8}(?:指令|规则)|绕过|系统提示|api[_ -]?key|bearer\s+[a-z0-9]|\bsk-[a-z0-9]{8,}|\b\d{17}[\dXx]\b", re.I)


def init_memory_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,value TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,key));
        CREATE TABLE IF NOT EXISTS preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,locale TEXT NOT NULL DEFAULT 'zh',memory_enabled INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memory_sync(user_id TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at TEXT NOT NULL);
        """)


def tencent_config():
    base = os.getenv("TENCENT_MEMORY_URL", "").rstrip("/")
    key = os.getenv("TDAI_GATEWAY_API_KEY", "")
    return base, key


def memory_health():
    base, key = tencent_config()
    status = {"engine": "local_approved_ledger", "tencent_configured": bool(base and key), "tencent_verified": False, "automatic_capture": False, "default_enabled": False}
    if base and key and urlparse(base).hostname in {"127.0.0.1", "localhost"}:
        try:
            response = httpx.get(base + "/health", timeout=1.5, follow_redirects=False)
            response.raise_for_status()
            info = response.json()
            status.update(engine="tencent_memorycore_projection", tencent_verified=info.get("status") in {"ok", "healthy"}, upstream_status=info.get("status"), upstream_version=info.get("version"))
        except (httpx.HTTPError, ValueError):
            status["notice"] = "Tencent sidecar is unavailable; approved local ledger remains authoritative."
    return status


def private_scope(user_id):
    # L2/L3 can aggregate by team+agent in the upstream implementation. Both
    # identifiers therefore belong to exactly one customer, assigned server-side.
    digest = hashlib.sha256(("wewise-private-v1:" + user_id).encode()).hexdigest()[:32]
    return {"team_id": "customer_" + digest, "agent_id": "assistant_" + digest, "user_id": "user_" + digest}


def memory_preferences(db, user_id):
    row = db.execute("SELECT locale,memory_enabled FROM preferences WHERE user_id=?", (user_id,)).fetchone()
    return {"locale": row["locale"] if row else "zh", "memory_enabled": bool(row["memory_enabled"]) if row else False}


def sync_approved_memory(user_id):
    base, key = tencent_config()
    if not base or not key:
        return "not_configured"
    parsed = urlparse(base)
    if parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.scheme != "http":
        return "blocked_nonlocal_gateway"
    with get_db() as db:
        enabled = memory_preferences(db, user_id)["memory_enabled"]
        rows = db.execute("SELECT key,value FROM memories WHERE user_id=? ORDER BY key", (user_id,)).fetchall() if enabled else []
    # Treat memory values as data. Clear/replace the complete projection so edits
    # and deletions cannot leave an old fact in the next recalled profile.
    content = json.dumps({"approved_preferences": [dict(r) for r in rows]}, ensure_ascii=False)
    try:
        with httpx.Client(timeout=4, follow_redirects=False) as client:
            headers = {"Authorization": "Bearer " + key, "x-tdai-service-id": "wewise-hackathon"}
            result = client.post(base + "/v3/core/write", headers=headers, json={**private_scope(user_id), "content": content})
            result.raise_for_status()
            if result.json().get("code") != 0:
                raise ValueError("upstream rejected projection")
        state = "synced"
    except (httpx.HTTPError, ValueError, KeyError):
        state = "pending_retry"
    with get_db() as db:
        db.execute("INSERT INTO memory_sync VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at", (user_id, state, now_iso()))
    return state


def approved_context(user_id):
    """Authoritative approved preferences only; never consume upstream history.

    Tencent readback must equal the current ledger before it is usable. An old,
    unavailable or poisoned mirror cannot resurrect deleted/private data.
    """
    def current_ledger():
        with get_db() as db:
            enabled = memory_preferences(db, user_id)["memory_enabled"]
            return enabled, [dict(r) for r in db.execute("SELECT key,value FROM memories WHERE user_id=? ORDER BY key", (user_id,))] if enabled else []
    enabled, rows = current_ledger()
    if not enabled:
        return [], "disabled"
    base, key = tencent_config()
    if not base or not key:
        return rows, "local_approved_ledger"
    parsed = urlparse(base)
    if parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.scheme != "http":
        return rows, "local_approved_ledger"
    remote = None
    try:
        with httpx.Client(timeout=3, follow_redirects=False) as client:
            result = client.post(base + "/v3/core/read", headers={"Authorization": "Bearer " + key, "x-tdai-service-id": "wewise-hackathon"}, json=private_scope(user_id))
            result.raise_for_status()
            data = result.json()
            if data.get("code") == 0:
                remote = json.loads(data["data"]["content"])
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        pass
    # A delete/edit/disable can commit while the sidecar request is in flight.
    # Never fall back to that earlier snapshot after network I/O.
    enabled, fresh_rows = current_ledger()
    if not enabled:
        return [], "disabled"
    if remote == {"approved_preferences": fresh_rows}:
        return fresh_rows, "tencent_memorycore_verified_projection"
    return fresh_rows, "local_approved_ledger_mirror_unavailable"


class PreferenceUpdate(BaseModel):
    locale: str | None = Field(default=None, pattern="^(zh|en)$")
    memory_enabled: bool | None = None


class MemoryInput(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=500)
    approved: bool = False


class MemoryEdit(BaseModel):
    value: str = Field(min_length=1, max_length=500)
    approved: bool = False


def check_memory(key, value, approved):
    if not approved:
        raise HTTPException(422, "Please explicitly approve the exact memory before saving it.")
    if key not in MEMORY_KEYS:
        raise HTTPException(422, "Use a supported preference category. Medical, identity and policy facts stay outside long-term memory.")
    if not value.strip():
        raise HTTPException(422, "Enter a preference before saving.")
    if UNSAFE_MEMORY.search(value) or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", value):
        raise HTTPException(422, "Memory must contain a preference, not credentials, identity numbers or instructions to override safeguards.")


@router.get("/preferences")
def preferences(user=Depends(current_user)):
    with get_db() as db:
        return memory_preferences(db, user["id"])


@router.patch("/preferences")
def update_preferences(payload: PreferenceUpdate, user=Depends(current_user)):
    with get_db() as db:
        values = memory_preferences(db, user["id"])
        values.update(payload.model_dump(exclude_none=True))
        db.execute("INSERT INTO preferences VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale,memory_enabled=excluded.memory_enabled,updated_at=excluded.updated_at", (user["id"], values["locale"], int(values["memory_enabled"]), now_iso()))
        if payload.memory_enabled is not None:
            from .lifecycle import consent
            consent(db, user["id"], "approved_memory_personalization", payload.memory_enabled)
        audit(db, user["id"], "preferences_updated", details={"fields": list(payload.model_dump(exclude_none=True))})
    if payload.memory_enabled is not None:
        sync_approved_memory(user["id"])
    return values


@router.get("/memory")
def list_memory(user=Depends(current_user)):
    with get_db() as db:
        rows = [dict(r) for r in db.execute("SELECT id,key,value,source,updated_at FROM memories WHERE user_id=? ORDER BY updated_at DESC", (user["id"],))]
        values = memory_preferences(db, user["id"])
        sync = db.execute("SELECT state,updated_at FROM memory_sync WHERE user_id=?", (user["id"],)).fetchone()
    base, key = tencent_config()
    return {"memories": rows, **values, "supported_keys": sorted(MEMORY_KEYS), "engine": "tencent_memorycore_projection" if base and key else "local_approved_ledger", "sync": dict(sync) if sync else {"state": "not_configured" if not base or not key else "not_synced"}, "retention": "Until you delete; disabled preferences are not used. Upstream version history requires separate purge; local deletion takes effect immediately."}


@router.post("/memory")
def create_memory(payload: MemoryInput, user=Depends(current_user)):
    value = payload.value.strip()
    check_memory(payload.key, value, payload.approved)
    with get_db() as db:
        if not memory_preferences(db, user["id"])["memory_enabled"]:
            raise HTTPException(409, "Enable approved memory first.")
        existing = db.execute("SELECT id FROM memories WHERE user_id=? AND key=?", (user["id"], payload.key)).fetchone()
        identifier = existing[0] if existing else uid("mem_")
        db.execute("INSERT INTO memories VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", (identifier, user["id"], payload.key, value, "user_approved", now_iso(), now_iso()))
        audit(db, user["id"], "memory_approved", "memory", identifier, {"category": payload.key})
    state = sync_approved_memory(user["id"])
    return {"id": identifier, "key": payload.key, "value": value, "source": "user_approved", "sync_state": state}


@router.patch("/memory/{memory_id}")
def edit_memory(memory_id: str, payload: MemoryEdit, user=Depends(current_user)):
    with get_db() as db:
        row = db.execute("SELECT * FROM memories WHERE id=? AND user_id=?", (memory_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Memory not found.")
        check_memory(row["key"], payload.value.strip(), payload.approved)
        db.execute("UPDATE memories SET value=?,updated_at=? WHERE id=? AND user_id=?", (payload.value.strip(), now_iso(), memory_id, user["id"]))
        audit(db, user["id"], "memory_edited", "memory", memory_id)
    return {"ok": True, "sync_state": sync_approved_memory(user["id"])}


@router.delete("/memory/{memory_id}")
def delete_memory(memory_id: str, user=Depends(current_user)):
    with get_db() as db:
        result = db.execute("DELETE FROM memories WHERE id=? AND user_id=?", (memory_id, user["id"]))
        if not result.rowcount:
            raise HTTPException(404, "Memory not found.")
        audit(db, user["id"], "memory_deleted", "memory", memory_id)
    return {"ok": True, "excluded_from_recall": True, "sync_state": sync_approved_memory(user["id"]), "upstream_history_purge": "not_claimed"}


@router.get("/audit")
def audit_events(user=Depends(current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM audit_log WHERE user_id=? ORDER BY created_at DESC LIMIT 200", (user["id"],)).fetchall()
    return {"events": [{"id": r["id"], "action": r["action"], "entity_type": r["entity_type"], "entity_id": r["entity_id"], "created_at": r["created_at"], "details": json.loads(r["details_json"])} for r in rows]}


def needs_defaults(user_id):
    """Only explicit enabled preferences; never infer wealth from reports."""
    rows, engine = approved_context(user_id)
    defaults, provenance = {}, []
    for row in rows:
        key, value = row["key"], str(row["value"])
        used = False
        if key == "budget_preferences":
            match = re.search(r"(?:CNY|RMB|人民币|预算|budget|¥|￥)?\s*(\d+(?:\.\d+)?)", value, re.I)
            if match and 0 <= float(match.group(1)) <= 10000000:
                defaults["budget"] = float(match.group(1))
                used = True
        elif key == "travel_preferences":
            if re.search(r"japan|日本", value, re.I):
                defaults["destination"] = "Japan"
            defaults["notes"] = value
            used = True
        elif key == "communication_preferences":
            defaults["communication_preferences"] = value
            used = True
        if used:
            provenance.append({"key": key, "value": value, "source": "user_approved"})
    return {"defaults": defaults, "provenance": provenance, "engine": engine,
            "notice": "Defaults come only from your enabled approved preferences. Edit them for this purchase; no medical or financial report is used to infer a budget. Current explicit inputs take priority."}


@router.get("/needs/defaults")
def get_needs_defaults(user=Depends(current_user)):
    result = needs_defaults(user["id"])
    with get_db() as db:
        audit(db, user["id"], "approved_preferences_reused_for_needs", "memory", None, {"categories": [p["key"] for p in result["provenance"]]})
    return result
