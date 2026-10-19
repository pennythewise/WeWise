# WeWise · 微晓

China insurance assistant concept (hackathon): understand a policy, compare cover,
prepare a claim, and keep the customer in control.

The phone UI is the guided simulator. Preset scenarios (S1–S7 in the side list) always run on scripted data.
Messages typed in the chat go to the **FastAPI backend** (private synthetic workspace, deterministic planner with
34 guarded tools, quoted-source retrieval, claim packages, streamed inspector) whenever it is reachable, and fall back
to the scripted client when it is not. The **Live backend / Scripted** button in the stage controls shows which is in use.
Nothing here is a real insurer, product or customer.

## Run

```bash
# backend (Python 3.11)
python3.11 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
WEWISE_RETRIEVAL_ONLY=1 WEWISE_SEED_DEMO=1 .venv/bin/python -m uvicorn backend.app.main:app --port 8017

# frontend
cd frontend
pnpm install
pnpm dev        # http://localhost:5173, proxies /api to the backend on :8017
pnpm build      # type-check + production build
```

Evidence: `.venv/bin/python backend/eval/run.py` runs the golden-task and attack corpora and rewrites `backend/eval/report.md`.

## Layout

| Path | Contents |
|------|----------|
| `frontend/` | React + Vite app. `src/`: `app` shell and router, `layout` phone frame, `features` screens, `engine` agent clients and scenarios (S1–S7), `mock` synthetic data, `i18n`. `public/models/`: 3D models (credits in the About screen) |
| `backend/` | FastAPI service (`app/`), its tests (`tests/`) and the evidence suite (`eval/`) |
| `api/` | Vercel serverless entry (must stay at the root, with the root `package.json`) |
| `infra/` | `server/` sandbox gateway, `deploy/` runtime helpers, `scripts/` tooling, `tests/` gateway tests |
| `docs/` | PRD, tech spec and frontend PRD |

Tests: `.venv/bin/python -m pytest -q -c backend/pytest.ini` · `node --test infra/tests/gateway.test.mjs`
