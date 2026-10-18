# Live provider activation — 18 October 2026

This supersedes the older retrieval-only deployment description for the updated
preview. Existing retrieval-only QA receipts retain their original scope.

## Provider boundaries

- **Claude:** native Anthropic API, explicit model `claude-sonnet-4-6`, selected
  from this account's Models API. A direct synthetic Messages request succeeded.
  A local authenticated synthetic policy-chat test also passed original-page
  readback and returned `claude_api`; a less-specific question abstained and
  retained retrieved evidence. The app uses Claude to select source extracts, not to decide insurance coverage
  or authorize tools. App grounding success is separate from a successful API call.
- **JEV:** the supplied credential returned HTTP 401 from the documented TypeSafe
  endpoint. It is **disabled** in the deployed environment. Rule routing remains
  active; no JEV decision or connection is claimed. A replacement valid TypeSafe
  key is required before activation.
- WorkBuddy/Qwen adapters remain available for a later deliberate migration.
- Insurer submissions/status feeds, bank SSO, phone transfer and real callbacks
  remain disconnected. Receipts, insurer timelines and callbacks remain labelled
  simulations.

## Private configuration

Local development uses ignored `.env` variables from `.env.example`. Production
uses the operator-owned `/vercel/wewise-data/providers.json` (mode 0600), outside
the Git checkout and frontend build. The fixed resume helper validates an
allowlist and enables only the official native Claude origin. Invalid/missing
configuration selects retrieval-only mode. No public route writes this file.
Changing configuration restarts only the app's verified uvicorn process under
the startup lock. The Tencent sidecar receives no Claude, JEV or compatible-model
credentials. Keys are never included in browser bundles, gateway request inputs,
health responses, inspector traces or Git. The one-time deployment transfer used
Node's standard RSA-OAEP/AES-GCM primitives; only sealed ciphertext crossed the
command transport, and its private transfer key was removed after installation.

Global durable SQLite request ceilings default to **200 Claude attempts/day**
and **400 JEV attempts/day**, resetting on the UTC date. Failed attempts consume
the budget. Account creation cannot bypass the app-wide ceiling. Setting a limit
to zero disables paid calls; invalid values and storage errors fail closed.
These are request ceilings, not a provider billing guarantee or a rate-limit SLA.

## Answer checks and privacy

Only the authenticated user's retrieved passages are eligible. Known personal
identifiers are masked before external processing; masking is fallible, and the
preview remains for **synthetic data only**. It is not a mainland China production
data-processing or compliance deployment. No remote embedding service is used.
Assistance translations require the existing explicit processing consent and
remain user-reviewed drafts; they are not certified or emergency communications.

Claude returns only numbered excerpt IDs. The application materializes their
original text; mixed/freeform, duplicate, unknown or oversized selections fail
closed, and an empty selection is an explicit abstention.
Every policy-answer assertion must match an original source extract and its
current owner/document/page. Numeric, instruction, authority, citation and
concurrent-revision checks remain active. Exact PDF line-wrap restoration can
use only an exact source quote, never a semantic paraphrase. Unsupported text,
truncation, refusal, quota exhaustion and provider failures fall back to clearly
labelled retrieved extracts. The current-source checks do not prove that the
policy is complete, OCR is accurate, the excerpt is sufficient or a claim is payable.

`ai.configured` means settings exist. `ai.live_verified` means this process has
received a successful HTTPS reply containing a parsed JSON object for the current
key/model/endpoint; it resets on restart. Each chat response separately reports
`claude_api` only after source checks pass, or `retrieval_only` for fallback.
JEV's `configured` and `verified_live` have the same distinction; confidence is
an advisory project gate, not a measured accuracy score.

## References

- [Anthropic Models API](https://platform.claude.com/docs/en/api/models/list)
- [Anthropic Messages](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)
- [Anthropic API versioning](https://platform.claude.com/docs/en/api/versioning)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [TypeSafe Choice confidence](https://docs.typesafe.ai/confidence)
