import pytest
from backend.app import core, memory

pytestmark = pytest.mark.task


def enable(client):
    response = client.patch("/api/preferences", json={"memory_enabled": True})
    assert response.status_code == 200


def save(client, value="Use concise explanations"):
    return client.post("/api/memory", json={"key": "communication_preferences", "value": value, "approved": True})


def test_memory_defaults_to_disabled(client):
    assert client.get("/api/preferences").json()["memory_enabled"] is False
    assert client.get("/api/memory").json()["memories"] == []


def test_disabled_memory_cannot_be_added(client):
    assert save(client).status_code == 409


def test_memory_requires_approval(client):
    enable(client)
    assert client.post("/api/memory", json={"key": "preferred_language", "value": "中文"}).status_code == 422


def test_approved_memory_persists_across_session(client):
    enable(client)
    identifier = save(client).json()["id"]
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "demo@wewise.test", "password": "WeWiseDemo2026!"})
    assert client.get("/api/memory").json()["memories"][0]["id"] == identifier
    assert memory.approved_context("usr_mei")[0][0]["value"] == "Use concise explanations"


def test_edit_replaces_fact_and_delete_excludes_recall(client):
    enable(client)
    identifier = save(client).json()["id"]
    result = client.patch(f"/api/memory/{identifier}", json={"value": "Use detailed explanations", "approved": True})
    assert result.status_code == 200
    assert memory.approved_context("usr_mei")[0] == [{"key": "communication_preferences", "value": "Use detailed explanations"}]
    assert client.delete(f"/api/memory/{identifier}").json()["excluded_from_recall"]
    assert memory.approved_context("usr_mei")[0] == []


def test_disable_preserves_user_manageable_facts_but_blocks_usage(client):
    enable(client)
    save(client)
    client.patch("/api/preferences", json={"memory_enabled": False})
    assert memory.approved_context("usr_mei") == ([], "disabled")
    assert len(client.get("/api/memory").json()["memories"]) == 1


def test_memory_isolation(client, stranger):
    enable(client)
    identifier = save(client).json()["id"]
    assert stranger.get("/api/memory").json()["memories"] == []
    assert stranger.patch(f"/api/memory/{identifier}", json={"value": "stolen", "approved": True}).status_code == 404
    assert stranger.delete(f"/api/memory/{identifier}").status_code == 404


def test_audit_excludes_raw_memory_content(client, stranger):
    enable(client)
    save(client, "UNIQUE PRIVATE PREFERENCE FOR THIS ACCOUNT")
    log = client.get("/api/audit").json()
    assert "memory_approved" in str(log)
    assert "UNIQUE PRIVATE PREFERENCE" not in str(log)
    assert "memory_approved" not in str(stranger.get("/api/audit").json())


def test_preference_category_upsert_is_one_reviewable_fact(client):
    enable(client)
    a = save(client).json()
    b = save(client, "Use detailed explanations").json()
    assert a["id"] == b["id"]
    assert len(client.get("/api/memory").json()["memories"]) == 1


def test_private_scope_separates_both_upstream_team_and_agent():
    a, b = memory.private_scope("usr_mei"), memory.private_scope("usr_other")
    assert a["team_id"] != b["team_id"]
    assert a["agent_id"] != b["agent_id"]
    assert a == memory.private_scope("usr_mei")


@pytest.mark.attack
@pytest.mark.parametrize("mutation", ["delete", "disable", "edit"])
def test_concurrent_memory_mutation_during_sidecar_read_is_not_resurrected(client, monkeypatch, mutation):
    enable(client)
    identifier = save(client).json()["id"]
    monkeypatch.setenv("TENCENT_MEMORY_URL", "http://127.0.0.1:8420")
    monkeypatch.setenv("TDAI_GATEWAY_API_KEY", "fixture-no-external-call")
    class DelayedSidecar:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs):
            with core.get_db() as db:
                if mutation == "delete":
                    db.execute("DELETE FROM memories WHERE id=?", (identifier,))
                elif mutation == "disable":
                    db.execute("UPDATE preferences SET memory_enabled=0 WHERE user_id=?", ("usr_mei",))
                else:
                    db.execute("UPDATE memories SET value=? WHERE id=?", ("Use detailed explanations", identifier))
            class Response:
                def raise_for_status(self): pass
                def json(self): return {"code": 0, "data": {"content": '{"approved_preferences":[{"key":"communication_preferences","value":"Use concise explanations"}]}'}}
            return Response()
    monkeypatch.setattr(memory.httpx, "Client", DelayedSidecar)
    facts, engine = memory.approved_context("usr_mei")
    if mutation == "disable":
        assert facts == [] and engine == "disabled"
    elif mutation == "delete":
        assert facts == [] and engine == "local_approved_ledger_mirror_unavailable"
    else:
        assert facts == [{"key": "communication_preferences", "value": "Use detailed explanations"}]
        assert engine == "local_approved_ledger_mirror_unavailable"
