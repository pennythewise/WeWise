import type { PlanStep, RiskTier, TraceEvent, Txt, TrafficLight } from './types';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'replanned';

export interface ToolRow { callId: string; tool: string; tier: RiskTier; args: Record<string, unknown>; t: number; result?: { ok: boolean; summary: Txt; latencyMs: number } }
export interface TurnView {
  turnId: string;
  userText: string;
  startedIdx: number;
  understand?: { intent: string; slots: Record<string, string>; language: string; t: number };
  steps: { step: PlanStep; status: StepStatus }[];
  parallel: boolean;
  replans: { reason: Txt; t: number }[];
  tools: ToolRow[];
  guards: Extract<TraceEvent, { type: `guard.${string}` }>[];
  verify?: { citationsOk: boolean; numbersOk: boolean; citations: string[]; t: number };
  responded: boolean;
  completed: boolean;
  elapsed: number;
}

/** Pure projection of the event stream into per-turn views. Chat and Inspector are both reducers over the same stream. */
export function buildTurns(events: TraceEvent[]): TurnView[] {
  const map = new Map<string, TurnView>();
  events.forEach((e, idx) => {
    let v = map.get(e.turnId);
    if (!v) {
      v = { turnId: e.turnId, userText: '', startedIdx: idx, steps: [], parallel: false, replans: [], tools: [], guards: [], responded: false, completed: false, elapsed: 0 };
      map.set(e.turnId, v);
    }
    v.elapsed = Math.max(v.elapsed, e.t);
    switch (e.type) {
      case 'turn.started': v.userText = e.userText; break;
      case 'understand.done': v.understand = { intent: e.intent, slots: e.slots, language: e.language, t: e.t }; break;
      case 'plan.created': v.parallel = !!e.parallel; v.steps = e.steps.map((s) => ({ step: s, status: 'pending' })); break;
      case 'plan.replanned':
        v.replans.push({ reason: e.reason, t: e.t });
        v.steps = [...v.steps.map((s) => ({ ...s, status: (s.status === 'done' ? 'done' : 'replanned') as StepStatus })), ...e.steps.map((s) => ({ step: s, status: 'pending' as StepStatus }))];
        break;
      case 'plan.step.started': v.steps = v.steps.map((s) => (s.step.id === e.stepId && s.status === 'pending' ? { ...s, status: 'running' } : s)); break;
      case 'plan.step.done': v.steps = v.steps.map((s) => (s.step.id === e.stepId && s.status !== 'replanned' ? { ...s, status: e.ok === false ? 'failed' : 'done' } : s)); break;
      case 'tool.call': v.tools.push({ callId: e.callId, tool: e.tool, tier: e.tier, args: e.args, t: e.t }); break;
      case 'tool.result': {
        const row = v.tools.find((t) => t.callId === e.callId);
        if (row) row.result = { ok: e.ok, summary: e.summary, latencyMs: e.latencyMs };
        break;
      }
      case 'guard.pii_masked': case 'guard.injection_flagged': case 'guard.denied': case 'guard.confirm_required': v.guards.push(e); break;
      case 'verify.result': v.verify = { citationsOk: e.citationsOk, numbersOk: e.numbersOk, citations: e.citations ?? [], t: e.t }; break;
      case 'message.final': v.responded = true; break;
      case 'turn.completed': v.completed = true; break;
      default: break;
    }
  });
  return [...map.values()].sort((a, b) => a.startedIdx - b.startedIdx);
}

export function trafficLight(turn: TurnView | undefined, pendingActions: string[]): TrafficLight {
  if (!turn) return 'idle';
  if (turn.guards.some((g) => g.type === 'guard.denied')) return 'blocked';
  if (turn.guards.some((g) => g.type === 'guard.confirm_required' && pendingActions.includes(g.actionId))) return 'confirm';
  return 'ok';
}

export const SAMPLE_EVENTS: TraceEvent[] = [
  { type: 'turn.started', turnId: 'turn_demo', t: 0, userText: 'Am I covered for dengue hospitalisation?' },
  { type: 'understand.done', turnId: 'turn_demo', t: 200, intent: 'coverage_question', slots: { condition: 'dengue' }, language: 'en' },
  { type: 'plan.created', turnId: 'turn_demo', t: 400, steps: [{ id: 's1', label: 'Find clauses' }, { id: 's2', label: 'Check waiting period' }] },
  { type: 'plan.step.started', turnId: 'turn_demo', t: 450, stepId: 's1' },
  { type: 'tool.call', turnId: 'turn_demo', t: 600, callId: 'demo_1', tool: 'clause_search', tier: 'T0', args: { q: 'dengue' } },
  { type: 'tool.result', turnId: 'turn_demo', t: 900, callId: 'demo_1', ok: true, summary: '3 clauses found', latencyMs: 300 },
  { type: 'plan.step.done', turnId: 'turn_demo', t: 950, stepId: 's1' },
  { type: 'guard.pii_masked', turnId: 'turn_demo', t: 980, fields: ['name', 'phone'] },
  { type: 'verify.result', turnId: 'turn_demo', t: 1100, citationsOk: true, numbersOk: true, citations: ['HS-3.4'] },
  { type: 'turn.completed', turnId: 'turn_demo', t: 1200 },
];
