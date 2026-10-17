# WeWise teammate preview

Test: **https://wewise-retrieval-preview.vercel.app/me**

Click the private synthetic demo button. Each tester gets a separately owned
synthetic policy schedule plus the published wording. No shared password or
Vercel account is needed. Confirm the policy's extracted facts before asking for
personalized guidance. Use only synthetic personal, medical and financial data.

The hosted build enforces `WEWISE_RETRIEVAL_ONLY=1`: chat uses real source
retrieval; it cannot call a model even if an ambient API key exists. Translation
retains original text with a visible label. WorkBuddy credentials can be added in
a later, explicitly configured deployment. JEV remains disconnected.

## Hosting and limits

- Vercel serves the built frontend and an OIDC-authenticated API gateway.
- The gateway uses an existing named persistent Sandbox containing FastAPI,
  SQLite, saved files and CPU OCR. It never creates arbitrary new workspaces or
  runs commands supplied by customers.
- The backend automatically resumes after a stopped session and restarts its
  service under a process lock. The first API request after a pause can take a
  few seconds. A stopped-session snapshot keeps data across resumes.
- Snapshot retention is seven days after last use, with only the latest kept.
  This is a temporary hackathon preview, not production backup/retention proof.
- Public requests are capped at **4 MB including multipart form data**. Use small
  test PDFs/images. Local-only runs retain the original larger upload allowance.
- Demo sessions expire after 12 hours or sign-out. Signing out of an anonymous
  demo ends access to that demo; the next demo is a new private workspace.
- Memory CRUD uses the private approved SQLite ledger here. The optional Tencent
  service verified locally is not connected to this hosted preview. No automatic
  chat/medical-report capture occurs.
- Insurer receipts, processing timelines and agent callbacks remain simulated.
  The app cannot submit to an insurer, contact an agent, issue cover or pay money.

## Verified on the actual public URL

- Built assets and deep routes; no Vercel login wall.
- Forced retrieval, secure HttpOnly SameSite cookies, exact-origin write guards.
- Separate testers denied access to each other's policies, files, claims/exports.
- Actual source/page citations after policy-fact confirmation.
- Real draft PDF/ZIP downloads, one-use export token and isolated simulator.
- Desktop and 390px mobile browser flow, no relevant console warnings/errors.
- Public synthetic raster upload processed with RapidOCR, not a seeded text answer.
- A real hosted stop/snapshot/resume preserved a test session, approved memory
  and the exact uploaded image bytes. The test document/memory were then deleted.

Latest checks: **162 backend passed, 3 optional local Tencent checks skipped**;
**12 gateway tests passed**; **11 public API smoke groups passed**; production
build passed. Provider credentials/calls and device microphone/camera permission
flows were not tested. Public screenshots are in `docs/qa/public-*`.

## Operator reference

Vercel project: `wewise-retrieval-preview`,
`prj_GoRHgw5cWYIxfUyezkvtMSC0x0Nc` in team
`team_cwo7Qhim3NHIsrsySpEQXfXn`.

Verified deployment: `dpl_3GXqRZwQdv7DNrc2yZBFz19L9u6U`, source
`d390a4fd4f5c1b3dc1b7837f0acde64dcb9cce97`, branch
`codex/live-hackathon-assistant`, PR https://github.com/pennythewise/WeWise/pull/1 .
Later documentation/test-script commits do not change the deployed runtime.

Named backend: `wewise-preview` in `sin1`; code `/vercel/WeWise`, private data
`/vercel/wewise-data`. `deploy/ensure_backend.py` starts only the fixed installed
retrieval service, with secure cookies, seeded shared accounts disabled and
private synthetic demo workspaces enabled. No model key is deployed.

Repeat the public smoke:

```powershell
.\.venv\Scripts\python.exe scripts/verify-deployed.py https://wewise-retrieval-preview.vercel.app
node --test tests/gateway.test.mjs
```

Keep source, runtime and snapshots separate when updating. To update the backend,
fetch and check out a reviewed exact commit in its hosted directory, restart the
service and verify retrieval/isolation before releasing its matching frontend.
Do not delete the named Sandbox as a routine restart: the gateway intentionally
refuses to create a replacement with an empty database.
