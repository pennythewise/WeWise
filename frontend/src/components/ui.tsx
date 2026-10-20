import type { ReactNode } from 'react';
import { AppIcon, type IconName } from './AppIcon';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
const TONE: Record<Tone, string> = {
  ok: 'bg-[var(--wb-success-bg)] text-ok border-[#CFE6DB]',
  warn: 'bg-[var(--wb-warning-bg)] text-warn border-[#F0DDC2]',
  danger: 'bg-[var(--wb-danger-bg)] text-danger border-[#F6CBC6]',
  info: 'bg-bluewash text-brand border-[#D5E0F7]',
  neutral: 'bg-wash text-muted border-line',
};
const TONE_ICON: Record<Tone, IconName> = { ok: 'check', warn: 'info', danger: 'lock', info: 'info', neutral: 'clock' };

/** Status is never colour-only: every badge carries an icon and text. */
export function Badge({ tone = 'neutral', icon, children, className = '' }: { tone?: Tone; icon?: IconName | false; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-xs font-semibold ${TONE[tone]} ${className}`}>
      {icon !== false && <AppIcon name={icon || TONE_ICON[tone]} size={13} strokeWidth={2} />}
      {children}
    </span>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: Tone; children: ReactNode; icon?: IconName }) {
  return (
    <div className={`flex gap-2 rounded-control border px-3 py-2.5 text-[13px] leading-relaxed ${TONE[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      <span className="mt-0.5 shrink-0"><AppIcon name={icon || TONE_ICON[tone]} size={16} /></span>
      <div className="min-w-0 text-body">{children}</div>
    </div>
  );
}

export function CardShell({ title, icon, right, children, tone, className = '' }: { title?: ReactNode; icon?: IconName; right?: ReactNode; children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <section className={`rounded-card border bg-white shadow-card ${tone === 'danger' ? 'border-[#F6CBC6]' : 'border-cardline'} ${className}`}>
      {title && (
        <header className="flex items-center gap-2 border-b border-cardline px-4 py-3">
          {icon && <span className="text-brand"><AppIcon name={icon} size={18} /></span>}
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ProgressBar({ value, max = 100, tone = 'info', label }: { value: number; max?: number; tone?: Tone; label: string }) {
  const color = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : tone === 'danger' ? 'bg-danger' : 'bg-primary';
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-[#E2E9F8]">
      <div className={`h-full rounded-full transition-[width] duration-300 ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function StepIndicator({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex items-start">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'todo';
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" aria-current={state === 'current' ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : n <= current ? 'bg-primary' : 'bg-[#D6DFF2]'}`} />
              <span className={`flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full text-xs font-semibold ${state === 'todo' ? 'bg-[#E2E9F8] text-brand' : 'bg-primary text-white'}`}>
                {state === 'done' ? <AppIcon name="check" size={13} strokeWidth={2} /> : n}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'opacity-0' : n < current ? 'bg-primary' : 'bg-[#D6DFF2]'}`} />
            </div>
            <span className={`px-1 text-xs leading-tight ${state === 'current' ? 'font-semibold text-ink' : 'text-muted'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ icon = 'spark', title, text, action }: { icon?: IconName; title?: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-muted">
      <AppIcon name={icon} size={47} strokeWidth={1.1} />
      {title && <p className="text-[15px] font-semibold text-ink">{title}</p>}
      <p className="max-w-[30ch] text-[13px] leading-relaxed">{text}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-input bg-[#E7ECF5] ${className}`} aria-hidden="true" />;
}

/** Label muted on the left, value bold on the right, hairline between rows (Lloyds, Shopee policy detail). */
export function KeyValueList({ rows, className = '' }: { rows: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <dl className={`divide-y divide-cardline text-[14px] ${className}`}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-muted">{r.k}</dt>
          <dd className="text-right font-semibold text-ink">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Pill segmented control (GoPay, Monzo). Controlled; each option is a button with aria-pressed. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-[#E9EEF8] p-1">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={`min-h-[38px] flex-1 rounded-full px-3 text-[13px] font-medium transition-colors ${value === o.id ? 'bg-white font-semibold text-ink shadow-card' : 'text-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom action bar: a short summary on the left, one clear action on the right (Booking, Trip.com, Zalando). */
export function StickyActionBar({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 mt-5 flex items-center gap-3 border-t border-cardline bg-white/95 px-4 pb-[15px] pt-3 backdrop-blur">
      {summary && <div className="min-w-0 flex-1 text-[13px] leading-tight text-muted">{summary}</div>}
      <div className={`flex gap-2.5 ${summary ? 'shrink-0' : 'flex-1'}`}>{children}</div>
    </div>
  );
}

/** Large status number with a caption: "244 days remaining" (Lloyds), "Spent $15" (Revolut). */
export function BigStat({ value, caption, tone = 'neutral' }: { value: ReactNode; caption: ReactNode; tone?: Tone }) {
  const color = tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className="text-right">
      <p className={`text-[28px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{caption}</p>
    </div>
  );
}

/** Horizontal scrolling row that bleeds to the screen edge (chips, source cards, tiles). */
export function ScrollRow({ children, label }: { children: ReactNode; label?: string }) {
  return <div role={label ? 'group' : undefined} aria-label={label} className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div>;
}
