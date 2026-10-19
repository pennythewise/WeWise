"""Real local Tencent sidecar checks. Enable WEWISE_TEST_TENCENT=1 explicitly.

No model API is invoked. Random application users prevent test writes from
altering the demo customer's namespace. Local .env is read without printing it.
"""
import os
import secrets
from pathlib import Path

import httpx
import pytest
from dotenv import dotenv_values
from backend.app import memory

pytestmark = [pytest.mark.integration, pytest.mark.task]


@pytest.fixture
def tencent(client, monkeypatch):
    if os.getenv("WEWISE_TEST_TENCENT") != "1":
        pytest.skip("Local Tencent verification is opt-in.")
    config = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
    assert config.get("TDAI_GATEWAY_API_KEY"), "Local sidecar key required"
    monkeypatch.setenv("TENCENT_MEMORY_URL", config.get("TENCENT_MEMORY_URL", "http://127.0.0.1:8420"))
    monkeypatch.setenv("TDAI_GATEWAY_API_KEY", config["TDAI_GATEWAY_API_KEY"])
    response = client.post("/api/auth/register", json={"email": f"synthetic-{secrets.token_hex(8)}@wewise.test", "password": "TestMemory2026!", "display_name": "Synthetic memory QA"})
    assert response.status_code == 200
    user_id = response.json()["user"]["id"]
    assert client.patch("/api/preferences", json={"memory_enabled": True}).status_code == 200
    return client, user_id


def test_tencent_approved_projection_roundtrip_and_private_namespace(tencent):
    client, user_id = tencent
    response = client.post("/api/memory", json={"key": "communication_preferences", "value": "Use concise explanations", "approved": True})
    assert response.json()["sync_state"] == "synced"
    facts, engine = memory.approved_context(user_id)
    assert engine == "tencent_memorycore_verified_projection"
    assert facts == [{"key": "communication_preferences", "value": "Use concise explanations"}]
    base, key = memory.tencent_config()
    headers = {"Authorization": "Bearer " + key, "x-tdai-service-id": "wewise-hackathon"}
    unrelated = httpx.post(base + "/v3/core/read", headers=headers, json=memory.private_scope("another-synthetic-user"))
    assert unrelated.status_code == 200
    assert "Use concise explanations" not in str(unrelated.json())
    client.delete("/api/memory/" + response.json()["id"])


def test_tencent_edit_delete_excludes_old_fact_from_actual_readback(tencent):
    client, user_id = tencent
    identifier = client.post("/api/memory", json={"key": "preferred_language", "value": "English", "approved": True}).json()["id"]
    assert client.patch("/api/memory/" + identifier, json={"value": "中文", "approved": True}).json()["sync_state"] == "synced"
    assert memory.approved_context(user_id) == ([{"key": "preferred_language", "value": "中文"}], "tencent_memorycore_verified_projection")
    assert client.delete("/api/memory/" + identifier).json()["sync_state"] == "synced"
    assert memory.approved_context(user_id) == ([], "tencent_memorycore_verified_projection")


@pytest.mark.attack
def test_tencent_gateway_auth_and_strict_scope(tencent):
    base, key = memory.tencent_config()
    assert httpx.post(base + "/v3/core/read", json={}).status_code == 401
    response = httpx.post(base + "/v3/core/read", headers={"Authorization": "Bearer " + key, "x-tdai-service-id": "wewise-hackathon"}, json={})
    assert response.status_code in {400, 422}
    assert "scope" in response.text.lower() or "isolation" in response.text.lower() or "required" in response.text.lower()
