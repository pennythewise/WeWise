# Verification receipt - 17 October 2026

Public deployment verification is recorded in [DEPLOYMENT.md](DEPLOYMENT.md).
The earlier local receipt below remains the baseline. Latest deployment changes:
162 backend tests passed, 3 optional local Tencent checks skipped, 12 Node gateway
tests passed. Eleven public API groups and desktop/mobile browser flows passed;
public raster OCR and a real stop/resume persistence check also passed.

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
