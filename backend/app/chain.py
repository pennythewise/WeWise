"""Tamper-evident proofs for claim packages, consent records and agent audit batches.

Only salted references and SHA-256 Merkle roots leave the owned store: never names,
policy numbers, amounts or file content. Anchoring is a deterministic side effect of a
user-confirmed action; the model has no chain tool and nothing here moves money.

CHAIN_MODE selects the ledger:
  local (default)  append-only, hash-linked ledger inside SQLite, labelled "Local dev ledger"
  evm              the ProofRegistry contract over JSON-RPC (FISCO BCOS web3 RPC, Hardhat, Anvil)
  off              no anchoring
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from . import core

router = APIRouter(prefix="/api", tags=["on-chain proofs"])
KINDS = {"claim_package": 1, "consent": 2, "audit_batch": 3}
SCHEMA = "wewise.proof/1"
CONTRACT_BUILD = Path(__file__).resolve().parents[1] / "contracts" / "build" / "ProofRegistry.json"
ARCHIVE_EXEMPT = {"README.txt", "proof.json"}
MAX_ENTRIES, MAX_UNCOMPRESSED = 300, 64 * 1024 * 1024
_verify_limits: dict[str, list[float]] = {}


# ── Merkle tree: domain-separated leaves (0x00) and nodes (0x01); an odd node is promoted ──
def _h(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def leaf_hash(sha256_hex: str) -> bytes:
    return _h(b"\x00" + bytes.fromhex(sha256_hex))


def _levels(leaves: list[str]) -> list[list[bytes]]:
    if not leaves:
        raise ValueError("A Merkle tree needs at least one leaf.")
    levels = [[leaf_hash(x) for x in leaves]]
    while len(levels[-1]) > 1:
        cur = levels[-1]
        levels.append([_h(b"\x01" + cur[i] + cur[i + 1]) if i + 1 < len(cur) else cur[i] for i in range(0, len(cur), 2)])
    return levels


def merkle_root(leaves: list[str]) -> str:
    return _levels(leaves)[-1][0].hex()


def merkle_proof(leaves: list[str], index: int) -> list[dict]:
    proof = []
    for level in _levels(leaves)[:-1]:
        sibling = index ^ 1
        if sibling < len(level):
            proof.append({"side": "left" if sibling < index else "right", "hash": level[sibling].hex()})
        index //= 2
    return proof


def verify_proof(sha256_hex: str, proof: list[dict], root: str) -> bool:
    node = leaf_hash(sha256_hex)
    for step in proof:
        sibling = bytes.fromhex(step["hash"])
        node = _h(b"\x01" + sibling + node) if step["side"] == "left" else _h(b"\x01" + node + sibling)
    return node.hex() == root


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex(data: bytes | str) -> str:
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


# ── Storage ──
def init_db():
    with core.get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS chain_salts(kind TEXT NOT NULL,entity_id TEXT NOT NULL,salt TEXT NOT NULL,PRIMARY KEY(kind,entity_id));
        CREATE TABLE IF NOT EXISTS chain_proofs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,entity_id TEXT NOT NULL,ref TEXT NOT NULL,root TEXT NOT NULL,version INTEGER,meta_json TEXT NOT NULL,network TEXT NOT NULL,contract TEXT NOT NULL,tx_hash TEXT,block INTEGER,status TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS chain_proofs_ref ON chain_proofs(ref,root);
        CREATE TABLE IF NOT EXISTS chain_blocks(height INTEGER PRIMARY KEY,prev_hash TEXT NOT NULL,block_hash TEXT NOT NULL,tx_hash TEXT NOT NULL,ref TEXT NOT NULL,root TEXT NOT NULL,kind INTEGER NOT NULL,created_at TEXT NOT NULL);
        """)


def ref_for(db, kind: str, entity_id: str) -> str:
    """Salted, unlinkable reference. Deleting the salt (erasure) makes the on-chain entry meaningless."""
    row = db.execute("SELECT salt FROM chain_salts WHERE kind=? AND entity_id=?", (kind, entity_id)).fetchone()
    salt = row["salt"] if row else secrets.token_hex(32)
    if not row:
        db.execute("INSERT INTO chain_salts VALUES(?,?,?)", (kind, entity_id, salt))
    return sha256_hex(f"{salt}|{kind}|{entity_id}")


def forget(db, kind: str, entity_id: str):
    db.execute("DELETE FROM chain_salts WHERE kind=? AND entity_id=?", (kind, entity_id))


# ── Ledgers ──
class LocalLedger:
    """Hash-linked, append-only ledger in the app database: one transaction per block, instant finality."""
    network = "Local dev ledger"
    contract = "local:ProofRegistry"
    real_chain = False

    def anchor(self, db, ref: str, root: str, kind: int) -> dict:
        head = db.execute("SELECT height,block_hash FROM chain_blocks ORDER BY height DESC LIMIT 1").fetchone()
        height, prev = (head["height"] + 1, head["block_hash"]) if head else (1, "0" * 64)
        at = core.now_iso()
        tx_hash = sha256_hex(canonical({"ref": ref, "root": root, "kind": kind, "height": height, "prev": prev}))
        block_hash = sha256_hex(f"{prev}|{height}|{tx_hash}|{at}")
        db.execute("INSERT INTO chain_blocks VALUES(?,?,?,?,?,?,?,?)", (height, prev, block_hash, tx_hash, ref, root, kind, at))
        version = db.execute("SELECT COUNT(*) FROM chain_blocks WHERE ref=?", (ref,)).fetchone()[0]
        return {"tx_hash": "0x" + tx_hash, "block": height, "version": version, "anchored_at": at}

    def verify(self, db, ref: str, root: str) -> dict:
        rows = db.execute("SELECT * FROM chain_blocks WHERE ref=? ORDER BY height", (ref,)).fetchall()
        for version in range(len(rows), 0, -1):
            row = rows[version - 1]
            if row["root"] == root:
                return {"found": True, "version": version, "latest": len(rows), "block": row["height"], "tx_hash": "0x" + row["tx_hash"], "anchored_at": row["created_at"]}
        return {"found": False, "version": 0, "latest": len(rows)}

    def status(self, db) -> dict:
        rows = db.execute("SELECT * FROM chain_blocks ORDER BY height").fetchall()
        prev, intact = "0" * 64, True
        for row in rows:
            expected_tx = sha256_hex(canonical({"ref": row["ref"], "root": row["root"], "kind": row["kind"], "height": row["height"], "prev": prev}))
            if row["prev_hash"] != prev or row["tx_hash"] != expected_tx or row["block_hash"] != sha256_hex(f"{prev}|{row['height']}|{row['tx_hash']}|{row['created_at']}"):
                intact = False
                break
            prev = row["block_hash"]
        recent = [{"block": r["height"], "block_hash": "0x" + r["block_hash"], "tx_hash": "0x" + r["tx_hash"], "kind": next(k for k, v in KINDS.items() if v == r["kind"]), "at": r["created_at"]} for r in rows[-8:][::-1]]
        return {"height": len(rows), "head": "0x" + prev, "integrity": "intact" if intact else "broken", "recent": recent}


class EvmLedger:
    """ProofRegistry over JSON-RPC. Writes are signed server-side by an allowlisted submitter key."""
    real_chain = True

    def __init__(self, w3=None, address: str | None = None, key: str | None = None, network: str | None = None):
        from web3 import Web3
        self.w3 = w3 or Web3(Web3.HTTPProvider(os.environ["CHAIN_RPC_URL"], request_kwargs={"timeout": 15}))
        build = json.loads(CONTRACT_BUILD.read_text())
        self.contract_obj = self.w3.eth.contract(address=Web3.to_checksum_address(address or os.environ["CHAIN_CONTRACT"]), abi=build["abi"])
        self.contract = self.contract_obj.address
        self.account = self.w3.eth.account.from_key(key or os.environ["CHAIN_SUBMITTER_KEY"]) if (key or os.getenv("CHAIN_SUBMITTER_KEY")) else None
        self.network = network or os.getenv("CHAIN_NETWORK", "EVM JSON-RPC")

    def anchor(self, db, ref: str, root: str, kind: int) -> dict:
        call = self.contract_obj.functions.anchor(bytes.fromhex(ref), bytes.fromhex(root), kind)
        if self.account:
            tx = call.build_transaction({"from": self.account.address, "nonce": self.w3.eth.get_transaction_count(self.account.address), "chainId": self.w3.eth.chain_id})
            tx_hash = self.w3.eth.send_raw_transaction(self.account.sign_transaction(tx).raw_transaction)
        else:
            tx_hash = call.transact({"from": self.w3.eth.accounts[0]})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        if receipt["status"] != 1:
            raise RuntimeError("Anchor transaction reverted.")
        event = self.contract_obj.events.Anchored().process_receipt(receipt)[0]["args"]
        return {"tx_hash": receipt["transactionHash"].to_0x_hex(), "block": receipt["blockNumber"], "version": event["version"], "anchored_at": core.now_iso()}

    def verify(self, db, ref: str, root: str) -> dict:
        found, version, latest = self.contract_obj.functions.verify(bytes.fromhex(ref), bytes.fromhex(root)).call()
        result = {"found": found, "version": version, "latest": latest}
        if found:
            proof = self.contract_obj.functions.proofAt(bytes.fromhex(ref), version).call()
            row = db.execute("SELECT tx_hash,block FROM chain_proofs WHERE ref=? AND root=? AND status='anchored' LIMIT 1", (ref, root)).fetchone()
            result |= {"anchored_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(proof[2])), "tx_hash": row["tx_hash"] if row else None, "block": row["block"] if row else None}
        return result

    def status(self, db) -> dict:
        return {"height": self.w3.eth.block_number, "head": self.w3.eth.get_block("latest")["hash"].to_0x_hex(), "integrity": "consensus", "recent": []}


_ledger = None


def ledger():
    global _ledger
    mode = os.getenv("CHAIN_MODE", "local").lower()
    if mode == "off":
        return None
    if _ledger is None or (mode == "local") != isinstance(_ledger, LocalLedger):
        _ledger = EvmLedger() if mode == "evm" else LocalLedger()
    return _ledger


# ── Anchoring (called only from user-confirmed actions) ──
def anchor(db, user_id: str, kind: str, entity_id: str, root: str, meta: dict | None = None) -> dict | None:
    chain = ledger()
    if chain is None:
        return None
    ref = ref_for(db, kind, entity_id)
    proof_id, status, receipt, error = core.uid("prf_"), "anchored", {}, None
    try:
        receipt = chain.anchor(db, ref, root, KINDS[kind])
    except Exception as exc:  # The user's flow never blocks on the chain; the proof stays pending and can be retried.
        status, error = "pending", type(exc).__name__
    db.execute("INSERT INTO chain_proofs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (proof_id, user_id, kind, entity_id, ref, root, receipt.get("version"), canonical(meta or {}), chain.network, chain.contract, receipt.get("tx_hash"), receipt.get("block"), status, core.now_iso()))
    core.audit(db, user_id, "chain_proof_anchored" if status == "anchored" else "chain_proof_pending", kind, entity_id, {"proof_id": proof_id, "block": receipt.get("block"), "error": error})
    return {"id": proof_id, "kind": kind, "ref": ref, "root": root, "status": status, "network": chain.network, "contract": chain.contract, "real_chain": chain.real_chain} | receipt


def anchor_package(db, user_id: str, claim_id: str, files: list[tuple[str, str]]) -> dict | None:
    """files: (archive path, sha256 hex). Returns the proof.json payload, or None when anchoring is off."""
    hashes = [h for _, h in files]
    root = merkle_root(hashes)
    proof = anchor(db, user_id, "claim_package", claim_id, root, {"files": len(files)})
    if proof is None:
        return None
    return {"schema": SCHEMA, "hash": "sha256", "merkle": "leaf=H(0x00||sha256), node=H(0x01||left||right), odd node promoted",
            "leaves": [{"path": path, "sha256": h, "proof": merkle_proof(hashes, i)} for i, (path, h) in enumerate(files)],
            "verify": "Open /verify in WeWise and drop this ZIP. Only hashes are on-chain."} | {k: proof[k] for k in proof if k != "id"}


def anchor_consent(db, user_id: str, consent_id: str, record: dict):
    anchor(db, user_id, "consent", consent_id, sha256_hex(canonical(record)), {"purpose": record.get("purpose"), "granted": record.get("granted")})


def _audit_rows(db, user_id: str, limit: int | None = None):
    rows = db.execute("SELECT id,action,entity_type,entity_id,details_json,created_at FROM audit_log WHERE user_id=? ORDER BY rowid" + (" LIMIT ?" if limit else ""), (user_id, limit) if limit else (user_id,)).fetchall()
    return [sha256_hex(canonical(dict(r))) for r in rows]


def seal_audit(db, user_id: str) -> dict | None:
    leaves = _audit_rows(db, user_id)
    if not leaves:
        raise HTTPException(409, "There is no activity to seal yet.")
    return anchor(db, user_id, "audit_batch", f"audit:{user_id}", merkle_root(leaves), {"rows": len(leaves)})


def audit_integrity(db, user_id: str) -> dict:
    chain = ledger()
    seals = db.execute("SELECT * FROM chain_proofs WHERE user_id=? AND kind='audit_batch' AND status='anchored' ORDER BY created_at", (user_id,)).fetchall()
    results = []
    for seal in seals:
        rows = json.loads(seal["meta_json"])["rows"]
        leaves = _audit_rows(db, user_id, rows)
        root = merkle_root(leaves) if len(leaves) == rows else None
        on_chain = chain.verify(db, seal["ref"], seal["root"])["found"] if chain else False
        results.append({"proof_id": seal["id"], "rows": rows, "block": seal["block"], "tx_hash": seal["tx_hash"], "anchored_on_chain": on_chain, "log_unchanged": root == seal["root"]})
    return {"seals": results, "intact": all(r["anchored_on_chain"] and r["log_unchanged"] for r in results)}


# ── Public verification of a downloaded package ──
def verify_archive(data: bytes) -> dict:
    try:
        archive = ZipFile(BytesIO(data))
    except BadZipFile:
        raise HTTPException(422, "This is not a ZIP archive.")
    infos = archive.infolist()
    if len(infos) > MAX_ENTRIES or sum(i.file_size for i in infos) > MAX_UNCOMPRESSED:
        raise HTTPException(413, "The archive is too large to verify.")
    names = {i.filename for i in infos if not i.is_dir()}
    if "proof.json" not in names:
        return {"verdict": "no_proof", "detail": "This archive has no proof.json, so it was not anchored by WeWise."}
    try:
        proof = json.loads(archive.read("proof.json"))
        leaves, ref, claimed_root = proof["leaves"], proof["ref"], proof["root"]
        assert proof.get("schema") == SCHEMA and isinstance(leaves, list) and leaves and len(bytes.fromhex(ref)) == 32 and len(bytes.fromhex(claimed_root)) == 32
    except Exception:
        raise HTTPException(422, "proof.json is malformed.")
    files, actual = [], []
    for leaf in leaves:
        path = str(leaf.get("path", ""))
        digest = sha256_hex(archive.read(path)) if path in names else None
        files.append({"path": path, "status": "missing" if digest is None else "ok" if digest == leaf.get("sha256") else "changed"})
        actual.append(digest or "00" * 32)
    unlisted = sorted(names - {f["path"] for f in files} - ARCHIVE_EXEMPT)
    root = merkle_root(actual)
    chain = ledger()
    with core.get_db() as db:
        onchain = chain.verify(db, ref, root) if chain else {"found": False, "version": 0, "latest": 0}
    intact = all(f["status"] == "ok" for f in files) and not unlisted
    verdict = ("verified" if onchain["version"] == onchain["latest"] else "verified_older_version") if intact and onchain["found"] else "tampered" if not intact else "not_anchored"
    return {"verdict": verdict, "files": files, "unlisted": unlisted, "computed_root": root, "claimed_root": claimed_root,
            "network": chain.network if chain else "off", "contract": chain.contract if chain else None, "real_chain": bool(chain and chain.real_chain), "ledger": onchain,
            "notice": "Verification checks file integrity and the anchored fingerprint only. It is not an insurer receipt, approval or payment."}


# ── API ──
class SealRequest(BaseModel):
    confirmed: bool


@router.get("/chain/status")
def chain_status():
    chain = ledger()
    if chain is None:
        return {"mode": "off"}
    with core.get_db() as db:
        status = chain.status(db)
    return {"mode": os.getenv("CHAIN_MODE", "local").lower(), "network": chain.network, "contract": chain.contract, "real_chain": chain.real_chain,
            "on_chain_data": ["salted reference", "SHA-256 Merkle root", "kind", "timestamp"], "never_on_chain": ["names", "policy numbers", "amounts", "documents", "contact details"]} | status


@router.get("/chain/proofs")
def my_proofs(user=Depends(core.current_user)):
    with core.get_db() as db:
        rows = db.execute("SELECT id,kind,entity_id,root,version,network,contract,tx_hash,block,status,created_at FROM chain_proofs WHERE user_id=? ORDER BY created_at DESC LIMIT 100", (user["id"],)).fetchall()
    return {"proofs": [dict(r) for r in rows]}


@router.post("/chain/proofs/retry")
def retry_pending(user=Depends(core.current_user)):
    chain = ledger()
    done = 0
    with core.get_db() as db:
        for row in db.execute("SELECT * FROM chain_proofs WHERE user_id=? AND status='pending'", (user["id"],)).fetchall():
            try:
                receipt = chain.anchor(db, row["ref"], row["root"], KINDS[row["kind"]])
            except Exception:
                continue
            db.execute("UPDATE chain_proofs SET status='anchored',tx_hash=?,block=?,version=? WHERE id=?", (receipt["tx_hash"], receipt["block"], receipt["version"], row["id"]))
            done += 1
    return {"anchored": done}


@router.post("/chain/audit/seal")
def seal(payload: SealRequest, user=Depends(core.current_user)):
    if not payload.confirmed:
        raise HTTPException(409, "Explicit confirmation is required.")
    with core.get_db() as db:
        proof = seal_audit(db, user["id"])
    if proof is None:
        raise HTTPException(409, "On-chain proofs are switched off.")
    return proof


@router.get("/chain/audit/verify")
def verify_audit(user=Depends(core.current_user)):
    with core.get_db() as db:
        return audit_integrity(db, user["id"])


@router.post("/verify")
async def verify_upload(request: Request, file: UploadFile = File(...)):
    """Public and read-only: anyone holding a package (for example an insurer) can check it. Nothing is stored."""
    key, now = request.client.host if request.client else "unknown", time.time()
    recent = [t for t in _verify_limits.get(key, []) if now - t < 60]
    if len(recent) >= 30:
        raise HTTPException(429, "Too many verification requests. Try again in a minute.")
    _verify_limits[key] = recent + [now]
    data = await file.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise HTTPException(413, "The archive exceeds 16 MB.")
    return verify_archive(data)
