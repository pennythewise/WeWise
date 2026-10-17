"""Executable public-preview boundaries; no real provider credentials or calls."""
import asyncio

from fastapi.testclient import TestClient
import pytest

from backend.app import core, intelligence


@pytest.mark.task
def test_demo_bootstrap_creates_private_synthetic_documents(client, stranger):
    first = client.post("/api/auth/demo", json={"user_id": "usr_mei"})
    second = stranger.post("/api/auth/demo", json={})
    assert first.status_code == second.status_code == 200
    a, b = first.json(), second.json()
    assert a["user"]["id"] != b["user"]["id"]
    assert a["user"]["id"] not in {"usr_mei", "usr_other"}
    assert a["synthetic"] is True and a["shared_account"] is False
    pa = client.get("/api/policies").json()["policies"]
    pb = stranger.get("/api/policies").json()["policies"]
    assert len(pa) == len(pb) == 1
    assert pa[0]["id"] != pb[0]["id"]
    assert pa[0]["fields"]["synthetic"] is True
    assert len(pa[0]["documents"]) == 2
    assert client.get("/api/policies/" + pb[0]["id"]).status_code == 404
    assert stranger.get("/api/documents/" + pa[0]["document_id"] + "/file").status_code == 404


@pytest.mark.attack
def test_demo_bootstrap_uses_auth_rate_limit(client):
    core._login_limits["testclient"] = [core.time.time()] * 20
    assert client.post("/api/auth/demo").status_code == 429


@pytest.mark.task
def test_demo_workspaces_can_be_disabled(client, monkeypatch):
    monkeypatch.setenv("WEWISE_DEMO_WORKSPACES", "0")
    assert client.post("/api/auth/demo").status_code == 404


@pytest.mark.attack
@pytest.mark.parametrize("provider", ["anthropic", "openai_compatible", "qwen"])
def test_enforced_retrieval_never_constructs_model_transport(client, monkeypatch, provider):
    monkeypatch.setenv("WEWISE_RETRIEVAL_ONLY", "1")
    monkeypatch.setenv("AI_PROVIDER", provider)
    monkeypatch.setenv("AI_MODEL", "fixture-model-not-real")
    monkeypatch.setenv("AI_API_KEY", "fixture-compatible-key-not-real")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fixture-anthropic-key-not-real")

    def forbidden(*args, **kwargs):
        raise AssertionError("Forced retrieval must not construct a provider transport.")
    monkeypatch.setattr(intelligence.httpx, "AsyncClient", forbidden)
    health = client.get("/api/health").json()["ai"]
    assert health["engine"] == "retrieval_only"
    assert health["configured"] is False and health["retrieval_only_enforced"] is True
    assert health["configuration_issue"] == "retrieval_only_enforced"
    with pytest.raises(RuntimeError, match="model_unconfigured"):
        asyncio.run(intelligence.request_json("fixture", "{}"))
    pid = client.get("/api/policies").json()["policies"][0]["id"]
    assert client.patch("/api/policies/" + pid, json={"fields": {}, "confirmed": True}).status_code == 200
    reply = client.post("/api/chat", json={"message": "What outpatient claim documents are needed?", "policy_id": pid, "locale": "en"})
    assert reply.status_code == 200, reply.text
    answer = reply.json()
    assert answer["engine"] == "retrieval_only" and answer["citations"]
    assert any(step["stage"] == "model" and step["status"] == "disabled" for step in answer["trace"])
    translation = client.post("/api/assistance-summary", json={"text": "I fell in Tokyo.", "locale": "ja", "consent_external_processing": True}).json()
    assert translation["translated"] is False and "external model calls are disabled" in translation["notice"]


@pytest.mark.attack
def test_https_preview_cookie_and_reverse_proxy_origin(client, monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "1")
    monkeypatch.setenv("WEWISE_ENV", "production")
    monkeypatch.setenv("WEWISE_ALLOWED_ORIGINS", "https://preview.wewise.test")
    # The backend can see HTTP while its exact public HTTPS origin is configured.
    accepted = client.post("/api/auth/demo", headers={"Origin": "https://preview.wewise.test"})
    assert accepted.status_code == 200
    cookie = accepted.headers["set-cookie"].lower()
    assert "secure" in cookie and "httponly" in cookie and "samesite=strict" in cookie
    assert client.post("/api/auth/demo", headers={"Origin": "https://attacker.test"}).status_code == 403
    with TestClient(client.app, base_url="https://preview.wewise.test") as secure:
        assert secure.post("/api/auth/demo", headers={"Origin": "https://preview.wewise.test"}).status_code == 200
        assert secure.get("/api/auth/me").status_code == 200


@pytest.mark.task
def test_shared_seed_accounts_disabled_for_fresh_public_store(client, monkeypatch, tmp_path):
    monkeypatch.setenv("WEWISE_SEED_DEMO", "0")
    monkeypatch.setattr(core, "DATA_DIR", tmp_path / "fresh-public")
    monkeypatch.setattr(core, "UPLOAD_DIR", tmp_path / "fresh-public" / "uploads")
    core.init_db()
    with core.get_db() as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
