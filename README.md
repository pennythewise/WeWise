# WeWise · 微晓

China insurance assistant for the hackathon: understand a policy, prepare a claim,
and keep the customer in control. React/Vite frontend with a FastAPI backend.

**Current implementation:** [team setup and API configuration](IMPLEMENTATION.md)
and [feature boundaries](FEATURE_STATUS.md). Earlier PRD/spec files describe the
original scripted prototype; the current China-only scope and these documents
take precedence where they differ.

- Default application connects to the actual backend. It does not silently fall
  back to mock customer data or scripted AI responses.
- Original guided frontend: `/?mode=simulator`, visibly labelled throughout.
- Saved PDF/image extraction, CPU OCR, private cited retrieval, review gates,
  claim PDF/ZIP export and approved memory are implemented.
- WorkBuddy Token Hub/Claude/Qwen-compatible adapters are ready. A real model
  key and exact model ID are still needed for live generation.
- Insurer receipts/timelines and agent callbacks are explicitly simulated.
  The real case stays prepared and not submitted.

Use synthetic personal data only. The project is WeBank-inspired; it is not an
official bank product or proof of any insurer sales/integration relationship.
