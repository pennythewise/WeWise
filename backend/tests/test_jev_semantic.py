"""Bounded provider protocol and private hybrid retrieval regressions."""
import asyncio
import json
import sqlite3

import httpx
import numpy as np
import pytest

from backend.app import jev_adapter as jev, semantic_retrieval as semantic


def answer(choice="buying", confidence=0.9):
    probabilities = {key: (0.9 if key == choice else 0.1 / (len(jev.INTENTS) - 1)) for key in jev.INTENTS}
    return {"type": "choice", "choice": choice, "confidence": confidence, "probabilities": probabilities}


@pytest.mark.attack
@pytest.mark.parametrize("change", [
    {"choice": "submit_claim"}, {"type": "execute"}, {"confidence": float("nan")},
    {"confidence": True}, {"confidence": 0.2}, {"probabilities": {"buying": 1}},
    {"probabilities": {key: 1 for key in jev.INTENTS}},
])
def test_jev_invalid_choices_never_authorize_actions(change):
    assert jev.validated_choice(answer() | change, jev.INTENTS) is None


@pytest.mark.attack
def test_retrieval_only_blocks_even_configured_key(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-fixture-not-a-credential")
    monkeypatch.setenv("WEWISE_RETRIEVAL_ONLY", "1")
    def no_network(request):
        pytest.fail("retrieval-only must not call JEV")
    result = asyncio.run(jev.suggest("compare my insurance", transport=httpx.MockTransport(no_network)))
    assert result == {"used": False, "suggestion": None, "engine": "deterministic_fallback", "reason": "retrieval_only"}


@pytest.mark.task
def test_jev_official_choice_protocol_and_minimized_input(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_KEY", "protocol-fixture")
    monkeypatch.delenv("WEWISE_RETRIEVAL_ONLY", raising=False)
    def respond(request):
        assert str(request.url) == jev.ENDPOINT
        body = json.loads(request.content)
        assert body["questions"]["intent"]["criteria"] == jev.INTENTS
        assert "person@example.com" not in body["state"]["untrusted_user_text"]
        assert "12345678901" not in body["state"]["untrusted_user_text"]
        return httpx.Response(200, json={"model": "jev-fixture", "answers": {"intent": answer()}, "usage": {"input_tokens": 80, "output_tokens": 12}})
    result = asyncio.run(jev.suggest("compare for person@example.com 12345678901", transport=httpx.MockTransport(respond)))
    assert result["used"] and result["suggestion"] == "buying"
    assert result["authority"] == "advisory_only"


@pytest.mark.attack
def test_jev_no_redirect_or_provider_error_content_in_result(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_KEY", "protocol-fixture")
    monkeypatch.delenv("WEWISE_RETRIEVAL_ONLY", raising=False)
    result = asyncio.run(jev.suggest("help", transport=httpx.MockTransport(lambda r: httpx.Response(302, headers={"Location": "https://evil.invalid"}))))
    assert result["used"] is False
    assert "evil" not in json.dumps(result)


@pytest.mark.attack
def test_hybrid_scope_quarantine_and_vector_deletion(monkeypatch):
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      CREATE TABLE documents(id TEXT PRIMARY KEY);
      CREATE TABLE policies(id TEXT PRIMARY KEY,user_id TEXT);
      CREATE TABLE policy_documents(policy_id TEXT,document_id TEXT);
      CREATE TABLE document_chunks(id TEXT PRIMARY KEY,document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,user_id TEXT,page INTEGER,text TEXT,quarantined INTEGER);
      INSERT INTO documents VALUES('d1'),('d2');
      INSERT INTO policies VALUES('p1','u1'),('p2','u2');
      INSERT INTO policy_documents VALUES('p1','d1'),('p2','d2');
      INSERT INTO document_chunks VALUES('c1','d1','u1',1,'medical invoice',0),('c2','d2','u2',1,'private second user',0),('c3','d1','u1',2,'quarantined instruction',1);
    """)
    monkeypatch.setattr(semantic, "model_directory", lambda: "/fixture")
    monkeypatch.setattr(semantic, "_runtime", lambda path: (None, None, np))
    seen = []
    def fake_embed(texts, **kwargs):
        seen.extend(texts)
        vectors = np.zeros((len(texts), 384), dtype="<f4")
        vectors[:, 0] = 1
        return vectors
    monkeypatch.setattr(semantic, "embed", fake_embed)
    result = semantic.hybrid_order(db, "u1", "p1", "invoice", [{"id": "c2", "text": "injected candidate"}])
    assert [r["id"] for r in result] == ["c1"]
    assert not any("second" in s or "quarantined" in s or "injected" in s for s in seen)
    assert db.execute("SELECT COUNT(*) FROM semantic_embeddings").fetchone()[0] == 1
    db.execute("DELETE FROM documents WHERE id='d1'")
    assert db.execute("SELECT COUNT(*) FROM semantic_embeddings").fetchone()[0] == 0
    assert semantic.hybrid_order(db, "u2", "p1", "invoice", []) == []


@pytest.mark.task
def test_pinned_encoder_assets_reject_unverified_files(tmp_path):
    (tmp_path / "model_quantized.onnx").write_bytes(b"unverified")
    with pytest.raises(ValueError, match="pinned revision"):
        semantic._runtime(str(tmp_path))
