import type { AgentClient } from './AgentClient';
import { ACTIONS } from './actions';
import { bothLangs, type Locale } from './l';
import { TURNS, fallbackOos, turnById } from './scenarios';
import { s5Owner, s5Payout, s5Privilege } from './scenarios/attacks/s5_overreach';
import { resetCardSeq, resetToolSeq, type TimedEvent, type TurnCtx, type TurnScript } from './script';
import type { Claim, ClaimSummary, FileRef, MockFile, Portfolio, TraceEvent } from './types';
import { CLAIMS } from '@/mock/claims';
import { portfolio } from '@/mock';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Deterministic 0..1 from a string, so paced replays stay identical. */
const unit = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

/**
 * Realistic pacing for scripted turns. Content is unchanged; only timing is. A live agent spends time
 * understanding the request, reasoning before it plans, waiting on tools and composing the answer, and an
 * on-chain anchor waits for a block. Tool latencies shown in the Inspector match the paced timeline.
 */
const PACE = 2.2;
const THINK = { understand: 700, plan: 1100, verify: 500, answer: 900 };
function pace(events: TimedEvent[]): TimedEvent[] {
  const callAt = new Map<string, { t: number; tool: string }>();
  let prevAt = 0, now = 0;
  return events.map((e) => {
    const b = e.body;
    let t = now + (e.at - prevAt) * PACE;
    if (b.type === 'understand.done') t += THINK.understand;
    else if (b.type === 'plan.created' || b.type === 'plan.replanned') t += THINK.plan;
    else if (b.type === 'verify.result') t += THINK.verify;
    else if (b.type === 'message.final') t += THINK.answer;
    let body = b;
    if (b.type === 'tool.call') callAt.set(b.callId, { t, tool: b.tool });
    if (b.type === 'tool.result') {
      const call = callAt.get(b.callId);
      if (call) {
        const latency = call.tool.startsWith('proof_')
          ? 2600 + unit(b.callId + call.tool) * 1400 // block confirmation
          : Math.max(260, b.latencyMs * PACE * (0.75 + unit(b.callId + call.tool) * 0.6));
        t = Math.max(t, call.t + latency);
        body = { ...b, latencyMs: Math.round(t - call.t) };
      }
    }
    prevAt = e.at;
    now = t;
    return { at: Math.round(t), body };
  });
}

/** Deterministic scenario player + keyword router. Same interface the HTTP client will implement. */
export class MockAgentClient implements AgentClient {
  speed = 1;
  locale: Locale = 'en';
  private attack = false;
  private epoch = 0;
  private turnSeq = 0;

  setSpeed(s: number) { this.speed = s; }
  setLocale(l: Locale) { this.locale = l; }
  setAttack(v: boolean) { this.attack = v; }
  /** Cancels in-flight turns and restarts id counters so replays are identical. */
  reset() {
    this.epoch++;
    this.turnSeq = 0;
    this.attack = false;
    resetToolSeq();
    resetCardSeq();
  }

  async startSession() {
    this.reset();
    return { sessionId: 'sess_mock_001' };
  }

  /** Router: attachments → exact utterance (either language) → keyword score → out-of-scope fallback. */
  route(text: string, attachments: string[] = []): TurnScript {
    if (this.attack) {
      this.attack = false;
      return [s5Payout, s5Owner, s5Privilege].find((t) => t.keywords.some((k) => norm(text).includes(k))) ?? turnById('s4.inject');
    }
    if (attachments.includes('inj_doc_01')) return turnById('s4.inject');
    if (attachments.includes('policy_sample')) return turnById('s1.upload');
    if (attachments.includes('med_report')) return turnById('s7.medical');
    if (attachments.includes('fin_report')) return turnById('s7.finance');
    const n = norm(text);
    const exact = TURNS.find((t) => t.utterances.some((u) => bothLangs(u).some((v) => norm(v) === n)));
    if (exact) return exact;
    let best: { t: TurnScript; score: number } | null = null;
    for (const t of TURNS) {
      const score = t.keywords.reduce((s, k) => s + (n.includes(k) ? k.length : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { t, score };
    }
    return best?.t ?? fallbackOos;
  }

  private async *play(turn: TurnScript, ctx: TurnCtx, userText: string): AsyncIterable<TraceEvent> {
    const epoch = this.epoch;
    const turnId = `turn_${++this.turnSeq}`;
    yield { type: 'turn.started', turnId, t: 0, userText };
    const events: TimedEvent[] = turn.events(ctx).map((e, i) => ({ ...e, _i: i }) as TimedEvent & { _i: number });
    events.sort((a, b) => a.at - b.at || (a as { _i?: number })._i! - (b as { _i?: number })._i!);
    const timeline = this.speed < 50 ? pace(events) : events;
    let prev = 0;
    for (const e of timeline) {
      if (this.speed < 50) await sleep((e.at - prev) / this.speed);
      if (epoch !== this.epoch) return;
      prev = e.at;
      yield { ...e.body, turnId, t: e.at } as TraceEvent;
    }
  }

  sendMessage({ text, attachments }: { sessionId: string; text: string; attachments?: FileRef[] }): AsyncIterable<TraceEvent> {
    const ids = (attachments ?? []).map((a) => a.fixtureId ?? '');
    const turn = this.route(text, ids);
    return this.play(turn, { text, lang: this.locale, attachments: ids }, text);
  }

  /** Play a turn by id (used for UI-driven steps such as reading a claim document). `hint` is passed as ctx.text. */
  runTurn(turnId: string, hint = '', userText = ''): AsyncIterable<TraceEvent> {
    return this.play(turnById(turnId), { text: hint, lang: this.locale, attachments: [] }, userText);
  }

  resolveAction({ actionId, decision }: { actionId: string; decision: 'confirm' | 'reject' }): AsyncIterable<TraceEvent> {
    const action = ACTIONS[actionId];
    const turn: TurnScript = { id: `action.${actionId}.${decision}`, utterances: [], keywords: [], events: (ctx) => action[decision](ctx) };
    return this.play(turn, { text: '', lang: this.locale, attachments: [] }, '');
  }

  advanceSim(): AsyncIterable<TraceEvent> {
    return this.runTurn('s3.advance');
  }

  async uploadFile(file: File | MockFile): Promise<FileRef> {
    const real = file instanceof File;
    return { id: `file_${file.name}`, name: file.name, mime: real ? file.type : 'application/pdf', size: real ? file.size : 0, fixtureId: real ? undefined : file.fixtureId };
  }

  async getPortfolio(): Promise<Portfolio> { return portfolio(); }
  async listClaims(): Promise<ClaimSummary[]> { return CLAIMS; }
  async getClaim(id: string): Promise<Claim> { return CLAIMS.find((c) => c.id === id) ?? CLAIMS[0]; }
}
