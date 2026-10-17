# WeWise · 微晓

China insurance assistant for the hackathon: understand a policy, prepare a claim,
and keep the customer in control. React/Vite frontend with a FastAPI backend.

**Team test link:** https://wewise-retrieval-preview.vercel.app/me . Start a
private synthetic demo; no shared password or Vercel login is required.
The public preview enforces retrieval-only mode. See [deployment notes](DEPLOYMENT.md).

**Current implementation:** [team setup and API configuration](IMPLEMENTATION.md)
and [the complete requirement register](docs/REQUIREMENTS_STATUS.md).
The executable task/attack evidence is in [eval/report.md](eval/report.md). Earlier PRD/spec files describe the
original scripted prototype; the current China-only scope and these documents
take precedence where they differ.

- Default application connects to the actual backend. It does not silently fall
  back to mock customer data or scripted AI responses.
- Original guided frontend: `/?mode=simulator`, visibly labelled throughout.
- Saved/temporary PDF/image extraction, CPU OCR, private hybrid retrieval,
  source/report review, claim PDF/ZIP exports and approved memory are implemented.
- The API-backed app includes a connected claim tracker, separate insurer simulator,
  buying/renewal calculators, saved conversations and34 bounded tool adapters.
  The inspector displays actual streamed execution and source evidence.
- WorkBuddy Token Hub/Claude/Qwen-compatible adapters are ready. A real model
  key and exact model ID are still needed for live generation.
- Insurer receipts/timelines and agent callbacks are explicitly simulated.
  The real case stays prepared and not submitted.

Use synthetic personal data only. The project is WeBank-inspired; it is not an
official bank product or proof of any insurer sales/integration relationship.
