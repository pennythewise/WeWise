import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CardShell, Notice } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { AppIcon } from '@/components/AppIcon';
import { CitationChip } from '../chat/CitationChip';
import { INCIDENTS, incidentFor } from '@/mock/incidents';
import { pick, type Locale } from '@/engine/l';
import { useTx } from '@/i18n/useTx';

function CopyNumber({ number, label }: { number: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(number); } catch { /* clipboard unavailable in some contexts */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} className="flex min-h-touch w-full items-center justify-between rounded-input border border-cardline px-3 text-left" aria-label={`${label} ${number}, ${t('cards.incident.copy')}`}>
      <span className="text-[13px] text-body">{label}</span>
      <span className="font-semibold tabular-nums text-ink">{number} <span className="ml-1 text-xs font-medium text-primary" aria-live="polite">{copied ? t('cards.incident.copied') : t('cards.incident.copy')}</span></span>
    </button>
  );
}

export function IncidentGuideCard({ country: initial, messageId }: { country: string; policyId?: string; messageId?: string }) {
  const { t } = useTranslation();
  const { lang: uiLang } = useTx();
  const [country, setCountry] = useState(initial);
  const [lang, setLang] = useState<Locale>(uiLang);
  const [report, setReport] = useState(false);
  const inc = incidentFor(country);
  const p = (x: Parameters<typeof pick>[0]) => pick(x, lang);
  return (
    <CardShell title={t('cards.incident.title')} icon="plane" right={
      <div role="group" aria-label={t('header.language')} className="inline-flex rounded-control border border-line p-0.5">
        {(['en', 'zh'] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`min-h-[32px] rounded-[7px] px-2 text-xs font-medium ${lang === l ? 'bg-primary text-white' : 'text-ink'}`}>{l === 'en' ? 'EN' : '中文'}</button>)}
      </div>
    }>
      <label className="block text-xs font-medium text-muted" htmlFor="country">{t('cards.incident.country')}</label>
      <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
        {INCIDENTS.map((i) => <option key={i.country} value={i.country}>{i.flag} {pick(i.name, lang)}</option>)}
      </select>

      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.incident.steps')}</h4>
      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-body">{inc.steps.map((s, i) => <li key={i}>{p(s)}</li>)}</ol>

      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.incident.numbers')}</h4>
      <div className="space-y-1.5">{inc.numbers.map((n, i) => <CopyNumber key={i} number={n.number} label={p(n.label)} />)}</div>

      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.incident.avoid')}</h4>
      <ul className="space-y-1 text-[13px] text-body">{inc.avoid.map((s, i) => <li key={i} className="flex gap-1.5"><AppIcon name="close" size={14} className="mt-1 shrink-0 text-danger" />{p(s)}</li>)}</ul>

      {inc.policyDeadline && <div className="mt-4"><Notice tone="warn" icon="clock">{p(inc.policyDeadline.note)} <CitationChip id={inc.policyDeadline.clauseId} messageId={messageId} /></Notice></div>}
      <Link to="/capture" className="btn-primary mt-4 w-full"><AppIcon name="scan" size={18} />{t('cards.incident.capture')}</Link>
      <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setReport(true)}>{t('cards.incident.report')}</button>

      <Sheet open={report} onOpenChange={setReport} side="bottom" height="75dvh" title={t('cards.incident.reportTitle')}>
        <div className="space-y-3 p-4 text-[13px] leading-relaxed text-body">
          {(['en', 'zh'] as const).map((l) => (
            <section key={l} className="rounded-input border border-cardline p-3">
              <h4 className="mb-1 font-semibold text-ink">{l === 'en' ? 'English' : '中文'}</h4>
              <p>{l === 'en' ? `Incident report. Country: ${pick(inc.name, 'en')}. Reporter: M** L** T**. Policy: SG-2026-77****05. Date: ${'2026-10-14'}. Please contact the 24-hour assistance line within 48 hours.` : `事故报告。国家：${pick(inc.name, 'zh')}。报案人：M** L** T**。保单：SG-2026-77****05。日期：2026-10-14。请在 48 小时内联系 24 小时救援热线。`}</p>
              <p className="mt-1 text-xs text-muted">{t('cards.incident.localNote')}</p>
            </section>
          ))}
        </div>
      </Sheet>
    </CardShell>
  );
}
