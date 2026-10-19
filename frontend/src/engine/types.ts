// Mirrors backend schemas (02_TECH_SPEC §9). Cards and trace events are the whole contract between engine and UI.
import type { L, Locale, Txt } from './l';

export type { L, Locale, Txt };
export type RiskTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export interface FileRef { id: string; name: string; mime: string; size: number; fixtureId?: string }
export interface MockFile { name: string; fixtureId: string }

export interface Chip { label: Txt; send: Txt }

// ── Trace events (PRD §4) ──
interface Base { turnId: string; t: number } // t = ms since turn start

export type TraceEvent =
  | (Base & { type: 'turn.started'; userText: string })
  | (Base & { type: 'understand.done'; intent: string; slots: Record<string, string>; language: string })
  | (Base & { type: 'plan.created'; steps: PlanStep[]; parallel?: boolean })
  | (Base & { type: 'plan.step.started'; stepId: string })
  | (Base & { type: 'plan.step.done'; stepId: string; ok?: boolean })
  | (Base & { type: 'tool.call'; callId: string; tool: string; tier: RiskTier; args: Record<string, unknown> })
  | (Base & { type: 'tool.result'; callId: string; ok: boolean; summary: Txt; latencyMs: number; retry?: boolean })
  | (Base & { type: 'guard.pii_masked'; fields: Txt[]; why?: Txt })
  | (Base & { type: 'guard.injection_flagged'; source: string; page?: number; snippet: string; why?: Txt })
  | (Base & { type: 'guard.denied'; reasonCode: string; title: Txt; why: Txt })
  | (Base & { type: 'guard.confirm_required'; actionId: string; what: Txt; why?: Txt })
  | (Base & { type: 'verify.result'; citationsOk: boolean; numbersOk: boolean; citations?: string[] })
  | (Base & { type: 'plan.replanned'; reason: Txt; steps: PlanStep[] })
  | (Base & { type: 'llm.token'; text: string })
  | (Base & { type: 'ui.card'; card: Card })
  | (Base & { type: 'message.final'; text: Txt; chips?: Chip[]; citations?: string[]; verdict?: Verdict; bullets?: Txt[] })
  | (Base & { type: 'notify.push'; title: Txt; body: Txt })
  | (Base & { type: 'turn.completed' });

export type TraceEventType = TraceEvent['type'];
export type Verdict = 'covered' | 'not_covered' | 'depends' | 'unsure';
export interface PlanStep { id: string; label: Txt }

// ── Cards (PRD §3 cards/ + tech §9.4) ──
export interface ExtractedField {
  key: string;
  group: 'basics' | 'limits' | 'waiting' | 'exclusions';
  label: Txt;
  value: Txt;
  page: number;
  confidence: number;
  clauseId?: string;
}
export interface GapRow { area: Txt; status: 'covered' | 'partial' | 'gap'; why: Txt; cite?: string }
export interface VerdictCriterion { name: Txt; a: number; b: number }
export interface ShareItem { id: string; label: Txt; value: Txt }
export interface ReportFinding { label: Txt; value: Txt; status: 'ok' | 'watch' | 'disclose'; note?: Txt; page: number }

export type Card =
  | { kind: 'PolicySummaryCard'; id: string; data: { policyId: string } }
  | { kind: 'ExtractionReviewCard'; id: string; data: { policyId: string; fields: ExtractedField[] } }
  | { kind: 'GapReportCard'; id: string; data: { rows: GapRow[]; considerations: Txt[] } }
  | { kind: 'CompareTableCard'; id: string; data: { productIds: string[]; winners: Record<string, string> } }
  | { kind: 'AdvocateCard'; id: string; data: { side: 'A' | 'B'; productId: string; argument: Txt } }
  | { kind: 'VerdictCard'; id: string; data: { a: string; b: string; criteria: VerdictCriterion[]; winsA: Txt; winsB: Txt; cautions: Txt[]; headline: Txt } }
  | { kind: 'ClaimPrescreenCard'; id: string; data: { policyId: string; verdict: 'likely_covered' | 'likely_excluded' | 'uncertain'; inception: string; eligible: string; incident: string; waitingDays: number; exclusions: { clauseId: string }[]; missing: Txt[] } }
  | { kind: 'ChecklistCard'; id: string; data: { claimId: string } }
  | { kind: 'ClaimStatusCard'; id: string; data: { claimId: string } }
  | { kind: 'ConfirmActionCard'; id: string; data: { actionId: string; title: Txt; what: Txt; to: Txt; shared: Txt[]; payout?: string; expiresInSec: number } }
  | { kind: 'HandoffPreviewCard'; id: string; data: { agentIds: string[]; why: Record<string, Txt[]>; shares: ShareItem[]; actionId: string } }
  | { kind: 'IncidentGuideCard'; id: string; data: { country: string; policyId?: string } }
  | { kind: 'SafetyNoticeCard'; id: string; data: { tone: 'info' | 'blocked'; title: Txt; body: Txt; reasonCode: string; snippet?: string; page?: number; next?: Txt } }
  | { kind: 'EscalationCard'; id: string; data: { reason: Txt } }
  | { kind: 'ReportInsightsCard'; id: string; data: { report: 'medical' | 'financial'; file: string; findings: ReportFinding[]; implications: Txt[]; memory: Txt[] } }
  | { kind: 'OverlapReportCard'; id: string; data: { gig: boolean } }
  | { kind: 'SwitchCheckCard'; id: string; data: Record<string, never> }
  | { kind: 'LocationPermissionCard'; id: string; data: Record<string, never> }
  | { kind: 'LocationSuggestCard'; id: string; data: { cityId: string } };

export type CardKind = Card['kind'];

// ── Domain ──
export interface PolicyView { id: string }
export interface Portfolio { userId: string; policyIds: string[]; totalCover: number; monthlyPremium: number; nextRenewal: { policyId: string; date: string } }
export interface ClaimSummary { id: string; policyId: string; status: ClaimStatus; title: Txt; updated: string; waitingOn?: 'user' | 'insurer' }
export type ClaimStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'INFO_REQUESTED' | 'DECLINED' | 'PAID';
export interface TimelineStep { stage: 'SUBMITTED' | 'DOCUMENT_REVIEW' | 'INFO_REQUESTED' | 'ASSESSMENT' | 'DECISION' | 'PAYOUT'; at?: string; actor?: 'you' | 'insurer' | 'ai'; note?: Txt }
export interface Claim extends ClaimSummary { timeline: TimelineStep[]; decline?: { reason: Txt; quote: Txt; clauseId: string } }

// ── Inspector ──
export type TrafficLight = 'idle' | 'ok' | 'confirm' | 'blocked';
