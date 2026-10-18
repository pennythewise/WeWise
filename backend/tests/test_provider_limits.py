from concurrent.futures import ThreadPoolExecutor

from backend.app import core, provider_limits as limits


def test_global_limit_atomic_and_persistent(tmp_path, monkeypatch):
    monkeypatch.setattr(core, "DATA_DIR", tmp_path)
    monkeypatch.setenv("WEWISE_CLAUDE_DAILY_LIMIT", "4")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: limits.reserve("claude"), range(16)))
    assert results.count(True) == 4
    assert not limits.reserve("claude")
    assert limits.reserve("jev")
    monkeypatch.setattr(limits, "utc_day", lambda: "2099-01-01")
    assert limits.reserve("claude")


def test_disabled_invalid_and_storage_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(core, "DATA_DIR", tmp_path)
    for value in ("0", "-1", "invalid"):
        monkeypatch.setenv("WEWISE_JEV_DAILY_LIMIT", value)
        assert not limits.reserve("jev")
    monkeypatch.setenv("WEWISE_JEV_DAILY_LIMIT", "1")
    blocked = tmp_path / "file"
    blocked.write_text("not a directory")
    monkeypatch.setattr(core, "DATA_DIR", blocked)
    assert not limits.reserve("jev")


def test_foreign_policy_does_not_trigger_paid_routing(client, stranger, monkeypatch):
    from backend.app import jev_adapter
    async def forbidden(*args, **kwargs):
        raise AssertionError('Unauthorized reference reached paid provider routing')
    monkeypatch.setattr(jev_adapter, 'suggest', forbidden)
    policy = client.get('/api/policies').json()['policies'][0]
    assert stranger.post('/api/chat',json={'message':'Explain this policy','policy_id':policy['id']}).status_code == 404
