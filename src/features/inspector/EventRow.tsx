import type { TraceEvent } from '@/engine/types';
import { pick, type Locale } from '@/engine/l';

export function summarise(e: TraceEvent, lang: Locale): string {
  switch (e.type) {
    case 'turn.started': return e.userText;
    case 'understand.done': return `${e.intent} · ${e.language}`;
    case 'plan.created': return e.steps.map((s) => pick(s.label, lang)).join(' → ');
    case 'plan.step.started': case 'plan.step.done': return e.stepId;
    case 'tool.call': return `${e.tool} (${e.tier})`;
    case 'tool.result': return `${e.ok ? '✓' : '✕'} ${pick(e.summary, lang)} · ${e.latencyMs}ms`;
    case 'guard.pii_masked': return e.fields.map((f) => pick(f, lang)).join(', ');
    case 'guard.injection_flagged': return `p.${e.page ?? '?'} ${e.source}`;
    case 'guard.denied': return `${e.reasonCode}: ${pick(e.title, lang)}`;
    case 'guard.confirm_required': return pick(e.what, lang);
    case 'verify.result': return `citations ${e.citationsOk ? '✓' : '✕'} · numbers ${e.numbersOk ? '✓' : '✕'}`;
    case 'plan.replanned': return pick(e.reason, lang);
    case 'llm.token': return e.text;
    case 'ui.card': return e.card.kind;
    case 'message.final': return pick(e.text, lang).slice(0, 90);
    case 'notify.push': return pick(e.title, lang);
    case 'turn.completed': return '';
  }
}

export function EventRow({ event, lang }: { event: TraceEvent; lang: Locale }) {
  const s = summarise(event, lang);
  return (
    <li className="animate-in-bottom rounded-input border border-cardline bg-white px-3 py-2 [animation-duration:180ms]">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="font-mono text-[12px] text-brand">{event.type}</span>
        <span className="tabular-nums">+{event.t}ms</span>
      </div>
      {s && <p className="mt-0.5 break-words text-[13px] text-body">{s}</p>}
    </li>
  );
}
