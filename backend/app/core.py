"""Application-owned identity, isolation and durable storage primitives.

Opaque sessions stay outside AI context. SQLite is the authoritative local store;
every caller must constrain owned data with the authenticated user id.
"""
from __future__ import annotations

import contextlib
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("WEWISE_DATA_DIR", str(ROOT / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
COOKIE_NAME = "wewise_session"
SESSION_SECONDS = 60 * 60 * 12
router = APIRouter(prefix="/api/auth", tags=["identity"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid(prefix: str = "") -> str:
    return prefix + secrets.token_hex(12)


@contextlib.contextmanager
def get_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATA_DIR / "wewise.sqlite3", timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def audit(db, user_id: str, action: str, entity_type: str = "system", entity_id: str | None = None, details: Any = None):
    """Log operational metadata only, never document text, keys or contact PII."""
    db.execute("INSERT INTO audit_log(id,user_id,action,entity_type,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
               (uid("aud_"), user_id, action, entity_type, entity_id, json.dumps(details or {}, ensure_ascii=False), now_iso()))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split("$")
        return algorithm == "pbkdf2_sha256" and hmac.compare_digest(
            hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds)).hex(), expected)
    except (ValueError, TypeError):
        return False


def init_db():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,display_name TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT,entity_id TEXT,details_json TEXT,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,claim_id TEXT,name TEXT NOT NULL,media_type TEXT NOT NULL,size INTEGER NOT NULL,storage_path TEXT NOT NULL,pages_json TEXT NOT NULL,text TEXT NOT NULL,sha256 TEXT NOT NULL,ocr_status TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS documents_owner ON documents(user_id);
        CREATE TABLE IF NOT EXISTS policies(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,title TEXT NOT NULL,insurer TEXT NOT NULL DEFAULT '',policy_number TEXT NOT NULL DEFAULT '',insured_name TEXT NOT NULL DEFAULT '',start_date TEXT NOT NULL DEFAULT '',end_date TEXT NOT NULL DEFAULT '',family TEXT NOT NULL DEFAULT 'travel',fields_json TEXT NOT NULL DEFAULT '{}',confirmed INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS policies_owner ON policies(user_id);
        CREATE TABLE IF NOT EXISTS policy_documents(policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,PRIMARY KEY(policy_id,document_id));
        CREATE TABLE IF NOT EXISTS document_chunks(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,page INTEGER NOT NULL,text TEXT NOT NULL,quarantined INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS document_chunks_owner ON document_chunks(user_id,document_id);
        CREATE TABLE IF NOT EXISTS confirmations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,payload_json TEXT NOT NULL,payload_hash TEXT NOT NULL,expires_at REAL NOT NULL,used_at TEXT);
        """)
        try:
            db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(id UNINDEXED,user_id UNINDEXED,document_id UNINDEXED,text,tokenize='unicode61')")
        except sqlite3.OperationalError:
            pass
        if os.getenv("WEWISE_SEED_DEMO", "1") == "1":
            for identifier, email, name in [("usr_mei", "demo@wewise.test", "林美 · Synthetic demo"), ("usr_other", "other@wewise.test", "Second synthetic account")]:
                db.execute("INSERT OR IGNORE INTO users(id,email,password_hash,display_name,created_at) VALUES(?,?,?,?,?)",
                           (identifier, email, hash_password("WeWiseDemo2026!"), name, now_iso()))


def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME, "")
    if not token or len(token) > 256:
        raise HTTPException(401, "Please sign in to access your private information.")
    with get_db() as db:
        row = db.execute("SELECT u.id,u.email,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
                         (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    if not row:
        raise HTTPException(401, "Session expired. Please sign in again.")
    return dict(row)


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=256)
    display_name: str = Field(default="WeWise user", min_length=1, max_length=80)


def set_session(db, user_id, response):
    token = secrets.token_urlsafe(40)
    db.execute("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user_id, time.time() + SESSION_SECONDS))
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=os.getenv("COOKIE_SECURE", "0") == "1", samesite="strict", max_age=SESSION_SECONDS, path="/")


_login_limits: dict[str, list[float]] = {}


def auth_rate_limit(request: Request):
    key = request.client.host if request.client else "unknown"
    recent = [t for t in _login_limits.get(key, []) if t > time.time() - 60]
    if len(recent) >= 20:
        raise HTTPException(429, "Too many authentication attempts. Try again in a minute.")
    recent.append(time.time())
    _login_limits[key] = recent


@router.post("/register")
def register(payload: Credentials, request: Request, response: Response):
    auth_rate_limit(request)
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "A valid email address is required.")
    user = {"id": uid("usr_"), "email": email, "display_name": payload.display_name}
    with get_db() as db:
        try:
            db.execute("INSERT INTO users VALUES(?,?,?,?,?)", (user["id"], email, hash_password(payload.password), payload.display_name, now_iso()))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An account with this email already exists.")
        set_session(db, user["id"], response)
        audit(db, user["id"], "account_registered")
    return {"user": user}


@router.post("/login")
def login(payload: Credentials, request: Request, response: Response):
    auth_rate_limit(request)
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (payload.email.strip().lower(),)).fetchone()
        if not row or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(401, "Email or password is incorrect.")
        set_session(db, row["id"], response)
        audit(db, row["id"], "session_started")
        user = {k: row[k] for k in ("id", "email", "display_name")}
    return {"user": user}


@router.post("/demo")
def private_demo(request: Request, response: Response):
    """Start a fresh, isolated synthetic workspace without shared credentials."""
    auth_rate_limit(request)
    if os.getenv("WEWISE_DEMO_WORKSPACES", "1") != "1":
        raise HTTPException(404, "Synthetic demo workspaces are disabled.")
    user_id = uid("usr_")
    user = {"id": user_id, "email": f"demo+{user_id}@wewise.test", "display_name": "林美 · Private synthetic demo"}
    with get_db() as db:
        db.execute("INSERT INTO users VALUES(?,?,?,?,?)", (user_id, user["email"], hash_password(secrets.token_urlsafe(40)), user["display_name"], now_iso()))
    # Import after module initialization: document ownership primitives live here.
    from .documents import seed_demo_documents
    seed_demo_documents(user_id)
    with get_db() as db:
        set_session(db, user_id, response)
        audit(db, user_id, "private_synthetic_workspace_started", details={"shared_account": False})
    return {"user": user, "synthetic": True, "shared_account": False,
            "notice": "This private synthetic workspace uses a browser session. Signing out ends access; start another demo or register a separate account. Never upload real personal data."}


@router.get("/me")
def me(user=Depends(current_user)):
    return {"user": user}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME, "")
    with get_db() as db:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="strict")
    return {"ok": True}
