# Implementation boundaries

Public retrieval-only preview: https://wewise-retrieval-preview.vercel.app/me .
Each tester starts a separate synthetic workspace. This register describes the code, not production acceptance. See the verification
receipt for executed checks. Mainland China only; Japan is the primary overseas
incident example. API credentials are supplied later by the team.

| Scope | Implemented behavior | Boundary |
|---|---|---|
| Agent core / F1 | API-backed chat, deterministic intent routes, cards, source links and actual trace | Model generation requires a key/model; no JEV service connected |
| A1 | Saved PDF/image/TXT extraction with page provenance; actual RapidOCR CPU scans; editable facts | OCR can fail and needs confirmation; saved uploads only |
| A2 / A4 | Policy questions, original-source evidence, CN/EN UI and conditional model explanations | Retrieval mode is labelled; model translations need API and review |
| A3 / D2 | Portfolio observations, same-family overlap and cover not demonstrated by confirmed documents | No claim that missing evidence proves uninsured status; no independent actuarial analysis |
| D1 / D3 | Private policy portfolio and optional clickable 3D visualization | Insurance limits are not asset values; 3D is illustrative |
| Buying B1/B2 | Needs/budget capture and feature comparison of three official published travel-wording references | No invented premiums, selected limits, availability or whole-market best |
| B3 / B5 | Reviewed PDF agent brief; source-bound tradeoffs and deterministic mis-selling phrase flags | No real lead delivery; agent callback is simulated |
| B4 | Date-derived renewal reminders and needs reconfirmation | No policy transaction or automatic extension |
| C1/C2 | Japan outpatient incident guide, role/fact capture, conditional wording precheck | Preparation support, no claim eligibility/payout decision |
| C3/C4 | Conditional documents, actual evidence files/type review, generated reviewed form, snapshot-bound PDF/ZIP | Draft exports show missing evidence; prepared export is not submission |
| C5 | User-reported/acknowledgement-uploaded updates with provenance | Insurer receipt/review/decision/payment timeline lives in separate simulator |
| C6 | Japan contacts/forms and reviewed cross-border assistance package | No provider contact or certified translation implied |
| C7 | Guest urgent help, direct human/emergency links, browser speech playback/input, reviewable assistance draft | No PSTN AI phone number, conversational call centre or live transfer |
| C8 | Camera evidence capture with permission and upload | Guided capture only; no AR damage measurement/valuation |
| E1 / E5 confirmation | Ownership checks and expiring, single-use confirmations tied to exact snapshots | AI text cannot authorize or execute insurer actions |
| E2 / E3 | HttpOnly sessions, scoped data/retrieval/files, redaction, quarantine and prompt/data separation | Synthetic local demo; no production security/compliance certification |
| E4 | Known citations, current source/revision, numbers and guarantee checks; abstention/extractive fallback | Does not prove full semantic entailment or zero hallucination |
| E5 voice input | Browser voice feature detection, stop and text fallback | Requires device support/permission; browser speech provider may process audio |
| E6 | Direct official human channels accessible before AI help | No external message/call sent by the app |
| E7 / F4 | Audit metadata and opt-in approved-memory view/edit/delete; actual private Tencent sidecar projection | No automatic health/chat memory; upstream history purge not claimed |
| F2 / F3 | Clarification, unsupported/out-of-scope replies and actual inspector events | No invented model call, elapsed time or JEV confidence |
| Evidence | Functional and attack tests, actual local Tencent tests, UI flow checks | Provider protocol stubs are not live-model tests |
| Delivery | Public retrieval-only full-stack preview, reproducible dependencies, runbook and reviewable source branch | Organiser email, new pitch deck and recorded demo video are not completed by this change |

The plan used E5 for both voice and sensitive confirmation; those are identified
explicitly above to avoid conflating the two features.

## Safety self-assessment

The app controls access and confirmations in application code. Model output has
no tools or credentials and cannot submit a claim, contact an agent, transfer a
call, move money, underwrite, issue cover or decide a payout. Preparation and
insurer simulation remain separate states. Customer documents are stored in an
ignored local directory and are not bundled into the public frontend.

Deletion removes current originals, retrieval derivatives and affected local
packages; it revokes stale action snapshots. Downloaded copies are outside the
app's control. Tencent's current mirror is replaced and rechecked against the
approval ledger, including concurrent edits/deletes. Upstream version-history
and backup erasure need additional work before processing real personal data.

Known limits: no live model credential/entitlement test, no JEV service, no bank
SSO or insurer API, no production encryption/key management or regulated sales
operation, no certified translation. The hackathon must use synthetic identities
and medical/financial evidence. Medical-report extraction does not diagnose a
condition; budget comparisons are not general financial advice.

## Demo sequence

1. Guest urgent help: safety and direct human contacts remain accessible.
2. Login, open real wording + synthetic schedule, correct and confirm facts.
3. Ask a policy question, open its exact source page and actual trace.
4. Create the incident; upload and confirm synthetic evidence.
5. Show missing-item/draft boundary, then the complete reviewed-package path.
6. Download PDF/ZIP; show PREPARED_NOT_SUBMITTED separately from simulator.
7. Compare sourced wording, export agent brief, label callback simulated.
8. Approve/edit/delete a preference and show actual private memory readback.
