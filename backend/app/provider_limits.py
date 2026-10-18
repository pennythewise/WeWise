"""Persistent, app-wide paid request ceilings for the public hackathon demo.

Reservations count attempts, including provider errors. No prompts, identities,
credentials or provider response bodies are stored. A storage failure denies
paid access; the caller continues with deterministic retrieval.
"""
from datetime import datetime, timezone
import os
import sqlite3

from . import core

DEFAULTS = {"claude": 200, "jev": 400, "compatible": 200}


def daily_limit(provider):
    if provider not in DEFAULTS:
        raise ValueError("Unknown provider")
    try:
        return max(0, min(100000, int(os.getenv(f"WEWISE_{provider.upper()}_DAILY_LIMIT", str(DEFAULTS[provider])))))
    except ValueError:
        return 0


def utc_day():
    return datetime.now(timezone.utc).date().isoformat()


def reserve(provider):
    ceiling = daily_limit(provider)
    if ceiling == 0:
        return False
    try:
        with core.get_db() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("CREATE TABLE IF NOT EXISTS provider_requests(provider TEXT NOT NULL,day TEXT NOT NULL,attempts INTEGER NOT NULL,PRIMARY KEY(provider,day))")
            db.execute("INSERT OR IGNORE INTO provider_requests VALUES(?,?,0)", (provider, utc_day()))
            result = db.execute("UPDATE provider_requests SET attempts=attempts+1 WHERE provider=? AND day=? AND attempts<?", (provider, utc_day(), ceiling))
            return result.rowcount == 1
    except (sqlite3.Error, OSError):
        return False


def limits_health():
    return {"scope": "global per UTC day; attempts include failed calls", "daily_requests": {name: daily_limit(name) for name in DEFAULTS}, "on_exhaustion": "retrieval and deterministic routing remain available"}
