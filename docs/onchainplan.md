# WeWise On-Chain Plan: Verifiable Claims Ledger

Status: P0 implemented, F2 and F3 implemented early · Owner: WeWise team · Target: FinTechathon 2026 International Track, Topic D (Insurance Assistant), on-chain challenge bonus (0–5 pts)

### Implementation status (20 Oct 2026)

| Item | Status | Where |
|---|---|---|
| F1 Claim package anchor + `proof.json` + public verify | Done | `backend/app/chain.py`, `workflows.export_claim`, `/verify` page |
| F2 Agent audit seal + integrity check | Done (API) | `POST /api/chain/audit/seal`, `GET /api/chain/audit/verify` |
| F3 Consent ledger | Done | `lifecycle.consent()` anchors every grant or withdrawal |
| Contract | Done. **One** `ProofRegistry.sol` with a `kind` field replaces the three contracts sketched in §5.2 | `backend/contracts/` |
| `CHAIN_MODE=local` | Done, tested | hash-linked SQLite ledger, labelled "Local dev ledger" |
| `CHAIN_MODE=evm` | Done, tested on an in-process EVM (py-evm) and against a Hardhat JSON-RPC node | **Not yet run against a FISCO BCOS node** (P1) |
| S1–S7 simulations | Done, with fixed demo values labelled "Simulation" | `frontend/src/engine/scenarios/chain.ts` |
| F4 WeIdentity VC, F5 oracle attestation, FISCO node script | Not started (P2/P1) | |

---

## 0. Read this first

- **The bonus rules are unclear.** The official scoring slide says *"Challenge bonus (on-chain exploration): 0–5 points"* and that all six topics share the same scoring. Several third-party listings attach the bonus to **Topic F (Agent Wallet)** only. Before spending time on this, confirm with the organisers that a Topic D entry can earn it.
- **No plan guarantees 5/5.** What we control is giving judges as many reasons as possible to award the bonus:
  - an on-chain component that is real and running;
  - a clear reason why it needs a chain;
  - the host's own technology;
  - something a judge can verify themselves in under a minute.
- **The submission deadline is 20 Oct 2026, 23:59 UTC+8.** Phase 0 (§9) is scoped to fit in a few hours. Later phases target the online review (31 Oct) and the Grand Final (20–23 Nov).
- **Do not change the S1–S7 scenario mocks.** All on-chain UI is additive. It never changes the scripted S1–S7 output.

---

## 1. One-line pitch

> **WeWise makes every claim package and every agent action tamper-evident.** The customer and the insurer can prove what was submitted, when, and that the AI never acted outside policy. Proofs are anchored on WeBank's FISCO BCOS, and no personal data goes on-chain.

Why this works for judges:

| Judge question | Our answer |
|---|---|
| "Why blockchain and not a database?" | WeWise sits between two parties that don't fully trust each other: the customer and the insurer. Neither should have to trust WeWise's own database. A shared ledger gives both sides one timestamp and fingerprint that neither side can rewrite. |
| "Is it safe?" | Only salted SHA-256 digests and Merkle roots go on-chain. There are no names, policy numbers or files, and no money moves. This keeps the README principle "No money tools". |
| "Is it real?" | Contracts are deployed on a FISCO BCOS chain. The app shows the transaction hash and block number. A judge can drop the ZIP on a Verify page and watch it pass, then edit one byte and watch it fail. |
| "Is it ambitious?" | We go beyond notarisation. There are on-chain consent records, verifiable claim-readiness credentials (W3C VC / WeIdentity), and an anchored audit trail of the AI agent. |

---

## 2. Research summary

### 2.1 What on-chain insurance looks like in practice

| Pattern | Real-world example | What it teaches us |
|---|---|---|
| **Parametric payout** (an oracle triggers payment automatically) | Etherisc FlightDelay (Ethereum + Chainlink flight data); Etherisc/ACRE crop insurance in Kenya (Chainlink weather data); Ensuro (Chainlink data for parametric products) | Strongest when the trigger is objective data. It needs a regulated risk pool and moves money, which **conflicts with WeWise's no-money-tools rule**. We borrow the *oracle attestation* idea but not the payout. |
| **Evidence notarisation / anchoring** | Common in China for e-evidence and claims (hash-anchored evidence on consortium chains); the 2026 FinTechathon Topic B project *Signet* anchors Merkle roots of AI compliance certificates on FISCO BCOS | Cheap, private, and easy to verify. It is the right fit for a claims-preparation assistant. |
| **Verifiable credentials / DID** | WeBank **WeIdentity** on FISCO BCOS: W3C DIDs and VCs, selective disclosure, credential content kept off-chain with only evidence on-chain | Lets the customer share a *proof* (for example, "travel policy active on incident date") without sharing the whole policy. |
| **Industry consortium ledgers** | B3i (insurer consortium; entered insolvency in 2022); AXA *fizzy* flight-delay product (discontinued 2019) | Big consortium plays failed on adoption, not technology. **Lesson:** pitch a narrow, customer-side utility that works with one insurer or none, not "insurance on the blockchain". |

### 2.2 Why FISCO BCOS

- WeBank co-hosts the competition and leads the FISCO BCOS open-source consortium chain. FISCO BCOS was a technical partner of earlier FinTechathons. Using the host's stack signals fit and lowers judges' review effort.
- FISCO BCOS is permissioned (PBFT/rPBFT), runs Solidity contracts, and has a fast local setup (`build_chain.sh` / Air version, 4 nodes on one machine). It also suits regulated finance in China better than a public chain (PIPL, data localisation).
- WeIdentity (DID/VC) runs on it, so the stretch goal uses the same chain.

**Fallback for the offline demo:** an in-process EVM (py-evm / eth-tester) with the same contracts, clearly labelled **"LOCAL DEV CHAIN"** in the UI. Never present the fallback as FISCO.

---

## 3. Design principles (match the README)

1. **Digests only.** On-chain data is limited to Merkle roots, salted hashes, enum states and timestamps. No PII, policy numbers, amounts or file content. Deleting the off-chain data makes the on-chain hash meaningless, which supports PIPL/GDPR erasure.
2. **No money on-chain.** There are no tokens, payouts or premium payments. The chain proves facts. It never moves funds.
3. **The model has no chain authority.** The LLM cannot call chain functions. Anchoring is a deterministic side effect of user-confirmed actions (export confirmed, consent granted). It passes through the existing Policy Enforcement Point and is recorded in `audit_log`.
4. **Customer in control.** The customer chooses to anchor and owns the verification receipt. The insurer can verify without a WeWise account.
5. **Honest labelling.** Each proof shows its chain, network (FISCO / local dev), contract address, transaction hash and block. Simulated items are marked as simulated.

---

## 4. Features, ranked by value to judges

| # | Feature | On-chain | Bonus impact | Also helps |
|---|---|---|---|---|
| **F1** | **Claim Package Anchor + Verify page** | Merkle root of the claim package (each document sha256 + checklist JSON + PDF sha256) | Core: real, verifiable, explained | Security 30%, Task 40% |
| **F2** | **Agent Audit Anchor** | Periodic Merkle root of `audit_log` + PEP decisions per session | Shows on-chain governance of AI | Security 30% (tamper-evident agent trace) |
| **F3** | **Consent Ledger** | Salted hash of each consent grant/revoke (purpose, grantee, time) | Shows data rights on-chain | Compliance |
| **F4** | **Claim-Readiness Verifiable Credential** | WeIdentity DID for the user and WeWise; VC evidence hash on-chain; selective disclosure | "Ambitious" points | Innovation 30% |
| **F5** | **Oracle Event Attestation (no payout)** | Signed, hashed flight-delay/weather fact used in a checklist ("delay ≥ 6h confirmed by source X at T") | Parametric-insurance credibility without moving money | Innovation |

F1 alone is a credible bonus entry. F1–F3 is a strong one. F4–F5 are for the Grand Final.

---

## 5. Architecture

```
Frontend (React)                                   Insurer / judge (no account)
  Claim detail ─ "Anchor proof" button              Verify page (/verify)
  Proof badge (tx, block, network)                    drop ZIP → recompute → compare
  Inspector: chain events                                    │
        │ /api                                               │ /api/verify (public, read-only)
        ▼                                                    ▼
FastAPI ── PEP (authZ, ownership, user confirmation) ── chain.py (deterministic, no LLM)
                                                         │   build Merkle tree, salt, sign tx
                                                         │   CHAIN_MODE = fisco | local | off
                                                         ▼
                                 FISCO BCOS 3.x (4 nodes, PBFT)   or   in-process EVM (local)
                                   ClaimProofRegistry.sol
                                   ConsentRegistry.sol
                                   AuditAnchor.sol
                                   (WeIdentity contracts — stretch)
```

### 5.1 What goes where

| Data | Off-chain (SQLite / files) | On-chain |
|---|---|---|
| Claim documents | File, OCR text, `sha256` (exists already in `documents`) | Only as a Merkle leaf inside the package root |
| Claim package (PDF+ZIP) | `workflow_exports` row incl. `sha256` (exists already) | `packageRoot`, `claimRef = H(salt‖claim_id)`, timestamp, schema version |
| Merkle proof per document | Stored in the ZIP manifest (`proof.json`) | — |
| Audit log | `audit_log` rows (exist already) | `auditRoot` per session/batch + row count |
| Consent | `consents` table | `H(salt‖user‖purpose‖grantee‖granted‖time)`, status |
| Salt | Per-claim random 32 bytes, kept off-chain, included in the user's receipt | Never |

### 5.2 Contracts (Solidity ^0.8, FISCO-compatible)

```solidity
contract ClaimProofRegistry {
    struct Proof { bytes32 root; uint64 anchoredAt; uint16 schema; address submitter; }
    mapping(bytes32 => Proof[]) public proofs;          // claimRef => version history (append-only)
    mapping(address => bool) public submitters;          // permissioned: WeWise backend key(s)
    address public admin;

    event ClaimAnchored(bytes32 indexed claimRef, bytes32 root, uint16 schema, uint256 version);

    function anchor(bytes32 claimRef, bytes32 root, uint16 schema) external onlySubmitter { ... }
    function latest(bytes32 claimRef) external view returns (Proof memory) { ... }
    function verify(bytes32 claimRef, bytes32 root) external view returns (bool, uint256 version) { ... }
}

contract AuditAnchor {
    event AuditBatch(bytes32 indexed sessionRef, bytes32 root, uint32 rows, uint64 fromTs, uint64 toTs);
    function anchorBatch(bytes32 sessionRef, bytes32 root, uint32 rows, uint64 fromTs, uint64 toTs) external onlySubmitter;
}

contract ConsentRegistry {
    enum Status { None, Granted, Revoked }
    mapping(bytes32 => Status) public status;           // consentRef => status
    event ConsentChanged(bytes32 indexed consentRef, Status status, uint64 at);
    function set(bytes32 consentRef, Status s) external onlySubmitter;
}
```

Rules:
- Records are **append-only**. A re-export creates a new version and never overwrites the old one.
- Only allowlisted submitter keys can write. Anyone can read (`view`).
- The Merkle tree uses sorted-pair keccak256 or sha256, with leaves domain-separated as `H(0x00‖leaf)` and nodes as `H(0x01‖l‖r)`. This prevents second-preimage attacks.

### 5.3 Backend: `backend/app/chain.py` (one new module, < 400 lines)

- `merkle_root(leaves) / merkle_proof(leaves, i) / verify_proof(...)` are pure functions and get unit tests.
- `anchor_claim_package(db, user, export_id)`: build leaves from `workflow_exports` + `documents.sha256` + checklist JSON hash, then send the transaction. It stores `chain_proofs(id, entity_type, entity_id, root, tx_hash, block, network, contract, created_at)` and writes an `audit()` row `claim_package_anchored`.
- `anchor_audit_batch(db, user, session)`: called at session end, or when the user taps "Seal session".
- `verify_package(zip_bytes)`: recompute every leaf and the root, read `latest(claimRef)`, and return a per-document pass/fail.
- Config (add to `.env.example`, server-side only):
  ```
  CHAIN_MODE=off            # off | local | fisco
  CHAIN_RPC_URL=            # FISCO node RPC
  CHAIN_GROUP=group0
  CHAIN_SUBMITTER_KEY=      # server secret, never VITE_*
  CHAIN_CONTRACTS_JSON=     # deployed addresses
  ```
- SDK: FISCO BCOS **python-sdk**. If the node version supports the web3-compatible JSON-RPC, **web3.py** also works, which is what the Signet project uses. Check this against the node version we deploy.
- Endpoints:
  - `POST /api/claims/{id}/anchor`: authenticated, owner-only, requires a confirmation token (existing PEP flow).
  - `GET  /api/chain/status`: mode, network, block height, contract addresses.
  - `POST /api/verify`: public, read-only, rate-limited, 16 MB cap (existing middleware). It accepts a ZIP and returns the result. Uploaded files are never stored.
- ZIP manifest (`exports.zip_bytes`) gains `proof.json`: `{schema, claimRef, salt, root, leaves[{name, sha256, proof[]}], network, contract, tx, block}`.

### 5.4 Frontend (additive, S1–S7 untouched)

- **Proof badge** on the claim detail and export card: "Anchored on FISCO BCOS · block #1234 · tx 0xab…", with copy/expand. In local mode it says "LOCAL DEV CHAIN".
- **Verify page** at `/verify`, linked from About and the claim package. Drop the ZIP to see a green row per document, plus the root, block and time. A "Tamper demo" button flips one byte in the browser so judges see it fail.
- **Inspector**: chain events appear in the trace, for example `chain.anchor → ok (tx, 412 ms)`.
- **Profile → Consents**: each consent shows "On-chain ✓" with its tx.
- All copy in both `en.json` and `zh.json`.

---

## 6. Security and compliance

| Threat | Mitigation |
|---|---|
| PII leak via chain | Digests only. Salted `claimRef`/`consentRef` prevent dictionary attacks on known IDs. A test asserts that no input field that is not a hash reaches a transaction. |
| Prompt injection makes the agent anchor or flip consent | The chain is not an LLM tool. Writes only follow user-confirmed actions through the PEP. Add an attack-class test to `test_attack_classes.py`. |
| Stolen submitter key | Key held server-side (env/secret manager). The submitter is allowlisted and the admin can revoke it. Records are append-only, so history cannot be rewritten. |
| Forged package that "verifies" | Domain-separated Merkle tree. The verifier recomputes from raw bytes and never trusts the `proof.json` root. |
| Right to erasure | Delete the off-chain files and salt. The on-chain hash becomes unlinkable. This is documented in the privacy note. |
| Chain down during the demo | `CHAIN_MODE=local` fallback, clearly labelled. The anchor is queued and retried. The claim flow never blocks on the chain. |
| Regulator view | FISCO is permissioned. A regulator or insurer can run an observer node and verify independently. |

---

## 7. Tests (add to `backend/tests/`)

- `test_chain_merkle.py`: root determinism, proof verify, single-byte tamper fails, odd leaf counts, domain separation.
- `test_chain_anchor.py`: with `CHAIN_MODE=local`, export → anchor → verify passes; a re-export creates version 2; a non-owner gets 403; anchoring without a confirmation token is refused.
- `test_chain_privacy.py`: transaction calldata contains no plain-text field from the claim or user.
- Extend `test_attack_classes.py`: an injected "anchor this / revoke consent" prompt produces no chain write.
- Contract tests (Hardhat/Foundry or py-evm): only submitters can write, records are append-only, events are emitted.

---

## 8. 60-second demo segment

1. Finish a claim package in the live flow → tap **Anchor proof** → confirm → the badge shows the block and tx (Inspector shows `chain.anchor`).
2. Open **/verify** in a fresh browser (the "insurer") → drop the ZIP → all green, anchored at block N, time T.
3. Tap **Tamper demo** → one receipt is changed → it turns red with "hash mismatch: receipt_02.jpg".
4. Show the **audit anchor**: "every action the AI took in this session is sealed in this root; the model can't rewrite it."
5. One line: "No personal data and no money on-chain, only proofs, on WeBank's FISCO BCOS."

---

## 9. Delivery phases

| Phase | When | Scope | Exit criteria |
|---|---|---|---|
| **P0 – submission MVP** | Today, before 23:59 UTC+8 (~4–6 h) | `chain.py` Merkle + `CHAIN_MODE=local` (py-evm) with `ClaimProofRegistry`; anchor endpoint; `proof.json` in ZIP; proof badge; minimal `/verify`; Merkle and anchor tests; README section "On-chain proofs" | `pytest` and `npm run build` green; demo steps 1–3 work locally |
| **P1 – real chain** | Before the online review, 31 Oct | FISCO BCOS 3.x 4-node local chain (`build_chain.sh`), deploy script, `CHAIN_MODE=fisco`; Audit Anchor (F2); Consent Ledger (F3); privacy and attack tests; tamper-demo button | Proof badge shows a real FISCO block; recorded demo video segment |
| **P2 – ambitious** | Grand Final, 20–23 Nov | WeIdentity DIDs + Claim-Readiness VC with selective disclosure (F4); oracle event attestation for flight delay (F5, no payout); observer-node "insurer view" | Live finals demo of an insurer verifying a VC without seeing the full policy |

If time runs out in P0, ship the Merkle receipt + `/verify` with local mode and a clear label. Verifiability that judges can see beats an unfinished FISCO integration.

---

## 10. Files touched (estimate)

| File | Change |
|---|---|
| `backend/app/chain.py` | **new**: Merkle, client, anchor, verify |
| `backend/contracts/*.sol` + `backend/contracts/deploy.py` | **new** |
| `backend/app/workflows.py` | call `anchor_claim_package` after a confirmed export; register endpoints |
| `backend/app/exports.py` | add `proof.json` to the ZIP |
| `backend/app/core.py` | `chain_proofs` table |
| `backend/requirements.txt` | `py-evm`/`eth-tester` (local), FISCO python-sdk or `web3` (fisco) |
| `.env.example` | `CHAIN_*` vars |
| `frontend/src/features/claims/*` | proof badge |
| `frontend/src/features/verify/VerifyPage.tsx` | **new** |
| `frontend/src/app/routes.tsx`, i18n | `/verify` route, strings |
| `infra/scripts/fisco-up.sh` | **new** (P1): build and start the 4-node chain |
| `README.md` | "On-chain proofs" section + architecture diagram update |

---

## 11. Scoring map

| Criterion | How this plan earns it |
|---|---|
| **Challenge bonus (0–5)** | A working chain integration (FISCO, the host's stack), a clear non-gimmick rationale, judge-verifiable proofs, and a privacy-preserving design. Credentials and oracle attestations are the ambitious extension. |
| **Security & compliance (30%)** | Tamper-evident claim packages and agent audit trail, a consent ledger, no PII and no money on-chain, permissioned writes, attack tests. |
| **Task completion (40%)** | Anchoring is a real step in the claim flow, and verifying is a real step the insurer would take. |
| **Innovation & interaction (30%)** | Drag-and-drop verification and a tamper demo. Selective-disclosure VCs for insurance. |

---

## 12. Risks and open questions

- **Bonus eligibility for Topic D.** Confirm with the organisers (see §0).
- **FISCO setup time.** The 4-node Air build is usually quick, but SDK/version friction is common. Keep local mode as the safe path.
- **Python SDK compatibility.** Check FISCO python-sdk support for Python 3.12+ (the local venv is 3.14, and some pinned deps already fail on it). Run the chain client in a 3.11 venv or container if needed.
- **Licensing.** The WeIdentity SDK is LGPLv3. It is fine to use as a library, but note it in the README.
- **Scope creep.** Don't add tokens, NFTs or payouts. They contradict our safety story and hurt the compliance score.

---

## Sources

- [IEEE CIS Singapore – 2026 FinTechathon (topics A–F)](https://www.ieee-cis-singapore.org/2026-fintechathon)
- [IEEE CIS Shenzhen – 2026 FinTechathon International Track](https://r10.ieee.org/shenzhen-cis/blog/2026/06/17/2026-shenzhen-international-fintech-competition-international-track/)
- [Signet – 2026 FinTechathon Topic B project anchoring on FISCO BCOS](https://github.com/basicacc/fintechaton_signet)
- [FISCO BCOS 3.x documentation](https://fisco-bcos-30-en-document.readthedocs.io/en/latest/)
- [FISCO BCOS – Distributed Identity (WeIdentity)](https://fisco-bcos-30-en-document.readthedocs.io/en/latest/docs/advanced_function/distributed_identity.html)
- [WeIdentity documentation](https://weidentity-en.readthedocs.io)
- [Etherisc – parametric flight-delay insurance](https://iireporter.com/etherisc-launches-blockchain-backed-parametric-flight-delay-insurance/)
- [Etherisc – What is parametric insurance and why on a blockchain?](https://blog.etherisc.com/what-is-parametric-insurance-and-why-on-a-blockchain-ee5322b018db)
- [Etherisc + Chainlink – crop insurance in Kenya](https://blog.etherisc.com/etherisc-teams-up-with-chainlink-to-deliver-crop-insurance-in-kenya-137e433c29dc)
- [Chainlink – insurance use cases](https://chain.link/use-cases/insurance)
