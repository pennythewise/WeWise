import type { AgentClient } from './AgentClient';
import type { Locale, Txt } from './l';
import type { Card, Chip, Claim, ClaimSummary, FileRef, MockFile, Portfolio, PlanStep, RiskTier, TraceEvent } from './types';

/** Bilingual labels for the backend's tool registry, so the plan and inspector read naturally in both languages. */
const TOOL_LABEL: Record<string, Txt> = {
  policy_get: { en: 'Load your policy', zh: '读取你的保单' },
  policy_search_clauses: { en: 'Find the relevant clauses', zh: '查找相关条款' },
  policy_explain: { en: 'Explain with quoted sources', zh: '依据原文解释' },
  coverage_analyze: { en: 'Check coverage and gaps', zh: '核对保障与缺口' },
  claim_status_get: { en: 'Read claim status', zh: '读取理赔状态' },
  claim_export_preview: { en: 'Prepare a reviewable claim package', zh: '准备可核对的理赔资料包' },
};
const labelOf = (tool: string): Txt => TOOL_LABEL[tool] ?? tool.replace(/_/g, ' ');

interface BackendEvent { stage: string; status: string; detail?: unknown; tool?: string; step_id?: string; tier?: string; args_masked?: Record<string, unknown>; latency_ms?: number }
interface BackendCitation { id?: string; page?: number; quote?: string }
interface BackendResult {
  answer?: string; disclaimer?: string; chips?: unknown[]; citations?: BackendCitation[]; engine?: string;
  conversation_id?: string; pending_action?: { kind: string; token: string; expires_at?: string; claim_id?: string };
  cards?: { type: string }[];
}

class BackendError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(res.status, typeof data.detail === 'string' ? data.detail : res.statusText);
  return data as T;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));
const chipOf = (c: unknown): Chip => { const s = text(c); return { label: s, send: s }; };

/**
 * Talks to the FastAPI backend (private synthetic workspace, deterministic tool-calling agent) and translates its
 * NDJSON turn stream into the same TraceEvents the scripted client emits, so chat, inspector and safety panels
 * render real execution without any UI changes.
 */
export class HttpAgentClient implements AgentClient {
  locale: Locale = 'en';
  private conversationId?: string;
  private ready?: Promise<void>;
  private turnSeq = 0;
  private intent = '';
  private pending?: { token: string; claimId?: string };
  private issued = new Set<string>();

  /** True for confirmation actions this client created, so the store routes the decision back here. */
  owns(actionId: string) { return this.issued.has(actionId); }

  setLocale(l: Locale) { this.locale = l; }

  /** True when the API answers its health check. Never throws. */
  async available(): Promise<boolean> {
    try { return (await call<{ status: string }>('/health')).status === 'ok'; } catch { return false; }
  }

  /** Starts (or reuses) an isolated synthetic workspace; the session lives in an httpOnly cookie. */
  private session(): Promise<void> {
    this.ready ??= (async () => {
      try { await call('/auth/me'); } catch {
        await call('/auth/demo', { method: 'POST' });
        // The seeded synthetic policy is pre-reviewed so answers are grounded straight away in the demo.
        const { policies = [] } = await call<{ policies?: { id: string }[] }>('/policies');
        await Promise.all(policies.map((p) => call(`/policies/${p.id}`, { method: 'PATCH', body: JSON.stringify({ fields: {}, confirmed: true }) }).catch(() => undefined)));
      }
    })().catch((e) => { this.ready = undefined; throw e; });
    return this.ready;
  }

  async startSession() {
    this.conversationId = undefined;
    this.pending = undefined;
    await this.session();
    return { sessionId: 'sess_backend' };
  }

  async *sendMessage(input: { sessionId: string; text: string; attachments?: FileRef[] }): AsyncIterable<TraceEvent> {
    const turnId = `turn_b${++this.turnSeq}`;
    const t0 = performance.now();
    const base = () => ({ turnId, t: Math.round(performance.now() - t0) });
    yield { ...base(), type: 'turn.started', userText: input.text };
    try {
      await this.session();
      const res = await fetch('/api/chat/stream', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.text, locale: this.locale, conversation_id: this.conversationId }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new BackendError(res.status, typeof body.detail === 'string' ? body.detail : res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = done ? '' : lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { type: string; event?: BackendEvent; conversation_id?: string } & BackendResult;
          if (msg.conversation_id) this.conversationId = msg.conversation_id;
          if (msg.type === 'event' && msg.event) yield* this.mapEvent(msg.event, base);
          else if (msg.type === 'result') yield* this.mapResult(msg, base);
        }
        if (done) break;
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : 'Backend unavailable';
      yield { ...base(), type: 'guard.denied', reasonCode: 'backend_error', title: { en: 'The agent could not finish', zh: '智能体未能完成本次请求' }, why };
      yield { ...base(), type: 'message.final', text: { en: 'Something went wrong on the server. Nothing was changed. Please try again.', zh: '服务器出错，没有任何改动。请重试。' } };
    }
    yield { ...base(), type: 'turn.completed' };
  }

  private *mapEvent(e: BackendEvent, base: () => { turnId: string; t: number }): Iterable<TraceEvent> {
    const d = e.detail as Record<string, unknown> | string | undefined;
    switch (e.stage) {
      case 'understand': {
        const det = (d ?? {}) as { intent?: string; locale?: string; slots?: Record<string, unknown> };
        const slots = Object.fromEntries(Object.entries(det.slots ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, text(v)]));
        this.intent = det.intent ?? 'unknown';
        yield { ...base(), type: 'understand.done', intent: this.intent, slots, language: det.locale ?? this.locale };
        break;
      }
      case 'plan':
      case 'replan': {
        const steps: PlanStep[] = (((d ?? {}) as { steps?: { id: string; tool: string }[] }).steps ?? []).map((s) => ({ id: s.id, label: labelOf(s.tool) }));
        yield e.stage === 'plan'
          ? { ...base(), type: 'plan.created', steps }
          : { ...base(), type: 'plan.replanned', reason: { en: 'Plan corrected', zh: '计划已更正' }, steps };
        break;
      }
      case 'execute': {
        const id = e.step_id ?? e.tool ?? 'step';
        if (e.status === 'running') {
          yield { ...base(), type: 'plan.step.started', stepId: id };
          yield { ...base(), type: 'tool.call', callId: id, tool: e.tool ?? id, tier: (e.tier ?? 'T1') as RiskTier, args: e.args_masked ?? {} };
        } else {
          const ok = e.status === 'ok';
          yield { ...base(), type: 'tool.result', callId: id, ok, summary: ok ? labelOf(e.tool ?? id) : text(d), latencyMs: e.latency_ms ?? 0 };
          yield { ...base(), type: 'plan.step.done', stepId: id, ok };
        }
        break;
      }
      case 'safety':
        yield { ...base(), type: 'guard.denied', reasonCode: e.tool ? `tool_${e.tool}` : 'outside_registry', title: { en: 'Blocked by a safety guard', zh: '已被安全防护拦截' }, why: text(d) };
        break;
      case 'verify':
        yield { ...base(), type: 'verify.result', citationsOk: e.status === 'ok', numbersOk: e.status === 'ok' };
        break;
      default:
        break; // routing / respond are internal bookkeeping
    }
  }

  private *mapResult(r: BackendResult, base: () => { turnId: string; t: number }): Iterable<TraceEvent> {
    if (this.intent === 'outside_scope') {
      yield { ...base(), type: 'guard.denied', reasonCode: 'outside_scope', title: { en: 'Request declined', zh: '已拒绝该请求' }, why: { en: 'Moving money, changing payout accounts and reading other people\'s records are outside what this assistant may do.', zh: '转移资金、更改收款账户和查看他人资料不在本助手的权限范围内。' } };
      const card: Card = { kind: 'SafetyNoticeCard', id: `card_b${this.turnSeq}`, data: { tone: 'blocked', title: { en: 'Request declined', zh: '已拒绝该请求' }, body: r.answer ?? '', reasonCode: 'outside_registry' } };
      yield { ...base(), type: 'ui.card', card };
    }
    if (r.pending_action?.kind === 'export_claim_package') {
      this.pending = { token: r.pending_action.token, claimId: r.pending_action.claim_id };
      const actionId = `act_${r.pending_action.token.slice(0, 8)}`;
      this.issued.add(actionId);
      yield { ...base(), type: 'guard.confirm_required', actionId, what: { en: 'Download the reviewed claim package', zh: '下载已核对的理赔资料包' }, why: { en: 'Nothing is sent to an insurer.', zh: '不会发送给保险公司。' } };
      yield { ...base(), type: 'ui.card', card: { kind: 'ConfirmActionCard', id: `card_${actionId}`, data: { actionId, title: { en: 'Confirm export', zh: '确认导出' }, what: { en: 'A copy of the reviewed claim package for you to download.', zh: '供你下载的已核对理赔资料包副本。' }, to: { en: 'You only', zh: '仅限你本人' }, shared: [], expiresInSec: 600 } } };
    }
    const quotes: Txt[] = (r.citations ?? []).filter((c) => c.quote).map((c) => `p.${c.page ?? '?'} · ${c.quote}`);
    const answer = [r.answer, r.disclaimer].filter(Boolean).join('\n\n');
    yield { ...base(), type: 'message.final', text: answer || { en: 'Done.', zh: '完成。' }, chips: (r.chips ?? []).map(chipOf), bullets: quotes.length ? quotes : undefined };
  }

  async *resolveAction(input: { actionId: string; decision: 'confirm' | 'reject' }): AsyncIterable<TraceEvent> {
    const turnId = `turn_b${++this.turnSeq}`;
    const t0 = performance.now();
    const base = () => ({ turnId, t: Math.round(performance.now() - t0) });
    yield { ...base(), type: 'turn.started', userText: input.decision === 'confirm' ? 'Confirm' : 'Cancel' };
    if (input.decision === 'confirm' && this.pending && this.conversationId) {
      try {
        await call('/agent/actions/confirm', { method: 'POST', body: JSON.stringify({ conversation_id: this.conversationId, token: this.pending.token, confirmed: true }) });
        yield { ...base(), type: 'message.final', text: { en: 'Done. The reviewed package is ready for you to download. Nothing was sent to an insurer.', zh: '已完成。已核对的资料包可供你下载，没有发送给任何保险公司。' } };
      } catch (e) {
        yield { ...base(), type: 'guard.denied', reasonCode: 'confirm_failed', title: { en: 'Could not confirm', zh: '无法确认' }, why: e instanceof Error ? e.message : 'error' };
      }
    } else {
      yield { ...base(), type: 'message.final', text: { en: 'Cancelled. Nothing was done.', zh: '已取消，未执行任何操作。' } };
    }
    this.pending = undefined;
    yield { ...base(), type: 'turn.completed' };
  }

  async uploadFile(file: File | MockFile): Promise<FileRef> {
    if (!(file instanceof File)) throw new Error('The backend accepts real files only.');
    await this.session();
    const form = new FormData();
    form.append('kind', 'policy');
    form.append('file', file);
    const out = await call<{ document?: { id: string }; policy?: { id: string } }>('/documents', { method: 'POST', body: form });
    return { id: out.policy?.id ?? out.document?.id ?? file.name, name: file.name, mime: file.type, size: file.size };
  }

  async getPortfolio(): Promise<Portfolio> {
    await this.session();
    const p = await call<{ policies?: { id: string }[] }>('/portfolio');
    return { userId: 'backend', policyIds: (p.policies ?? []).map((x) => x.id), totalCover: 0, monthlyPremium: 0, nextRenewal: { policyId: '', date: '' } };
  }

  async listClaims(): Promise<ClaimSummary[]> {
    await this.session();
    const out = await call<{ claims?: { id: string; policy_id: string; status?: string; title?: string; updated_at?: string }[] }>('/claims');
    return (out.claims ?? []).map((c) => ({ id: c.id, policyId: c.policy_id, status: 'DRAFT' as const, title: c.title ?? c.id, updated: c.updated_at ?? '' }));
  }

  async getClaim(id: string): Promise<Claim> {
    await this.session();
    const c = await call<{ id: string; policy_id: string; title?: string; updated_at?: string }>(`/claims/${encodeURIComponent(id)}`);
    return { id: c.id, policyId: c.policy_id, status: 'DRAFT', title: c.title ?? c.id, updated: c.updated_at ?? '', timeline: [] };
  }
}
