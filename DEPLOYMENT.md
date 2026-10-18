# Provider update — 18 October 2026

The updated preview enables native Claude using private server settings, source
verification and a persistent daily request cap. JEV stays disabled after an
authentication failure. [Current provider setup](docs/LIVE_PROVIDER_SETUP.md)
supersedes retrieval-only claims in the historical deployment record below.

# WeWise teammate preview

Test: **https://wewise-retrieval-preview.vercel.app/me**

Click the private synthetic demo button. Each tester gets a separately owned
synthetic policy schedule plus the published wording. No shared password or
Vercel account is needed. Confirm the policy's extracted facts before asking for
personalized guidance. Use only synthetic personal, medical and financial data.

The updated hosted build loads private operator settings for Claude and keeps
source retrieval as fallback. `WEWISE_RETRIEVAL_ONLY=1` can disable all paid calls.
Translations require explicit external-processing consent and user review.
WorkBuddy can be configured later. JEV remains disconnected after authentication
failed. The current runtime uses pinned local multilingual E5
embeddings fused with BM25 and a private Tencent MemoryCore mirror of approved
preferences; no remote embedding/model service receives queries in this mode.

## Verified complete-scope runtime

Runtime `e318e7e6b823e160362e5f6631dee8fad233c3c8` is deployed as
`dpl_52H4xDs9CYHBshWEcxJCQfPQtz5z`, with frontend `index-BU7hyZzQ.js` and
backend 0.3.0. GitHub CI, 16 baseline public API groups and 12 expanded public API groups
passed. The [expanded receipt](docs/qa/expanded-public-api.json) verifies actual
semantic retrieval, Tencent approved-preference reuse/deletion, private source
ownership, PDF/ZIP bytes and isolated insurer transitions. Later UI copy/brand
refinements need separate asset readback; see [verification](VERIFICATION.md).

Private memory and semantic asset installation/resume instructions are in
[deploy/LOCAL_RETRIEVAL_SERVICES.md](deploy/LOCAL_RETRIEVAL_SERVICES.md).

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

Latest feature audit: **200 backend passed, 3 optional local Tencent checks
skipped**; **12 gateway tests passed**; **16 public API smoke groups passed**;
production build passed. The same backend/gateway/build checks passed on Ubuntu
in [GitHub CI](https://github.com/pennythewise/WeWise/actions/runs/39034878560)
for the exact runtime commit below. The duplicate push event was cancelled by
concurrency; the PR-event test/build steps succeeded.

The public smoke additionally verifies Chinese sales-pattern screening,
unconfirmed-policy gap handling, conditional incident evidence, persisted export
downloads and uploaded acknowledgement provenance with owner-scoped originals.
It verifies real PDF/ZIP bytes, not merely download-button presence.
Provider credentials/calls and device microphone/camera permission flows were
not tested. Existing public screenshots are in `docs/qa/public-*`.

Final rendered recheck passed on desktop and 360/390px mobile: actionable chat
cards/citations, policy-family correction, conditional evidence, saved exports,
source-linked assistance notice, acknowledgement provenance and mobile tools.
Long generated emails wrap without horizontal overflow. The guided simulator
keeps its mode through navigation/reload and has a visible bilingual disclosure
with a working native return link. Unknown legacy destinations show no inferred
phone number or universal notification deadline.

## Operator reference

Vercel project: `wewise-retrieval-preview`,
`prj_GoRHgw5cWYIxfUyezkvtMSC0x0Nc` in team
`team_cwo7Qhim3NHIsrsySpEQXfXn`.

Verified deployment: `dpl_BQ2jLeZCWmLnYusbqSLZhJxhx8hB`, source
`90b81cf2e26266b26473c66a2c0f93165e9c2c3b`, branch
`codex/live-hackathon-assistant`, PR https://github.com/pennythewise/WeWise/pull/1 .
Later documentation commits do not change the deployed runtime. The hosted
backend is checked out at the same exact source commit; its existing private
data directory was preserved during the verified service restart.

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
