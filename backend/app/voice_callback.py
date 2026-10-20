"""Optional AI voice callback through Vapi (https://vapi.ai).

POST /api/voice-callback asks the WeWise calming assistant (a Vapi assistant) to ring
a phone. The Vapi key stays on the server (.env). Protection against misuse:
- VOICE_CALLBACK_ALLOWED_NUMBERS: comma-separated E.164 numbers that may be called
  without signing in (for demos, e.g. +6591234567). Any other number needs a signed-in user.
- Per-number cooldown and daily limit, plus a global hourly cap.
This is a calming/orientation call. It does not dispatch emergency services, diagnose,
or submit anything to an insurer.
"""
from __future__ import annotations

import os
import re
import threading
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api", tags=["voice callback"])
VAPI_URL = os.getenv("VAPI_API_URL", "https://api.vapi.ai/call")  # overridable for tests
E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_lock = threading.Lock()
_by_number: dict[str, list[float]] = {}
_all: list[float] = []


def init_db() -> None:  # registered as a feature module; no tables needed
    return None


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _clean(phone: str) -> str:
    return re.sub(r"[\s\-()]", "", phone)


def configured() -> bool:
    return bool(_env("VAPI_API_KEY") and _env("VAPI_ASSISTANT_ID") and _env("VAPI_PHONE_NUMBER_ID"))


def _allowed() -> set[str]:
    return {_clean(n) for n in _env("VOICE_CALLBACK_ALLOWED_NUMBERS").split(",") if n.strip()}


def _signed_in(request: Request) -> bool:
    try:
        from .core import current_user  # reuse the accounts module's session check
        current_user(request)
        return True
    except Exception:
        return False


class CallbackRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    phone: str = Field(min_length=8, max_length=24)
    lang: str = Field(default="zh", max_length=5)
    city: str = Field(default="", max_length=40)
    consent: bool = False


@router.get("/voice-callback")
def status():
    return {"configured": configured(), "provider": "vapi" if configured() else None,
            "allowlist": bool(_allowed()),
            "notice": "The AI calls your phone to help you stay calm and organise next steps. It does not contact emergency services."}


@router.post("/voice-callback")
async def request_callback(payload: CallbackRequest, request: Request):
    if not configured():
        raise HTTPException(503, "The AI phone line is not configured on this server.")
    if not payload.consent:
        raise HTTPException(422, "Please confirm you agree to receive the call.")
    phone = _clean(payload.phone)
    if not E164.match(phone):
        raise HTTPException(422, "Use international format, for example +6591234567.")
    allowed = _allowed()
    if phone not in allowed and not _signed_in(request):
        raise HTTPException(403, "This number is not enabled for AI calls on this demo server. Add it to VOICE_CALLBACK_ALLOWED_NUMBERS in .env.")

    cooldown = int(_env("VOICE_CALLBACK_COOLDOWN", "120"))
    daily = int(_env("VOICE_CALLBACK_DAILY_LIMIT", "10"))
    hourly_cap = int(_env("VOICE_CALLBACK_HOURLY_CAP", "20"))
    now = time.time()
    with _lock:
        recent = [t for t in _by_number.get(phone, []) if now - t < 86400]
        _all[:] = [t for t in _all if now - t < 3600]
        if recent and now - recent[-1] < cooldown:
            raise HTTPException(429, f"A call to this number was just requested. Please wait {int(cooldown - (now - recent[-1]))} seconds.")
        if len(recent) >= daily:
            raise HTTPException(429, "Daily call limit reached for this number.")
        if len(_all) >= hourly_cap:
            raise HTTPException(429, "Too many calls this hour on this server. Try again later.")
        recent.append(now); _by_number[phone] = recent; _all.append(now)

    body = {"assistantId": _env("VAPI_ASSISTANT_ID"), "phoneNumberId": _env("VAPI_PHONE_NUMBER_ID"), "customer": {"number": phone},
            "metadata": {"source": "wewise", "lang": payload.lang, "city": payload.city}}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15, connect=8), follow_redirects=False) as client:
            response = await client.post(VAPI_URL, json=body, headers={"Authorization": f"Bearer {_env('VAPI_API_KEY')}"})
    except httpx.HTTPError:
        _undo(phone)
        raise HTTPException(502, "Could not reach Vapi. Use the emergency numbers on this page.")
    if response.status_code >= 400:
        _undo(phone)
        try:
            detail = str(response.json().get("message", ""))[:300]
        except ValueError:
            detail = response.text[:300]
        raise HTTPException(502, f"Vapi refused the call ({response.status_code}): {detail}")
    data = response.json()
    return {"ok": True, "call_id": str(data.get("id", "")), "status": data.get("status"), "to": phone[:4] + "****" + phone[-3:]}


def _undo(phone: str) -> None:  # a failed attempt should not use up the cooldown
    with _lock:
        if _by_number.get(phone):
            _by_number[phone].pop()
        if _all:
            _all.pop()
