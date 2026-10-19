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
pnpm install
pnpm dev        # http://localhost:5173, proxies /api to the backend on :8017
pnpm build      # type-check + production build
```

Evidence: `.venv/bin/python eval/run.py` runs the golden-task and attack corpora and rewrites `eval/report.md`.

## Layout

| Path | Contents |
|------|----------|
| `src/app` | App entry, router, responsive shell (`AppShell`) |
| `src/layout` | Phone frame, header, tab bar, side navigation, inspector pane |
| `src/features` | Screens by area: home, policies, claims, chat, cards, capture, showcase (3D), settings, stage |
| `src/engine` | Agent clients: scripted mock (scenarios S1–S7) and `HttpAgentClient` for the backend |
| `backend/` | FastAPI service: auth, documents/OCR, retrieval, agent planner and tools, claims, buying |
| `eval/`, `tests/` | Golden-task and attack corpora, evidence report, gateway tests |
| `api/`, `server/`, `deploy/` | Serverless gateway and deployment helpers |
| `src/mock` | Synthetic policies, claims, clauses, insurers, 3D assets |
| `src/i18n` | English / Chinese strings |
| `public/models` | 3D models (credits in the About screen) |
| `01_PRD.md`, `02_TECH_SPEC.md`, `03_FRONTEND_PRD.md` | Product and frontend specs |

`tobe_deleted/` holds the retired live-app UI, pending removal.
