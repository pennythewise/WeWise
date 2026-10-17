# Verification receipt - 17 October 2026

Public deployment verification is recorded in [DEPLOYMENT.md](DEPLOYMENT.md).
The earlier local receipt below remains the baseline.

## Feature acceptance audit - 17 October 2026

- Final combined backend: **200 passed, 3 skipped**, exit 0 in 103.92 seconds.
  The skipped checks need the optional local Tencent sidecar, which was unavailable
  during this audit. The only warning is the upstream Starlette TestClient
  deprecation. No live model call was made.
- Functional category: 108 passed, 3 optional skips. Adversarial category:
  108 passed, 1 optional skip. Categories overlap; do not sum them as unique cases.
- Gateway: **12 passed**. TypeScript and production frontend build passed.
  Optional simulator/3D chunks remain lazy-loaded and trigger the size advisory.
- New reproductions cover current/confirmed portfolio evidence, relevant verbatim
  retrieval, Chinese sales patterns, fresh policy imports, exact owned wording
  bytes and honest deletion/snapshot disclosures.
- UI acceptance fixes expose portfolio observations, family correction, chat
  guidance cards, conditional evidence, insurer source links, persisted exports,
  acknowledgement provenance, comparison limitations and mobile extra tools.
  Optional 3D has a local error boundary; unsupported WebGL hardware is not tested.
- GitHub Ubuntu CI passed for runtime `90b81cf`: **200 backend passed, 3 skipped**;
  **12 gateway passed**; TypeScript/build passed. [CI receipt](https://github.com/pennythewise/WeWise/actions/runs/39034878560).
- Fresh public release: **16 API groups passed**, including actual PDF/ZIP bytes,
  saved export readback, conditional checklist, Chinese sales checks, uploaded
  acknowledgement provenance and cross-account denial. Public alias serves final
  asset `index-D-3lNoVh.js`; frontend and restarted backend match runtime `90b81cf`.
- Earlier in this audit, public desktop/390/360px journeys and a newly uploaded
  image-only policy processed by actual OCR passed. Source review, original OCR
  upload and existing private workspaces survived the backend update. The earlier
  hosted stop/snapshot/resume receipt remains separate from this service restart.
  Deployment details are in DEPLOYMENT.md.
- Final CUA Chrome recheck passed for the changed chat, policy, claim and buying
  flows, including saved prior exports and acknowledgement-original links. At
  360px: client/scroll width 345/345; at 390px: 375/375. Mobile extra tools and
  actual inspector are reachable. The simulator's opaque notice, click/reload
  mode preservation and native exit into real features passed. Seven direct
  incident-guide runtime assertions also passed, including unknown/MY contacts
  staying empty and no shared fabricated deadline. No physical microphone or
  camera was activated.

## Earlier local baseline

Environment: local Windows, Python 3.12 virtual environment, Node 24.19, React/Vite,
FastAPI at `http://127.0.0.1:8017`, browser development app at
`http://127.0.0.1:5177`. The built SPA is also served by the backend. These are
local checks, not a public deployment or insurer acceptance.

## Executed results

| Check | Result | Evidence/limit |
|---|---|---|
| Full backend suite | PASS, 157 tests | `WEWISE_TEST_TENCENT=1 python -m pytest -q`; actual local Tencent sidecar included |
| Functional acceptance category | 70 collected, all pass | `pytest -m task`; exceeds 36; some cases also have attack classification |
| Adversarial category | 98 collected, all pass | `pytest -m attack`; exceeds 60; categories overlap, total remains 157 |
| TypeScript | PASS | `pnpm typecheck`, also required by production build |
| Production build | PASS | `pnpm build`; optional simulator/3D chunks exceed 500 kB and are lazy-loaded |
| Combined server smoke | PASS | SPA/assets 200, unknown API 404, private guest access 401, urgent help 200 |
| Actual CPU OCR | PASS | Generated image with known text processed by RapidOCR; not a seeded text response |
| Published policy source | PASS | Actual 19-page file, pinned SHA-256, citation quotes/page provenance and prepared-package original bytes checked |
| Actual local Tencent | PASS | Approved write/readback, private namespaces, edit/delete, Bearer auth and strict-scope rejection |
| Live model endpoint | NOT RUN | User defers key and exact model ID; no live generation claim |
| Provider protocol fixtures | PASS, mocked | Anthropic and compatible/Qwen/TokenHub full/base URL request/response formats; not a live service test |

The backend run reports one upstream Starlette TestClient deprecation warning.
It does not indicate a failed application check.

## Browser evidence

CUA in-app browser was used against the actual frontend/API, not HTML screenshots
alone. Desktop and 390/360px layouts were inspected. The flow under test was:
login -> policy/source review -> cited answer -> incident/evidence review ->
reviewed download -> isolated simulator, with buying/memory/guest-help branches.
Page identity was WeWise/微晓 at the expected localhost URL; meaningful content
rendered with no framework overlay. The final fresh-tab console error/warning
list was empty. Browser viewport emulation was restored after the checks.

Verified interactions include actual multipart evidence upload, correction and
confirmation (missing count decreased), incomplete draft PDF/ZIP, cross-border
PDF download, sourced comparison and agent-brief download, simulated callback,
approved-memory create/edit/delete, audit display and guest urgent help/forms.
The genuine case never became insurer-submitted because a simulator advanced.

Read-only review and rendered testing found and fixed an evidence-field schema
mismatch, empty official form links, a stale-memory race, a cross-border export
500, and review resumption after uploading a file. Regression tests cover the
backend fixes. Screenshots under `docs/qa` show the checked local frontend.

## Repeat

```powershell
$env:WEWISE_TEST_TENCENT='1'
.\.venv\Scripts\python.exe -m pytest -q
pnpm build
.\.venv\Scripts\python.exe scripts/verify-running.py
```

Use `scripts/setup-memory.ps1` and `scripts/start-memory.ps1` for the pinned
standalone Tencent sidecar. Without `WEWISE_TEST_TENCENT=1`, three local-sidecar
tests are explicitly skipped; do not describe that default run as live-sidecar
verification.

Remaining limits: actual microphone/camera permission flows depend on the user's
device, no live model/key/entitlement verification, no insurer/bank/phone-transfer
connection, no certified translation, no upstream history/backup erasure proof,
The public preview now has its own private approved-memory ledger (Tencent is not
hosted there). See `DEPLOYMENT.md` and `FEATURE_STATUS.md` for its boundaries.
