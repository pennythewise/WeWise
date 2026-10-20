<div align="center">

# WeWise 微晓

### Your AI Companion for Insurance Management and Claims
**保险问微晓，安心少烦恼** · *Ask WeWise about insurance, worry less.*

FinTechathon 2026 · International Track · Direction D, AI Insurance Assistant

</div>

---

## Overview

WeWise is a customer-side AI insurance assistant. It consolidates a person's policies from different insurers into one workspace, explains them in plain language with the original clause cited, finds gaps and overlaps, and stays with the customer through an incident: an AI emergency call, AR-guided evidence capture, a personalised claim checklist and a downloadable claim package, all under the customer's control.

> Understand · Plan · Execute safely (理解、规划、安全执行)

**Project summary.** WeWise helps policyholders worldwide manage their insurance portfolios, understand coverage and navigate claims. Users import their insurance documents to build a consolidated portfolio. WeWise organises policy details, supports renewal planning, and highlights potential coverage gaps or overlaps for review. Conversational assistance backed by references to the original policy pages lets users explore benefits, exclusions and claim requirements, while separating confirmed terms from information that needs verification. When an incident occurs, an AI emergency phone assistant helps users reach the relevant policy information and understand immediate assistance steps, and augmented-reality guidance helps them capture claim evidence at the scene. WeWise then translates policy requirements into personalised checklists, identifies missing documents and prepares downloadable claim packages for review, with a preparation tracker for outstanding tasks. Private workspaces, permission checks, transparent execution and user confirmation keep policyholders in control.

### Design principles

1. **Numbers from code, words from the model.** Dates, waiting periods, limits, co-pay, premiums and cost estimates are computed by deterministic functions. A model may explain them; it never produces them.
2. **The model has no authority.** Every tool call crosses a deterministic Policy Enforcement Point (PEP). The system is designed to stay safe even if the model is fully manipulated.
3. **No money tools.** There is no transfer, payout, refund or premium-payment function anywhere in the codebase.
4. **Every claim is sourced.** A coverage statement carries a clause id, page and verbatim quote, or the assistant says it is not sure and offers a human.
5. **Customer-side and neutral.** WeWise does not underwrite and does not sell insurance. It prepares the customer and hands off to a licensed agent with consent.
6. **Provable, not just logged.** Claim packages, consent records and the agent's audit trail are fingerprinted and anchored on-chain, so the customer and the insurer can both check that nothing was changed. Only salted hashes go on-chain.

---

## System architecture

```
 ┌───────────────────────────── Frontend (React 18 · Vite · TS) ─────────────────────────────┐
 │  Screens (home · shop · policies · claims · chat)      Agent Inspector (trace viewer)      │
 │  Event-sourced chat reducer ── TraceEvent stream ──►  Card union (exhaustive renderer)    │
 │  AgentClient interface:  HttpAgentClient (SSE)  |  MockAgentClient (scripted, deterministic)│
 └───────────────────────────────────────────┬───────────────────────────────────────────────┘
                                             │ /api  (same-origin, SSE for traces)
 ┌───────────────────────────────────────────▼───────────────────────────────────────────────┐
 │ FastAPI                                                                                   │
 │  Boundary middleware: 16 MB limit · origin checks on writes · nosniff · no-store          │
 │                                                                                           │
 │  Orchestrator ─ bounded deterministic plans (≤ 8 tool calls, ≤ 45 s per turn)             │
 │       │                                                                                   │
 │       ▼                                                                                   │
 │  POLICY ENFORCEMENT POINT ── authN/Z · ownership · risk tier · arg validation ·           │
 │       │                      intent binding · confirmation tokens · PII masking · audit   │
 │       ▼                                                                                   │
 │  34 tools ── policy · coverage gap · cost estimator · claim prep/FSM · buying · memory    │
 │       │                                                                                   │
 │  ┌────▼────────────────┐ ┌────────────────────────┐ ┌────────────────────────────────┐   │
 │  │ Document pipeline   │ │ Retrieval              │ │ Insurer simulator + claim FSM  │   │
 │  │ PyMuPDF + RapidOCR  │ │ FTS5/BM25 + E5 (ONNX)  │ │ controllable clock, isolated   │   │
 │  │ → pages → clauses   │ │ RRF fusion, owner-scoped│ │ state per claim                │   │
 │  └─────────────────────┘ └────────────────────────┘ └────────────────────────────────┘   │
 │                          SQLite (authoritative) · optional MemoryCore mirror              │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent design

### Plan → execute → verify

Each user turn produces a validated **plan** (an ordered list of tool steps with a declared purpose), then executes it step by step while streaming **trace events** to the UI, then verifies citations and numbers before the final message is emitted. Plans are bounded (8 tool calls, 45 seconds per turn) and every step is recorded in an audit log. The model can phrase the answer; it cannot add steps.

The UI and engine share one contract: a typed stream of events (`turn.started`, `understand.done`, `plan.created`, `plan.step.started/done`, `tool.call`, `tool.result`, `guard.pii_masked`, `guard.injection_flagged`, `guard.denied`, `guard.confirm_required`, `verify.result`, `plan.replanned`, `ui.card`, `message.final`, `notify.push`, `turn.completed`). The chat is rendered by reducing this stream, and the **Agent Inspector** renders the same events as pipeline, tools, safety, evidence and overview views.

### Policy Enforcement Point and risk tiers

| Tier | Class | Examples | Gate |
|---|---|---|---|
| **T0** | Public or catalogue read | product search, emergency contacts, incident types | scope check |
| **T1** | Own personal-data read | policy get, claim status, portfolio summary | authentication and **ownership** check |
| **T2** | Reversible own-data write | claim draft, field correction, memory write | argument validation, **intent binding**, audit |
| **T3** | External effect, or data leaves the platform | claim submit, agent handoff | **server-issued confirmation token** bound to the argument hash, masked preview |
| **T4** | Critical, irreversible or money-adjacent | change payout account, cancel policy, pay premium | **never executed**; returns guide-only official-channel instructions |

- **Intent binding.** A T2+ step must trace back to the user's own request in the current turn. A call outside the validated plan is denied with `UNBOUND_INTENT`, which neutralises injected instructions that try to add actions.
- **Quarantined extraction.** Text pulled from uploaded documents is treated as data, scanned for instruction-like content, and can never grant tool permission.
- **PII vault.** Identifiers are masked before they reach any model context or log.
- **Optional model adapters** (OpenAI-compatible endpoint, direct Claude, TypeSafe JEV) are advisory: their output never carries tool permission, claim eligibility or approval.

---

## Document intelligence and retrieval

1. **Ingestion.** PDFs go through PyMuPDF text extraction per page; scanned pages fall back to **RapidOCR** (CPU, ONNX) with a per-document page quota and an explicit manual-entry fallback. Every extracted value keeps its source page and a confidence score (unknown confidence is `null`, never invented).
2. **Structure.** Pages become clauses and chunks; critical facts (limits, deductible, co-pay, waiting period, exclusions, renewal terms) are extracted into reviewable fields. The user confirms or corrects them with one tap before anything depends on them.
3. **Review.** Rules locate evidence; they do not decide entitlement. Observations are source-bound and flagged when a source term needs verification.
4. **Retrieval.** Owner-filtered **SQLite FTS5/BM25** plus a pinned local multilingual **E5-small** ONNX embedding model (hash-verified, CPU-only, never downloaded on a request), fused with **reciprocal-rank fusion**. Queries and document text never leave the process.
5. **Citation verification.** Answers are checked so each coverage statement resolves to a real clause and page; otherwise the response degrades to "not sure" with a human handoff.

---

## Claims engine

- **Pre-screen.** Waiting-period and inception date arithmetic, exclusion matching and limit checks produce *likely covered / likely excluded / uncertain*, with clause citations and the information still missing.
- **Checklist and preparation tracker.** Policy requirements are translated into a per-claim document checklist; each upload runs through OCR and extraction, and the user confirms the fields. The tracker records outstanding tasks and next steps.
- **Claim package.** Private, source-labelled PDF and ZIP exports, served only through owner-scoped routes. Each ZIP carries a `proof.json` whose Merkle root is anchored on-chain (see below).
- **Insurer state machine.** An isolated, separately labelled FSM (submitted → document review → info requested → assessment → decision → payout) driven by a **controllable clock**, so timelines are reproducible. Notifications are generated from state transitions, with plain-language explanations of delays and next steps.
- **Evidence capture.** Guided multi-photo capture with a 3D orientation guide (React Three Fiber) that links scene evidence to the claim checklist.
- **Cross-border kit.** Policy facts in the local language, local emergency numbers, a bilingual incident report and a flow to connect the other party.

---

## Marketplace engine (选保险)

Your personal shopper for insurance: it knows what you already own, so it shows what is worth adding and what would only repeat your cover.

- **Pricing is a pure function.** `price = base × Π fieldFactor(answer)` over a per-category questionnaire (age curves, sex and smoker loadings, sum insured, term, deductible, destination and trip length, car value and claim-free years, home value and use). The same function drives the product card, the product page, sorting, comparison and checkout.
- **Pre-quote ranges.** Before the questionnaire is answered, the price is shown as an interval computed over typical customer values, holding plan-configuration choices (sum, term, deductible) at their defaults. After the questionnaire, every plan shows one exact price.
- **Personalised picks.** Recommendations are derived from the user's portfolio: categories with no cover, and products that close a gap recorded on an existing policy.
- **Comparison in chat.** Compare mode multi-selects 2 to 3 same-category plans and hands them to the assistant, which asks for the dimension (overall, coverage, price, claims, fit for you). Rows, winners and the written analysis are computed by `mock/shopCompare.ts`, and the reply is rendered as a comparison card.
- **Checkout.** Applicant details, health declaration for medical, critical-illness and life products, payment and an issued policy number, which then appears in the portfolio.

---

## Frontend architecture

- **`AgentClient` abstraction** with two implementations behind one interface: `MockAgentClient` (a deterministic scenario player with a keyword and utterance router) and `HttpAgentClient` (SSE to the FastAPI service). Preset prompts always take the scripted path; free text goes live when the backend is reachable and falls back otherwise.
- **Event-sourced chat.** A pure `applyEvent` reducer folds the trace stream into messages, cards, plan steps and progress. Cards are a discriminated union rendered by an exhaustive `switch`, so adding a card kind without a renderer fails to compile.
- **Generative rendering.** Assistant text streams token by token (Latin words, CJK character pairs, citation markers kept atomic). Cards are built by a DOM-level reveal wrapper that types text in reading order and un-hides visual elements as the stream reaches them, so no card needs bespoke animation code. Both respect reduced-motion and stage speed.
- **State** in small Zustand stores (agent, claims, cross-border, memory, location, extraction, capture, shop, typing). **i18n** with i18next (Chinese and English, switchable live). **3D** asset showcase and evidence guide with React Three Fiber.
- **Adaptive layout.** One app, three modes (phone, tablet, showcase), the app column never wider than 430 px, with an optional stage panel for demos.

---

## On-chain proofs (FISCO BCOS)

WeWise sits between two parties that do not fully trust each other: the customer and the insurer. Neither should have to trust WeWise's own database, so the facts that matter are anchored on a shared ledger.

| Proof | When it is anchored | What goes on-chain |
|---|---|---|
| **Claim package** | The user confirms a package export | Merkle root over every file in the ZIP (summary PDF, manifest, originals) |
| **Consent record** | Any consent is granted or withdrawn (save a document, memory, sharing) | Hash of the consent record |
| **Agent audit seal** | The user seals a session | Merkle root over the user's audit log, including every blocked tool call |

- **Only hashes.** Each entry is a salted reference, a SHA-256 root, a kind and a time. No names, policy numbers, amounts or files. Deleting a case deletes its salt, so the on-chain entry can no longer be linked to it.
- **No money, no model authority.** `ProofRegistry.sol` has no payable or transfer function. Anchoring is a deterministic side effect of a user-confirmed action; the model has no chain tool.
- **Anyone can verify.** `/verify` (and `POST /api/verify`) takes an exported ZIP, recomputes every file hash and the Merkle root, and checks the ledger. Changing one byte, adding or removing a file, or forging `proof.json` fails. Older exports are flagged when a newer version exists.
- **Tamper-evident agent.** `GET /api/chain/audit/verify` recomputes sealed audit roots, so a rewritten log row is detected.
- **Domain-separated Merkle tree.** Leaves are `H(0x00‖sha256)`, nodes `H(0x01‖left‖right)`, which prevents second-preimage forgeries.

| `CHAIN_MODE` | Ledger |
|---|---|
| `local` (default) | Append-only, hash-linked ledger in SQLite, clearly labelled **Local dev ledger** |
| `evm` | `backend/contracts/ProofRegistry.sol` over JSON-RPC: FISCO BCOS (web3-compatible RPC), Hardhat or Anvil. Deploy with `backend/contracts/deploy.py`; bytecode targets the `paris` EVM for consortium-chain compatibility |
| `off` | No anchoring |

The S1–S7 simulations show the same proofs with fixed, labelled demo values. Tests run the compiled contract on an in-process EVM (`backend/tests/test_chain.py`). The design and roadmap (WeIdentity credentials, oracle attestations) are in `docs/onchainplan.md`.

---

## Data, privacy and security

- **Storage.** SQLite is the authoritative store (users, sessions, documents, policies, chunks, claims, evidence, notifications, simulator state, memories, audit log, confirmations, conversations and tool-plan turns).
- **Isolation.** Application-owned identity; opaque sessions kept outside model context; per-customer isolated demo workspaces; every query is owner-filtered.
- **Temporary ingestion.** Uploads are held privately with a strict 24-hour access deadline and are saved into the vault only on explicit user action.
- **Memory.** Preferences are stored only after approval in an SQLite approval ledger; an optional Tencent MemoryCore sidecar mirrors approved projections only, and stale mirrors are rejected.
- **HTTP hardening.** Request size cap, same-origin enforcement on writes, `nosniff`, frame denial, referrer policy and `no-store` on API responses. Secrets live in server environment variables only.

### API surface (FastAPI, ~85 routes)

| Group | Routes |
|---|---|
| Identity | `/register`, `/login`, `/logout`, `/me`, `/demo` |
| Documents | `/documents`, `/documents/{id}`, `/analysis`, `/temporary-documents`, `/vault` |
| Policies | `/policies`, `/policies/{id}/summary`, `/clauses`, `/analysis`, `/premium-history`, `/extract` |
| Portfolio | `/portfolio`, `/portfolio/coverage-matrix`, `/renewals`, `/reports`, `/catalog` |
| Agent | `/chat`, `/chat/stream`, `/tools`, `/agent/tools/invoke`, `/agent/actions/confirm`, `/traces/{id}`, `/conversations` |
| Claims | `/claims`, `/claims/{id}` (`/confirm`, `/preview`, `/generate-form`, `/export`, `/evidence`, `/notifications`, `/crossborder-kit`, `/explanation`, `/simulation/*`) |
| Buying | `/buying/needs`, `/compare`, `/cost-estimate`, `/renewal-compare`, `/mis-selling-check`, `/surrender-check`, `/callback`, `/brief/*` |
| Memory and consent | `/memory`, `/preferences`, `/consents`, `/audit` |
| Health | `/api/health`, `/api/capabilities` |

---

## Evaluation

| Corpus | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Golden tasks | 164 | 0 | 2 |
| Attack suite | 158 | 0 | 1 |

The attack corpus covers hidden instructions in documents, information elicitation, privilege escalation, over-reach across owners and induced transfers. Both corpora are regression suites over the deterministic simulated environment and run in CI. Reproduce with `python backend/eval/run.py`, which regenerates `backend/eval/report.md`.

---

## Roadmap

The architecture is built so each of these plugs into an existing seam (the `AgentClient` contract, the tool registry and PEP, the pricing function and the insurer-simulator interface) rather than requiring a redesign.

| Area | Next step | Seam it plugs into |
|---|---|---|
| **Insurer connectivity** | Replace the simulator with live insurer claim-submission and status connectors, so submitted claims and status updates flow end to end | insurer-simulator interface, T3 confirmation path |
| **Live pricing** | Per-insurer rating-engine adapters feeding real quotes into the marketplace, with the same questionnaire schema | `quote()` and the category field schema |
| **Voice emergency agent** | Real-time telephony and speech pipeline for the emergency assistant, with local emergency numbers and policy lookup | emergency call flow, `emergency` route |
| **Vision evidence capture** | On-device AR pose guidance plus a vision model that scores shots and extracts damage and document details automatically | capture flow, document pipeline |
| **Licensed-agent network** | Matched agent marketplace with SLA, language, location and load balancing, calendars and consented handoff delivery | handoff tool (T3), buying routes |
| **Premium intelligence** | Premium-hike and product-withdrawal monitoring with proactive renewal alerts | portfolio, renewals and premium-history routes |
| **Regulated T4 flows** | Guided, step-up-authenticated change flows (beneficiary, payout account) handed to official channels | T4 guide-only tier |
| **More markets** | Additional languages and country rule packs (Malay summary first) | i18n, incident and local-policy data |
| **Open data room** | Bank and insurer SSO for one-tap portfolio import | document ingestion, identity |

---

## Business

WeWise is a neutral, customer-side layer between people and insurers.

| Stream | How it earns |
|---|---|
| **Licensed-agent handoff** | A consented, AI-written summary of needs and comparison goes to a matched licensed agent; qualified introductions earn a referral fee. |
| **Marketplace (选保险)** | Transparent cross-insurer comparison and quoting; partner insurers pay for qualified leads and conversions. |
| **B2B2C partnerships** | White-label WeWise inside a bank or insurer app for onboarding, renewals and claim readiness. Better-prepared claims mean fewer back-and-forth requests for the insurer. |
| **Premium features** | Family portfolios, cross-border claim kits and priority handoff. |

**First users:** young professionals who hold several policies across insurers (the primary persona is a 29-year-old with medical, accident and travel cover), frequent travellers, families with dependants and gig workers with fragmented cover. **Then:** older adults, protected from mis-selling by a surrender-and-rebuy red-flag check.

**Defensibility:** trust by construction (PEP and no money tools), clause-cited answers, whole-journey coverage so each stage feeds the next, and neutral positioning on the customer's side.

---

## Run it

Requires Node 24 with pnpm 11, and Python 3.11 or newer.

```bash
# Backend (optional: the app also runs fully on scripted data)
python3.11 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
WEWISE_RETRIEVAL_ONLY=1 WEWISE_SEED_DEMO=1 \
  .venv/bin/python -m uvicorn backend.app.main:app --port 8017

# Frontend
cd frontend
pnpm install
pnpm dev          # http://localhost:5173, proxies /api to :8017
pnpm build        # type-check + production build
```

`WEWISE_RETRIEVAL_ONLY=1` runs everything offline on synthetic data with no model credentials. On a wide screen the stage panel offers a scenario picker, play, pause, step, speed, reset, an **Attack toggle** and the Agent Inspector. Shortcuts: `Space` play or pause, `→` next step, `R` reset, `1`–`6` jump to a scenario, `A` attack, `I` inspector. Use `?record=1` to hide the controls, `?autoplay=1&scenario=N` to start on load and `?lang=en|zh` to pick a language.

<details>
<summary><b>Configuration</b> (copy <code>.env.example</code> to <code>.env</code>; credentials never go in <code>src/</code> or <code>VITE_*</code>)</summary>

| Variable | Purpose |
|---|---|
| `WEWISE_RETRIEVAL_ONLY` | `1` overrides all model credentials (public preview mode) |
| `WEWISE_SEED_DEMO`, `WEWISE_DEMO_WORKSPACES` | Synthetic demo accounts, one isolated workspace per click |
| `WEWISE_ENV`, `WEWISE_ALLOWED_ORIGINS`, `COOKIE_SECURE` | Production origin and cookie hardening |
| `AI_PROVIDER`, `AI_ENDPOINT`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | Optional OpenAI-compatible model |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | Optional direct Claude prototype (`AI_PROVIDER=anthropic`) |
| `WEWISE_EMBEDDING_DIR` | Local multilingual E5 embeddings, installed by the operator |
| `TENCENT_MEMORY_URL`, `TDAI_GATEWAY_API_KEY` | Optional private Tencent MemoryCore sidecar |
| `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` | Optional TypeSafe JEV adapter (advisory only) |
| `CHAIN_MODE`, `CHAIN_RPC_URL`, `CHAIN_CONTRACT`, `CHAIN_SUBMITTER_KEY`, `CHAIN_NETWORK` | On-chain proofs: `local` (default), `evm` (FISCO BCOS / any EVM RPC) or `off`. `evm` needs `backend/requirements-chain.txt` |

</details>

## Tests

```bash
.venv/bin/pip install -r backend/requirements-chain.txt  # optional: runs the ProofRegistry contract tests on an in-process EVM
.venv/bin/python -m pytest -q -c backend/pytest.ini     # backend functional and attack tests
node --test infra/tests/gateway.test.mjs                # gateway boundary tests
pnpm --dir frontend build                               # TypeScript + production build
.venv/bin/python backend/eval/run.py                    # golden tasks + attack corpus → backend/eval/report.md
```

CI (`.github/workflows/verify.yml`) runs all of the above on every push to `main` and every pull request.

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | React 18, Vite, TypeScript, Tailwind. `src/app` router and shell · `src/layout` phone frame and tab bar · `src/features` screens (`home`, `shop`, `policies`, `claims`, `chat`, `cards`, `capture`, `crossborder`, `location`, `switch`, `settings`, `showcase`, `inspector`, `stage`) · `src/engine` agent clients, scenarios, types · `src/mock` synthetic data, shop catalogue and compare logic · `src/i18n` Chinese and English |
| `backend/app` | `core` identity and storage · `documents`, `document_analysis` ingestion and review · `intelligence`, `semantic_retrieval` retrieval · `agent_foundation` planner and 34 gated tools · `workflows`, `claims_tracker` claims and insurer FSM · `lifecycle` temporary uploads and vault · `memory` · `exports` · `chain` on-chain proofs and public verification · `insurance_features` · `jev_adapter` |
| `backend/contracts` | `ProofRegistry.sol`, compiled ABI and bytecode, `deploy.py` |
| `backend/tests`, `backend/eval` | Pytest suite, golden-task and attack corpora, evaluation runner and report |
| `api/gateway.mjs` | Vercel serverless entry (stays at the repo root with `package.json`) |
| `infra/` | Sandbox gateway, deploy helpers, tooling scripts and gateway tests |
| `docs/` | `01_PRD.md` product requirements · `02_TECH_SPEC.md` backend and agent · `03_FRONTEND_PRD.md` frontend · `onchainplan.md` on-chain design |

**Deployment.** The static frontend is served by Vercel and `/api/*` is routed through `api/gateway.mjs` to the FastAPI backend inside a named Vercel Sandbox (port 8017 only). The gateway restricts hosts, methods and body size, and private retrieval services stay inside the sandbox. Details: `infra/deploy/LOCAL_RETRIEVAL_SERVICES.md`.

Insurer names appear as illustrative labels only, with no affiliation or endorsement.
