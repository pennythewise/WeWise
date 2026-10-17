import type { Chip, Locale, Txt, TraceEvent } from './types';

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type EventBody = DistributiveOmit<TraceEvent, 'turnId' | 't'>;
export interface TimedEvent { at: number; body: EventBody }

export interface TurnCtx { text: string; lang: Locale; attachments: string[] }

export interface TurnScript {
  id: string;
  /** Canonical user lines (both languages). Exact matches win over keywords. */
  utterances: Txt[];
  /** Lower-case substrings for free-text matching. */
  keywords: string[];
  events: (ctx: TurnCtx) => TimedEvent[];
}

export const at = (ms: number, body: EventBody): TimedEvent => ({ at: ms, body });
export const chip = (label: Txt, send: Txt): Chip => ({ label, send });
export const step = (id: string, label: Txt) => ({ id, label });

let toolSeq = 0;
export const resetToolSeq = () => { toolSeq = 0; };
/** A tool call followed by its result; returns two timed events. */
export function tool(t0: number, name: string, tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4', args: Record<string, unknown>, summary: Txt, latencyMs = 320, ok = true): TimedEvent[] {
  const callId = `call_${++toolSeq}`;
  return [
    at(t0, { type: 'tool.call', callId, tool: name, tier, args }),
    at(t0 + latencyMs, { type: 'tool.result', callId, ok, summary, latencyMs }),
  ];
}

let cardSeq = 0;
export const resetCardSeq = () => { cardSeq = 0; };
export const cid = (prefix: string) => `${prefix}_${++cardSeq}`;

export const detectLang = (text: string) => (/[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en');
export const understand = (ctx: TurnCtx, intent: string, slots: Record<string, string> = {}, language = detectLang(ctx.text)): TimedEvent =>
  at(120, { type: 'understand.done', intent, slots, language });
export const done = (t: number): TimedEvent => at(t, { type: 'turn.completed' });
