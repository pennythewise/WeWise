import { useTranslation } from 'react-i18next';
import type { Txt } from '@/engine/types';
import { Badge, CardShell, Notice } from '@/components/ui';
import { CitationChip } from '../chat/CitationChip';
import { clauseById } from '@/mock/clauses';
import { daysBetween } from '@/engine/l';
import { useTx } from '@/i18n/useTx';

interface Props { verdict: 'likely_covered' | 'likely_excluded' | 'uncertain'; inception: string; eligible: string; incident: string; waitingDays: number; exclusions: { clauseId: string }[]; missing: Txt[]; messageId?: string }

export function ClaimPrescreenCard({ verdict, inception, eligible, incident, waitingDays, exclusions, missing, messageId }: Props) {
  const { t } = useTranslation();
  const { tx, date } = useTx();
  const days = daysBetween(inception, incident);
  const ok = incident >= eligible;
  // Timeline bar: inception -> eligible -> incident, scaled to the span (min 1 day to avoid /0).
  const start = Math.min(Date.parse(inception), Date.parse(incident));
  const end = Math.max(Date.parse(incident), Date.parse(eligible)) + 20 * 86_400_000;
  const pos = (d: string) => `${((Date.parse(d) - start) / (end - start)) * 100}%`;
  return (
    <CardShell title={t('cards.prescreen.title')} icon="clock"
      right={verdict === 'likely_covered' ? <Badge tone="ok" icon="check">{t('cards.prescreen.covered')}</Badge> : verdict === 'likely_excluded' ? <Badge tone="danger" icon="close">{t('cards.prescreen.excluded')}</Badge> : <Badge tone="warn" icon="info">{t('cards.prescreen.uncertain')}</Badge>}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.prescreen.waiting')}</h4>
      <div className="relative mt-5 h-2 rounded-full bg-[#E2E9F8]" role="img" aria-label={t('cards.prescreen.waitingAria', { days, wait: waitingDays })}>
        <div className="absolute h-2 rounded-full bg-[#B9C7EE]" style={{ left: pos(inception), width: `calc(${pos(eligible)} - ${pos(inception)})` }} />
        {[['inception', inception, 'bg-brand'], ['eligible', eligible, 'bg-ok'], ['incident', incident, ok ? 'bg-primary' : 'bg-danger']].map(([k, d, c]) => (
          <span key={k} className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${c}`} style={{ left: pos(d) }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[['inception', inception], ['eligible', eligible], ['incident', incident]].map(([k, d]) => (
          <div key={k}><dt className="text-muted">{t(`cards.prescreen.${k}`)}</dt><dd className="font-semibold text-ink">{date(d)}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-[13px] text-body">{ok ? t('cards.prescreen.waitOk', { days }) : t('cards.prescreen.waitBefore', { days: Math.abs(days) })}</p>

      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.prescreen.exclusions')}</h4>
      {exclusions.length === 0 ? <p className="text-[13px] text-body">{t('cards.prescreen.noExclusions')}</p> : exclusions.map((e) => (
        <blockquote key={e.clauseId} className="border-l-[3px] border-danger bg-[var(--wb-danger-bg)] px-3 py-2 text-[13px] text-ink"><CitationChip id={e.clauseId} messageId={messageId} /> “{clauseById(e.clauseId) ? tx(clauseById(e.clauseId)!.text) : ''}”</blockquote>
      ))}
      {missing.length > 0 && (<>
        <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.prescreen.missing')}</h4>
        <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-body">{missing.map((m, i) => <li key={i}>{tx(m)}</li>)}</ul>
      </>)}
      <div className="mt-4"><Notice tone="info" icon="info">{t('cards.prescreen.notice')}</Notice></div>
    </CardShell>
  );
}
