"""Local multilingual E5 embeddings plus owner-scoped reciprocal-rank fusion.

Weights are installed explicitly by the operator. No document or query is sent
to a model provider, and no download is attempted on a customer request.
"""
from __future__ import annotations

from functools import lru_cache
import hashlib
import importlib.util
import os
from pathlib import Path
import threading

MODEL = "Xenova/multilingual-e5-small"
REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
WEIGHTS_SHA256 = "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193"
TOKENIZER_SHA256 = "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"
_lock = threading.RLock()


def model_directory() -> Path | None:
    value = os.getenv("WEWISE_EMBEDDING_DIR", "")
    return Path(value).resolve() if value else None


@lru_cache(maxsize=2)
def _runtime(directory: str):
    import numpy as np
    import onnxruntime as ort
    from tokenizers import Tokenizer

    path = Path(directory)
    for name, expected in (("model_quantized.onnx", WEIGHTS_SHA256), ("tokenizer.json", TOKENIZER_SHA256)):
        file = path / name
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise ValueError("Embedding assets are absent or differ from the pinned revision.")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(path / "model_quantized.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
    tokenizer = Tokenizer.from_file(str(path / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=512)
    tokenizer.enable_padding(pad_id=1, pad_token="<pad>")
    return session, tokenizer, np


def embedding_health():
    path = model_directory()
    status = {"configured": False, "engine": "lexical_only", "external_processing": False, "model": MODEL, "revision": REVISION}
    if path is None:
        return status | {"notice": "Local semantic assets are not enabled; lexical retrieval remains available."}
    if importlib.util.find_spec("tokenizers") is None:
        return status | {"notice": "Local tokenizer runtime is not installed."}
    try:
        _runtime(str(path))
        return status | {"configured": True, "engine": "local_e5_onnx_cpu_bm25_rrf", "dimensions": 384}
    except Exception:
        return status | {"notice": "Pinned local embedding model is unavailable; lexical retrieval remains available."}


def embed(texts: list[str], *, query=False):
    path = model_directory()
    if path is None:
        raise RuntimeError("Local embeddings are not enabled.")
    session, tokenizer, np = _runtime(str(path))
    prefix = "query: " if query else "passage: "
    vectors = []
    with _lock:
        for start in range(0, len(texts), 12):
            encodings = tokenizer.encode_batch([prefix + text[:12000] for text in texts[start:start + 12]])
            ids = np.asarray([item.ids for item in encodings], dtype=np.int64)
            mask = np.asarray([item.attention_mask for item in encodings], dtype=np.int64)
            feeds = {"input_ids": ids, "attention_mask": mask}
            available = {item.name for item in session.get_inputs()}
            if "token_type_ids" in available:
                feeds["token_type_ids"] = np.zeros_like(ids)
            hidden = session.run(None, {k: v for k, v in feeds.items() if k in available})[0]
            pooled = (hidden * mask[..., None]).sum(axis=1) / np.maximum(mask.sum(axis=1, keepdims=True), 1)
            pooled = pooled / np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12)
            vectors.extend(pooled.astype("<f4"))
    return np.stack(vectors) if vectors else np.empty((0, 384), dtype="<f4")


def init_db(db):
    db.execute("""CREATE TABLE IF NOT EXISTS semantic_embeddings(
        user_id TEXT NOT NULL, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
        source_sha TEXT NOT NULL, model_revision TEXT NOT NULL, vector BLOB NOT NULL,
        PRIMARY KEY(user_id,chunk_id,model_revision))""")


def hybrid_order(db, user_id: str, policy_id: str, query: str, lexical_rows: list[dict], limit=30):
    """Return actual owned source rows ordered by BM25 + local-vector RRF.

    None means the configured optional runtime is unavailable. Never accept an
    external candidate's document text or identity as retrieval authority.
    """
    if model_directory() is None:
        return None
    try:
        rows = [dict(row) for row in db.execute("""SELECT dc.* FROM document_chunks dc
            JOIN policy_documents pd ON pd.document_id=dc.document_id
            JOIN policies p ON p.id=pd.policy_id
            WHERE p.id=? AND p.user_id=? AND dc.user_id=? AND dc.quarantined=0
            ORDER BY dc.document_id,dc.page,dc.id LIMIT 700""", (policy_id, user_id, user_id))]
        if not rows:
            return []
        session, tokenizer, np = _runtime(str(model_directory()))
        init_db(db)
        owned = {row["id"]: row for row in rows}
        vectors = {}; missing = []
        for row in rows:
            digest = hashlib.sha256(row["text"].encode()).hexdigest()
            item = db.execute("SELECT vector FROM semantic_embeddings WHERE user_id=? AND chunk_id=? AND model_revision=? AND source_sha=?", (user_id, row["id"], REVISION, digest)).fetchone()
            if item:
                vector = np.frombuffer(item["vector"], dtype="<f4")
                if vector.shape == (384,) and np.isfinite(vector).all():
                    vectors[row["id"]] = vector
                    continue
            missing.append((row, digest))
        if missing:
            computed = embed([row["text"] for row, _ in missing])
            for (row, digest), vector in zip(missing, computed):
                vectors[row["id"]] = vector
                db.execute("INSERT OR REPLACE INTO semantic_embeddings VALUES(?,?,?,?,?,?)", (user_id, row["document_id"], row["id"], digest, REVISION, vector.tobytes()))
        query_vector = embed([query], query=True)[0]
        similarities = {identifier: float(np.dot(vector, query_vector)) for identifier, vector in vectors.items()}
        semantic_ids = sorted(similarities, key=lambda identifier: (-similarities[identifier], identifier))[:max(limit, 30)]
        lexical_ids = list(dict.fromkeys(row["id"] for row in lexical_rows if row.get("id") in owned))
        fused = {}
        for ids in (lexical_ids, semantic_ids):
            for rank, identifier in enumerate(ids):
                fused[identifier] = fused.get(identifier, 0) + 1 / (60 + rank + 1)
        return [owned[identifier] | {"_hybrid_score": fused[identifier], "_semantic_score": similarities.get(identifier), "_retrieval_engine": "local_e5_onnx_cpu_bm25_rrf"} for identifier in sorted(fused, key=lambda key: (-fused[key], key))[:limit]]
    except Exception:
        # A failed optional encoder never invents semantic results or blocks the
        # evidence-only fallback. The health report exposes its availability.
        return None
