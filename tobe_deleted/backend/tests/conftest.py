"""Each test uses a fresh private data directory, never the running demo store."""
import pytest
from fastapi.testclient import TestClient
from backend.app import core, documents, workflows
from backend.app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(core, "DATA_DIR", tmp_path)
    monkeypatch.setattr(core, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(documents, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(documents, "DATA_DIR", tmp_path)
    monkeypatch.setattr(workflows, "DATA_DIR", tmp_path)
    monkeypatch.setattr(workflows, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(workflows, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setenv("WEWISE_SEED_DEMO", "1")
    for name in ("AI_API_KEY", "ANTHROPIC_API_KEY", "TYPESAFE_API_KEY", "WEWISE_EMBEDDING_DIR", "TENCENT_MEMORY_URL", "TDAI_GATEWAY_API_KEY", "WEWISE_RETRIEVAL_ONLY", "WEWISE_DEMO_WORKSPACES"):
        monkeypatch.delenv(name, raising=False)
    core._login_limits.clear()
    with TestClient(create_app()) as test_client:
        response = test_client.post("/api/auth/login", json={"email": "demo@wewise.test", "password": "WeWiseDemo2026!"})
        assert response.status_code == 200
        yield test_client


@pytest.fixture
def stranger(client):
    with TestClient(client.app) as other:
        response = other.post("/api/auth/login", json={"email": "other@wewise.test", "password": "WeWiseDemo2026!"})
        assert response.status_code == 200
        yield other
