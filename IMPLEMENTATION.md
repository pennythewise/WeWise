# Expanded app update —17October2026

The [complete requirement register](docs/REQUIREMENTS_STATUS.md) and [current feature boundaries](FEATURE_STATUS.md) supersede older missing-feature notes below. New routes: `/reports`, `/incidents`; the main assistant persists conversations and executes validated plans with34 adapters. Run `python eval/run.py` for the task/attack corpus, `python scripts/measure-agent.py --help` for measured streaming scenarios and `python scripts/verify-expanded-preview.py --help` for the full-stack smoke. Operator installation of local semantic assets and private Tencent MemoryCore is documented in [deploy/LOCAL_RETRIEVAL_SERVICES.md](deploy/LOCAL_RETRIEVAL_SERVICES.md). No external model or JEV credential is needed for retrieval mode.

---

# WeWise implementation and team runbook

Mainland China insurance assistant, with Japan travel incidents as the complete
demonstration case. This is an independent hackathon prototype in a WeBank-inspired
shell. It is not a WeBank release or proof of insurer/bank partnership.

## Start locally

Requires Node 24+, pnpm, Python 3.12+ and PowerShell. From this repository:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
pnpm install --frozen-lockfile
Copy-Item .env.example .env # only for first setup; preserve an existing .env
.\scripts\start-backend.ps1
# In another terminal:
pnpm dev --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173. Synthetic demo login:
`demo@wewise.test` / `WeWiseDemo2026!`. A second account,
`other@wewise.test`, uses the same demo password to demonstrate isolation.
These are local seeded test accounts, not production authentication credentials.
Use only synthetic customer documents in this hackathon build.

The **Start a private synthetic demo** button creates a separate account,
session and copy of the example documents for each tester. It does not use the
shared local login. The demo session lasts up to 12 hours; signing out ends
access to that workspace. Use a separate registered account when a password-based
return visit is needed. Neither option verifies an email address.

`pnpm build` produces the SPA. Restart the backend after building to serve the
complete application at http://127.0.0.1:8017. The `/api` endpoints use the same
origin, HttpOnly session cookies and owner-constrained queries.

For an HTTPS teammate preview, set `WEWISE_SEED_DEMO=0`,
`WEWISE_DEMO_WORKSPACES=1`, `WEWISE_RETRIEVAL_ONLY=1`, `COOKIE_SECURE=1`,
`WEWISE_ENV=production` and `WEWISE_ALLOWED_ORIGINS` to the exact public HTTPS
origin. Set `WEWISE_DATA_DIR` to the deployment's writable storage directory.
Retrieval-only enforcement overrides any ambient provider keys and disables model
requests, including translation requests. The preview remains synthetic-data-only.
If the deployment has temporary storage, its separate deployment receipt must state
when account and uploaded-document data may reset. Without a deployed private
Tencent sidecar, leave its URL and credential unset; approved memory then uses
the local ledger and the health report names that engine accurately.

## WorkBuddy Token Hub connection

The supplied five-page guide shows a compatible Chat Completions endpoint:
`https://tokenhub.tencentmaas.com/plan/v3/chat/completions` (page 3).
Page 4 shows account-dependent model choices. Those display names do not establish
the exact API model ID or which models the account can call.

Edit local `.env` when the key is available:

```dotenv
AI_PROVIDER=openai_compatible
AI_ENDPOINT=https://tokenhub.tencentmaas.com/plan/v3/chat/completions
AI_MODEL=the-exact-model-id-from-your-account
AI_API_KEY=your-key-in-this-local-file-only
```

The endpoint accepts a full path without appending a second `/chat/completions`.
Restart the backend. Confirm `/api/health` shows configured, then run a policy
question and inspect the actual model stage in the agent inspector. Configuration
alone is not proof of a successful model call. Model/endpoint entitlement and
compatibility must be checked with the account when its key is provided.

Direct Claude is also supported with `AI_PROVIDER=anthropic`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` and `AI_MODEL`. Future Qwen uses the
compatible adapter with its own actual endpoint, model and key. Keys never enter
the frontend, `VITE_*`, source control, audit entries or exported claim packets.

Until a model is configured, questions use actual owner-scoped document retrieval
and visibly labelled source extracts. There are no fabricated model calls.

## Tencent approved memory

The application ledger stores only explicitly approved preference categories.
Memory starts disabled. The user can enable, inspect, edit and delete it under Me.
Medical/identity/policy facts stay outside long-term preference memory. Only an
enum derived from communication preferences can influence answer style; policy
facts, authorization and action confirmation remain authoritative elsewhere.

Optional real Tencent MemoryCore sidecar:

```powershell
.\scripts\setup-memory.ps1
# Set TENCENT_MEMORY_URL=http://127.0.0.1:8420 in .env.
# Generate a strong TDAI_GATEWAY_API_KEY locally and set it in .env.
.\scripts\start-memory.ps1
```

Pinned upstream: TencentCloud/TencentDB-Agent-Memory,
`e9a82935b52741e0c798c75326e90b7144eb4d5f`. Install scripts are disabled to avoid
installing global coding-agent plugins. The sidecar binds to loopback, requires
Bearer authentication and strict scope, and captures no chats automatically.
Each customer has a server-assigned private team **and** agent namespace.
Readback must equal the current approval ledger; stale/poisoned upstream memory
cannot resurrect a deleted fact. Edits/deletions replace the active projection.
Upstream version-history erasure and backup erasure are not claimed. Current
retrieval excludes deleted facts immediately. This limitation must be resolved
before collecting real personal data or making production deletion promises.

## Main workflow

1. Sign in. Open the synthetic travel policy and its real published wording.
2. Upload PDF/JPG/PNG/TXT, inspect page provenance and correct extracted facts.
3. Confirm insurer, policy number, insured person, period and selected benefits.
4. Ask a policy question. Open source citations and inspect retrieval/model trace.
5. Create a Japan outpatient incident with facts and claimant role.
6. Review conditional checklist, upload synthetic evidence and confirm its type
   and facts. A routine outpatient fall does not automatically require a police
   report or discharge record.
7. Generate and review the application form. Confirm the current incident revision.
8. Preview the exact documents, recipient and purpose; confirm the expiring,
   single-use snapshot. Download real PDF/ZIP. Edits invalidate prior confirmation.
9. The genuine case remains **PREPARED_NOT_SUBMITTED**. Use the official insurer
   channel yourself. User-reported updates and uploaded acknowledgements carry
   their actual provenance; neither proves an insurer API integration.
10. The separate insurer simulator can show receipt/review/payment examples. It
    cannot change the genuine case to submitted, approved or paid.

Buying captures requirements and compares three published China-issued travel
wording references. It shows tradeoffs and missing facts, not fabricated live
premiums or a whole-market winner. Review and export a real agent brief; callback
receipts remain simulated. Renewal prompts request a new review, not auto-renewal.

Guest urgent help works before authentication. Japan emergency contacts and
Japanese/English communication cards are sourced. Browser speech input/output and
camera capture require device support and permission; text/direct human contacts
remain available. Authenticated assistance drafts can use the configured model with explicit
external-processing consent; without a key they retain original text visibly.
No certified translation is claimed. No PSTN call, live hotline transfer or AR
damage measurement is implemented. The optional 3D view is a visualization, not a valuation or coverage
decision. The original scripted frontend remains at `/?mode=simulator`.

## Retrieval and safety

PyMuPDF reads text PDFs; bundled RapidOCR/ONNX handles scans on CPU. The quota is
15 MB per saved document, 100 pages, at most 12 scanned pages per file, 150 MB per
account. OCR failures are visible and require manual correction. Unsaved temporary
uploads are rejected; no unsupported 24-hour purge promise is shown.

RAG uses owner-scoped SQLite FTS5/BM25 and multilingual lexical matching. It does
not claim vector embeddings. Suspected instruction chunks are quarantined.
Model requests receive selected redacted passages, have no tools and cannot take
actions. Outputs require known inline citations, supported numbers and no payout
guarantees; rejected/unavailable output falls back to source extracts. These
checks reduce specific errors; they do not prove complete semantic entailment or
eliminate hallucinations. Human review is required for insurance decisions.

JEV is not connected. The inspector identifies deterministic routing honestly;
no JEV decision is presented as real. Bank SSO, insurer APIs, licensed-agent
integration, real quotes, policy issuance, payments and payout decisions are not
connected. Future commissions require the appropriate licensed arrangement.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
# With the actual local Tencent sidecar running:
$env:WEWISE_TEST_TENCENT='1'
.\.venv\Scripts\python.exe -m pytest -q
pnpm typecheck
pnpm build
```

Tests exercise tasks and attack matrices separately (`-m task` / `-m attack`).
Provider-protocol tests use explicit HTTP stubs and are not live-model evidence.
Tencent opt-in integration tests use the actual local sidecar. Browser and API
checks are separate from production, regulatory or insurer acceptance.

Before any public deployment, use HTTPS/secure cookies, disable seeded accounts,
configure exact origins, durable encrypted storage, backup/deletion procedures,
operational monitoring, and the appropriate China data-processing deployment.
This local build is not a production readiness or China compliance certification.
