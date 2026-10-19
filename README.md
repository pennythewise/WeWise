# WeWise · 微晓

China insurance assistant concept (hackathon): understand a policy, compare cover,
prepare a claim, and keep the customer in control.

This repository is a **front-end-only guided simulator**. Every conversation,
claim outcome and policy is scripted synthetic data; nothing is sent to a server
and nothing represents a real insurer, product or customer.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # type-check + production build
```

## Layout

| Path | Contents |
|------|----------|
| `src/app` | App entry, router, responsive shell (`AppShell`) |
| `src/layout` | Phone frame, header, tab bar, side navigation, inspector pane |
| `src/features` | Screens by area: home, policies, claims, chat, cards, capture, showcase (3D), settings, stage |
| `src/engine` | Scripted agent client, scenarios (S1–S7) and attack scenarios |
| `src/mock` | Synthetic policies, claims, clauses, insurers, 3D assets |
| `src/i18n` | English / Chinese strings |
| `public/models` | 3D models (credits in the About screen) |
| `01_PRD.md`, `02_TECH_SPEC.md`, `03_FRONTEND_PRD.md` | Product and frontend specs |

`tobe_deleted/` holds the retired live app, backend and tooling, pending removal.
