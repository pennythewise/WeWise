"""On-chain proof layer: Merkle maths, package anchoring and public verification, consent and audit seals,
privacy of what reaches the ledger, and the real ProofRegistry contract on an in-process EVM."""
from __future__ import annotations

from io import BytesIO
import json
from zipfile import ZipFile, ZIP_DEFLATED

import pytest
from fastapi.testclient import TestClient

from backend.app import chain, core
from test_workflows import create_case, prepared_case, preview, workflow_client  # noqa: F401  (fixture re-export)


def export_zip(client, case, mode="draft"):
    action = preview(client, case, mode)
    result = client.post(f"/api/claims/{case['id']}/export", json={"token": action["token"], "confirmed": True})
    assert result.status_code == 200, result.text
    body = result.json()
    return body, client.get(body["zip_url"]).content


def verify(client, data: bytes):
    response = client.post("/api/verify", files={"file": ("package.zip", data, "application/zip")})
    assert response.status_code == 200, response.text
    return response.json()


def rewrite(data: bytes, edit) -> bytes:
    source, target = ZipFile(BytesIO(data)), BytesIO()
    with ZipFile(target, "w", ZIP_DEFLATED) as out:
        files = {name: source.read(name) for name in source.namelist()}
        for name, content in edit(files).items():
            out.writestr(name, content)
    return target.getvalue()


# ── Merkle ──
@pytest.mark.parametrize("count", [1, 2, 3, 4, 5, 8, 13])
def test_merkle_proofs_verify_for_every_leaf(count):
    leaves = [chain.sha256_hex(f"file-{i}") for i in range(count)]
    root = chain.merkle_root(leaves)
    assert root == chain.merkle_root(list(leaves))
    for i, leaf in enumerate(leaves):
        assert chain.verify_proof(leaf, chain.merkle_proof(leaves, i), root)
        assert not chain.verify_proof(chain.sha256_hex("tampered"), chain.merkle_proof(leaves, i), root)


def test_merkle_is_domain_separated_and_order_sensitive():
    a, b = chain.sha256_hex("a"), chain.sha256_hex("b")
    assert chain.merkle_root([a, b]) != chain.merkle_root([b, a])
    # An inner node can never be replayed as a leaf (second-preimage resistance).
    inner = chain.merkle_root([a, b])
    assert chain.merkle_root([inner]) != inner


# ── Claim package ──
@pytest.mark.task
def test_export_anchors_package_and_public_verify_passes(workflow_client):
    case, _ = create_case(workflow_client)
    body, data = export_zip(workflow_client, case)
    assert body["proof"]["status"] == "anchored" and body["proof"]["block"] >= 1
    proof = json.loads(ZipFile(BytesIO(data)).read("proof.json"))
    assert proof["root"] == body["proof"]["root"] and proof["leaves"][0]["path"] == "01-reviewed-summary.pdf"
    for leaf in proof["leaves"]:
        assert chain.verify_proof(leaf["sha256"], leaf["proof"], proof["root"])
    result = verify(TestClient(workflow_client.app), data)  # No account needed: an insurer can check the file.
    assert result["verdict"] == "verified" and all(f["status"] == "ok" for f in result["files"])
    assert result["computed_root"] == proof["root"] and result["ledger"]["block"] == body["proof"]["block"]


@pytest.mark.attack
@pytest.mark.parametrize("attack", ["edit_pdf", "edit_original", "drop_file", "add_file", "forge_proof_root"])
def test_any_tampering_fails_verification(workflow_client, attack):
    case, _ = create_case(workflow_client)
    _, data = export_zip(workflow_client, case)

    def edit(files):
        original = next(n for n in files if n.startswith("originals/")) if any(n.startswith("originals/") for n in files) else "02-manifest.json"
        if attack == "edit_pdf":
            files["01-reviewed-summary.pdf"] = files["01-reviewed-summary.pdf"][:-1] + b"X"
        elif attack == "edit_original":
            files[original] = files[original] + b" "
        elif attack == "drop_file":
            files.pop(original)
        elif attack == "add_file":
            files["originals/99-extra-receipt.pdf"] = b"%PDF-1.4 fake"
        elif attack == "forge_proof_root":
            files["01-reviewed-summary.pdf"] = b"%PDF forged"
            proof = json.loads(files["proof.json"])
            proof["leaves"][0]["sha256"] = chain.sha256_hex(b"%PDF forged")
            proof["root"] = chain.merkle_root([leaf["sha256"] for leaf in proof["leaves"]])
            files["proof.json"] = json.dumps(proof)
        return files

    result = verify(workflow_client, rewrite(data, edit))
    assert result["verdict"] in {"tampered", "not_anchored"}
    assert result["verdict"] != "verified"


def test_reexport_creates_new_version_and_old_package_is_flagged(workflow_client):
    case, _ = create_case(workflow_client)
    _, first = export_zip(workflow_client, case)
    second_body, second = export_zip(workflow_client, case)
    assert second_body["proof"]["version"] == 2
    assert verify(workflow_client, second)["verdict"] == "verified"
    old = verify(workflow_client, first)
    assert old["verdict"] == "verified_older_version" and old["ledger"]["latest"] == 2


def test_verify_rejects_non_zip_and_unanchored_archives(workflow_client):
    assert workflow_client.post("/api/verify", files={"file": ("x.zip", b"not a zip", "application/zip")}).status_code == 422
    plain = BytesIO()
    with ZipFile(plain, "w") as archive:
        archive.writestr("a.txt", "hello")
    assert verify(workflow_client, plain.getvalue())["verdict"] == "no_proof"


# ── Privacy ──
@pytest.mark.attack
def test_ledger_holds_only_hashes_never_claim_or_user_data(workflow_client):
    case, policy = create_case(workflow_client)
    export_zip(workflow_client, case)
    with core.get_db() as db:
        blocks = [dict(r) for r in db.execute("SELECT * FROM chain_blocks")]
        user = dict(db.execute("SELECT * FROM users WHERE email='demo@wewise.test'").fetchone())
    assert blocks
    ledger_text = json.dumps(blocks)
    for secret in [case["id"], policy["id"], policy.get("policy_number"), policy.get("insured_name"), user["id"], user["email"]]:
        if secret:
            assert str(secret) not in ledger_text
    for block in blocks:
        assert len(block["ref"]) == 64 and len(block["root"]) == 64


def test_deleting_a_case_forgets_its_salt(workflow_client):
    case, _ = create_case(workflow_client)
    export_zip(workflow_client, case)
    assert workflow_client.delete(f"/api/claims/{case['id']}?confirmed=true").status_code == 200
    with core.get_db() as db:
        assert db.execute("SELECT COUNT(*) FROM chain_salts WHERE kind='claim_package' AND entity_id=?", (case["id"],)).fetchone()[0] == 0


# ── Consent and audit ──
def test_consent_changes_are_anchored(workflow_client):
    assert workflow_client.patch("/api/preferences", json={"memory_enabled": True}).status_code == 200
    proofs = workflow_client.get("/api/chain/proofs").json()["proofs"]
    assert any(p["kind"] == "consent" and p["status"] == "anchored" for p in proofs)


@pytest.mark.attack
def test_audit_seal_detects_a_rewritten_log(workflow_client):
    assert workflow_client.post("/api/chain/audit/seal", json={"confirmed": False}).status_code == 409
    sealed = workflow_client.post("/api/chain/audit/seal", json={"confirmed": True})
    assert sealed.status_code == 200 and sealed.json()["status"] == "anchored"
    assert workflow_client.get("/api/chain/audit/verify").json()["intact"] is True
    with core.get_db() as db:
        db.execute("UPDATE audit_log SET action='nothing_happened' WHERE rowid=(SELECT MIN(rowid) FROM audit_log)")
    report = workflow_client.get("/api/chain/audit/verify").json()
    assert report["intact"] is False and report["seals"][0]["log_unchanged"] is False


def test_local_ledger_hash_links_detect_history_rewrite(workflow_client):
    case, _ = create_case(workflow_client)
    export_zip(workflow_client, case)
    assert workflow_client.get("/api/chain/status").json()["integrity"] == "intact"
    with core.get_db() as db:
        db.execute("UPDATE chain_blocks SET root=? WHERE height=1", ("ab" * 32,))
    assert workflow_client.get("/api/chain/status").json()["integrity"] == "broken"


def test_proofs_are_owner_scoped(workflow_client):
    anonymous = TestClient(workflow_client.app)
    assert anonymous.get("/api/chain/proofs").status_code == 401
    assert anonymous.post("/api/chain/audit/seal", json={"confirmed": True}).status_code == 401


# ── Real contract on an in-process EVM ──
@pytest.fixture
def evm():
    web3 = pytest.importorskip("web3")
    pytest.importorskip("eth_tester")
    w3 = web3.Web3(web3.EthereumTesterProvider())
    build = json.loads(chain.CONTRACT_BUILD.read_text())
    factory = w3.eth.contract(abi=build["abi"], bytecode=build["bytecode"])
    receipt = w3.eth.wait_for_transaction_receipt(factory.constructor().transact({"from": w3.eth.accounts[0]}))
    return w3, receipt["contractAddress"]


def test_contract_anchor_verify_and_versions(evm, tmp_path, monkeypatch):
    w3, address = evm
    monkeypatch.setattr(core, "DATA_DIR", tmp_path)
    core.init_db()
    chain.init_db()
    ledger = chain.EvmLedger(w3=w3, address=address, network="EVM test")
    ref, root1, root2 = chain.sha256_hex("ref"), chain.sha256_hex("one"), chain.sha256_hex("two")
    with core.get_db() as db:
        first = ledger.anchor(db, ref, root1, 1)
        second = ledger.anchor(db, ref, root2, 1)
        assert first["version"] == 1 and second["version"] == 2 and second["block"] > first["block"]
        assert ledger.verify(db, ref, root1)["version"] == 1
        assert ledger.verify(db, ref, root2)["latest"] == 2
        assert ledger.verify(db, ref, chain.sha256_hex("never"))["found"] is False


def test_contract_rejects_unauthorised_writers_and_has_no_payable_surface(evm):
    w3, address = evm
    build = json.loads(chain.CONTRACT_BUILD.read_text())
    contract = w3.eth.contract(address=address, abi=build["abi"])
    with pytest.raises(Exception):
        contract.functions.anchor(b"\x01" * 32, b"\x02" * 32, 1).transact({"from": w3.eth.accounts[1]})
    with pytest.raises(Exception):
        contract.functions.anchor(b"\x01" * 32, b"\x00" * 32, 1).transact({"from": w3.eth.accounts[0]})
    assert not any(item.get("stateMutability") == "payable" for item in build["abi"])


def test_evm_mode_runs_the_whole_export_flow(evm, workflow_client, monkeypatch):
    w3, address = evm
    monkeypatch.setenv("CHAIN_MODE", "evm")
    monkeypatch.setattr(chain, "_ledger", chain.EvmLedger(w3=w3, address=address, network="EVM test"))
    case, _ = create_case(workflow_client)
    body, data = export_zip(workflow_client, case)
    assert body["proof"]["real_chain"] is True and body["proof"]["tx_hash"].startswith("0x")
    result = verify(workflow_client, data)
    assert result["verdict"] == "verified" and result["real_chain"] is True
