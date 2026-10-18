# Provider update — 18 October 2026

The updated preview enables server-side Claude and checked original-source
extracts. JEV remains disabled because the supplied key failed authentication.
Older key-deferred/retrieval-only notes below are historical for the earlier
release; see [current boundaries](LIVE_PROVIDER_SETUP.md). All insurer and human
callback simulation boundaries remain in force.

# WeWise requirement traceability and acceptance boundaries

This register replaces an overly broad interpretation of the earlier test receipt.
Passing a test suite establishes those assertions; it does not establish that
every product requirement, external integration or competition target is complete.
Read the final execution receipts in `VERIFICATION.md` and `DEPLOYMENT.md` alongside
this feature register. Source implementation and public deployment are separate.

## Accepted scope and authority

- The product serves individual consumers with mainland China insurance policies,
  in a WeBank-inspired shell. Japan accidental outpatient treatment is the deeply
  reviewed example; other insurance families have supporting reference workflows.
- The accepted practical claim outcome is a reviewed package and official-channel
  handoff. It is **PREPARED_NOT_SUBMITTED**, not insurer acceptance or approval.
- Insurer receipts, processing stages, decisions, payments and agent callbacks
  remain explicitly simulated. No real insurer, agent or emergency service is sent
  documents by these features. A customer-uploaded acknowledgement is unverified.
- The user requested retrieval mode first and will provide WorkBuddy credentials
  later. Deterministic orchestration is real code, not a pretended model call.
- Avatar-led interaction, primary 3D navigation, family/delegated accounts, a real
  phone number/transfer, actual sales and commissions are later work. Optional
  visualisation and guided camera capture do not prove those integrations.

The original feature IDs and acceptance criteria remain in `01_PRD.md` sections
4-5, `02_TECH_SPEC.md`, and `03_FRONTEND_PRD.md`. The newer China/Japan decisions
supersede Malaysia, BM/MYR examples and Thailand as the primary demo. The decision
index is `../research/insurance-product-decisions-2026-10-17.json`; its old
"confirmation pending" fields are historical and do not override the user's
subsequent confirmation and explicit implementation request.

## Feature register

**Working** means executable source with the stated limits. It is not a claim
that an adapter is live or that all original acceptance targets are measured.
The public runtime configuration must be checked independently after deployment.

| ID | Working implementation / location | Boundary or remaining dependency |
|---|---|---|
| Agent core | `backend/app/agent_foundation.py`: persisted conversations, structured bounded plans, dependencies, centralized tool gate, correction/resume, actual streamed events and trace readback; `/tools` exposes **34** registered adapters with schemas/required arguments; `/agent/tools/invoke` permits authenticated allowlisted reads | Deterministic plans, not autonomous LLM planning. Maximum call/time limits apply. No tool moves money or delivers to insurers. The REST tool adapter is not an MCP transport. Tool count alone is not task coverage. |
| A1 | `documents.py`, `document_analysis.py`, `PolicyUploader.tsx`, `PolicyInsights.tsx`: real PDF/image/TXT extraction, local OCR, source-page contract candidates, field/term correction and confirmation | Rules are fallible candidate extraction. Confidence is unmeasured/null. Optional isolated model extraction needs the deferred API and still requires source verification/review. |
| A2 | `intelligence.py`: scoped retrieval, original citations, source checks and uncertainty; `ChatWorkspace.tsx` source navigation | Public retrieval mode uses source extracts. Model explanation requires the deferred API. No entitlement or payout guarantee. |
| A3 | `document_analysis.py` coverage matrix and `PortfolioOverview.tsx`: area-level source observations from current confirmed policies | Relevant passages do not prove selected benefits apply. Missing evidence does not prove the person is uninsured. |
| A4 | Source-preserving summary endpoint and language selection; Chinese primary interface, English/Japanese assistance cards | Policy originals are retained. Source templates are not full translations. Model translation is key-deferred and requires review; no certified translation is claimed. BM is outside the newer China scope. |
| B1 | `Needs`, `/buying/compare`, `/buying/needs`, approved `/needs/defaults`, `BuyingJourney.tsx`: goal, budget, dependants, risk tolerance, age/job/travel/existing cover; saved form load/delete | Reusing approved preferences is explicit. Saved form defaults are separate from approved long-term memory. Missing terms and budget units must be reviewed. |
| B2 | `insurance_features.py`: side-by-side criteria, source-based product arguments, deterministic judge, tied shortlist and code cost examples | Advocate/judge sections are disclosed rules, not parallel model calls. The limited catalogue has no live premiums or personal selected limits. Unknown inputs stay unknown; a worked example uses separately user-reviewed hypothetical terms. |
| B3 | Synthetic agent matching by language/location/rating/SLA/load, exact brief preview, consent and downloadable PDF | Directory and SLA values are synthetic; callback is simulated. No live lead, actual licence or partner relationship is established. |
| B4 | Date-derived reminders, owned manual premium history, corrections/hike arithmetic, existing-versus-proposed review | Historical entries are user-reviewed, not insurer-verified. No auto-renewal, cancellation, price prediction or coverage extension. |
| B5 | English/Chinese phrase checks plus paid-premium/cash-value loss and replacement-premium arithmetic | Pattern screening is not full suitability/compliance detection. Cash-value inputs are user-reviewed. Cooling-off/free-look rights must come from the actual contract; no universal period is invented. |
| C1 | `/incidents`, `insurance_features.py`, `IncidentLibrary.tsx`: nine China insurance families, benefit-specific examples, purchase/claim references and conditional documents | Broad templates are supporting educational workflows, not nine exact insurer integrations. Reporting instructions and formats depend on the issued contract/channel. |
| C2 | `workflows.py`: current policy, dates, territory, selected-benefit source, reviewed waiting-period arithmetic, exclusions and expense facts | Deeply reviewed preparation path is Allianz 2023/Japan outpatient. Reviewed numbers require an owned exact page quote; unknown applicability stays unresolved. No automatic claim rejection or payout amount. |
| C3 | Conditional evidence, original files, OCR/review, role/prior-payment/minor/disability/death branches, name/date/amount consistency checks | Exact reviewed path can create a prepared package. Other products/benefits remain labelled drafts until insurer-specific rules are reviewed. |
| C4 | Version-bound preview, single-use expiring confirmation, real PDF/ZIP and official handoff | No actual insurer submission. The separate confirmed simulator submit is idempotent and issues an explicitly synthetic receipt. |
| C5 | `claims_tracker.py`, `ClaimTracker.tsx`: Grab-style connected stages, actor, timestamp, next action, durable notifications/read acknowledgements, delay explanation and synthetic decline/appeal | Actual preparation and simulated insurer FSM are separate tracks. Simulated clock pauses for requested information; allowed transitions are enforced. An actual wording quote is labelled separately from the synthetic letter. No live insurer status feed. |
| C6 | Reviewed Japan contacts/communication cards, original narrative, reviewed English summary and real assistance PDF/ZIP | No provider contact, receipt, dispatch or certified translation. Other countries do not inherit Japan's contacts/deadlines. |
| C7 | Guest urgent help, compassionate rule conversation, text transcript and device-supported voice input/playback; official human contacts | This is an in-app assistant, not a phone call centre. Adaptive model drafts are key-deferred. Physical microphone behavior depends on the browser/device and permission. |
| C8 | `GuidedCapture.tsx`: safety checklist, photo preview, multiple evidence attachments and correction path | Guided evidence capture, not AR damage measurement, valuation or medical vision. Physical camera permission must be checked on the team's device. |
| D1 | Private policy cards/coverage overview, clickable details, active claim tasks, renewals | Limits are not asset values or additive guaranteed payouts. Real insurer labels do not establish a bank/insurer partnership. |
| D2 | Source-based area observations and possible same-area overlaps across confirmed/current policies | No actuarial duplicate-reimbursement conclusion; excluded/conditional/selected benefits still require full review. |
| D3 | Optional clickable procedural 3D illustration | Illustration only, not required primary navigation or a policy-linked valuation. |
| E1 | Server identity/ownership, strict payloads, bounded registry, plan/role/dependency checks, per-action confirmation | LLM/JEV text never supplies authority. Real bank identity and insurer capabilities are absent. |
| E2 | HttpOnly secure sessions, per-user source/files/records, minimized model inputs, metadata-only audit and private vault | Synthetic testing only. Production encryption/key operations, regional processing, retention and backup erasure require separate evidence. |
| E3 | Quarantine of instruction-like source chunks, isolated model extraction, data/prompt separation and intent-bound tool allowlist | Heuristics and tests reduce specific attacks; they are not proof against every novel prompt injection. |
| E4 | Current-source quotes/citations, numeric/source assertions, guarantee checks, refusal and extractive fallback | No zero-hallucination claim or complete semantic-entailment proof. Human/insurer review remains necessary. |
| E5 | Exact recipient/payload snapshot, explicit consent, expiry/replay protection, stale-revision invalidation, reviewed chat export confirmation | Confirmation cannot originate from a document. No insurer submission, payout-account changes or money movement. Voice input is F5; the uploaded team table reused E5 for it. |
| E6 | Direct official human channels, unknown/low-evidence fallbacks, reviewable context/brief and synthetic directory | Actual provider transfer, human service ticket, SLA or callback is not connected. |
| E7 | Audit/access events, approved memory controls, private vault, stored exports, consent entries and temporary-document lifecycle | Temporary access ends at 24h; current-store purge runs on access/cleanup/startup. This is not proof of exact-time physical deletion or historical-snapshot erasure. |
| F1 | Main API-backed chat with chips, policy/gap/claim/buying navigation/cards, citations and frozen review cards | Rich cards derive from actual API results; old canned walkthrough remains a separately labelled mode. |
| F2 | Persisted conversation state, policy/claim clarification, correction/replanning, graceful failures/out-of-scope routes | Rule-based intent/correction coverage is bounded; an arbitrary colloquial sentence is not guaranteed understood. |
| F3 | Live Understand → Plan → Execute → Verify → Respond inspector, tools, safety, evidence and trace export | Actual events only. Replay/history is labelled; no invented timings, confidence, JEV decisions or model calls. |
| F4 | Approved memory CRUD, disable/readback, explicit reuse for communication and needs; optional Tencent private projection | Public health must establish whether Tencent is actually hosted. Local adapter/integration tests are not a hosted Tencent service receipt. Deleted facts cannot be restored from stale remote recall. |
| F5 | Browser speech feature detection, stop controls and text fallback | Browser vendors may process audio. Physical microphone/browser support is a separate device check. |

Additional requested features are included through factual medical/financial
report extraction/review (`document_analysis.py`, `WorkspaceTools.tsx`), an
optional advisory TypeSafe/JEV adapter (`jev_adapter.py`), local hybrid semantic
retrieval with lexical fallback (`semantic_retrieval.py`) and temporary originals
kept outside retrieval until explicitly saved (`lifecycle.py`). JEV decisions
and model responses cannot authorize actions. Missing service credentials/assets
must be visible rather than replaced with invented service output.

## Acceptance evidence and gaps

| Acceptance group | Evidence / interpretation |
|---|---|
| US-01/02/03/09/14 | `test_document_foundation.py`, `test_core.py`, `test_guards.py`, `test_acceptance_edges.py`, source-page UI and scoped retrieval checks. Extraction/coverage observations are bounded candidates, not general accuracy benchmarks. |
| US-04/05/06 | `test_scope_workflows.py` and approved-needs tests: complete needs payload, tied source arguments, exact arithmetic, unknown terms, synthetic agent matching and explicit brief consent. No real quote/lead delivery. |
| US-07/08/10/11/13 | `test_workflows.py`, `test_scope_workflows.py`, `test_release_workflow_edges.py`: actual files, conditional checklists, source-based selected benefit/waiting checks, reviewed exports, strict isolated FSM, notifications, delay/decline/appeal and Japan kit. |
| US-12/21 | Portfolio and approved-memory tests/readback. Tencent optional integration results must be reported separately from default skipped tests. |
| US-15/16/17/18/19/20 | Ownership/attack suites and `test_agent_foundation.py`: denial, tool role/intent/dependency checks, stored conversation revision, correction/resume, safe fallback and known language cases. This does not prove universal language understanding. |
| Targeted workflow repair receipt | New scope workflow suite: **30 passed**, including private demo bootstrap and browser-style benefit confirmation; earlier combined workflow/release run: **90 passed** before the final UI/source-preservation refinements. Do not add these overlapping counts. Final combined/CI/public receipts belong in `VERIFICATION.md`. |
| UI build | TypeScript passed after the assigned tracker/form/incident/retention refinements. Rendered desktop/mobile checks and deployment confirmation are separate release receipts. |
| Local measured agent sample | `scripts/measure-agent.py` ran 12 actual HTTP/NDJSON turns, including ambiguous policy selection, resume and two corrections: 12/12 acceptance checks and requested goals, 12/12 valid plans, 18 planned tool calls and 12/12 exact original-page citation checks. Receipt: `docs/qa/agent-measurements-local.json`. First event p50/p95 **17.50/19.39 ms**; final result p50/p95 **86.69/5285.13 ms**. This is a selected local sample with actual local embedding work, not a statistical SLA, generated-token timing, or end-to-end insurer task-success rate. External generation calls are zero under enforced retrieval mode; tokens/cost are unmeasured/null. Disposable conversations, claim and policy originals were removed and the test session signed out. |

## Scoring targets that require measurements

- T-1/T-2: final-state task success and first-attempt tool validity need a named
  scenario report with plan/tool traces. Registry size or pytest count is not the
  percentage denominator.
- T-3: report adversarial cases/classes and exact forbidden-action/data checks;
  passing them is bounded evidence, not a universal security guarantee.
- T-4: report checked assertions/citations and abstentions. Numeric overlap or
  quote presence alone does not prove the meaning of every generated sentence.
- T-5/T-6: turn efficiency, first streamed event and full response timing need
  measured scenarios. A first event is not a generated first token. A small local
  sample is not a production SLA or a statistical latency benchmark.
- T-7: each current sensitive action needs exact confirmation/stale/replay tests.
  Real insurer actions are absent, rather than silently treated as confirmed.

The organiser harness/MCP transport requirement, submission technical PDF, pitch deck,
recorded video, organiser communication and production/regulatory readiness are
separate delivery items. The app source, a preview URL and local tests do not
establish that those items were submitted or accepted.
