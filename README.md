# WeWise · 微晓

China insurance assistant for the hackathon: understand a policy, prepare a claim,
and keep the customer in control. React/Vite frontend with a FastAPI backend.

**Team test link:** https://wewise-retrieval-preview.vercel.app/me . Start a
private synthetic demo; no shared password or Vercel login is required.
The updated preview supports server-side Claude with checked source extracts and
retrieval fallback. JEV remains disabled after its supplied key failed authentication.
See [live provider boundaries](docs/LIVE_PROVIDER_SETUP.md) and [deployment notes](DEPLOYMENT.md).

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
  buying/renewal calculators, saved conversations and 34 bounded tool adapters.
  The inspector displays actual streamed execution and source evidence.
- WorkBuddy Token Hub/Claude/Qwen-compatible adapters are ready. A real model
  key and exact model ID are still needed for live generation.
- Insurer receipts/timelines and agent callbacks are explicitly simulated.
  The real case stays prepared and not submitted.

Use synthetic personal data only. The project is WeBank-inspired; it is not an
official bank product or proof of any insurer sales/integration relationship.

## Teammate walkthrough

1. Open `/me` and create a private synthetic demo workspace.
2. Open the seeded policy, review its original schedule and confirm the key facts.
3. In Claims, save a synthetic Japan outpatient incident. The tracker shows the
   current preparation stage, responsible party, missing documents and next step.
4. Open **Simulated insurer flow → Play the separate synthetic story** to test
   receipt, review, additional documents, delay, decision and appeal without
   uploading a complete claim. This never changes actual insurer status.
5. Ask a policy question and open **Inspect execution** for actual steps and
   original-page evidence. Explore cover, report review and the document vault
   through the sidebar or Me on mobile.
