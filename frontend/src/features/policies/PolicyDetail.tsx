import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, BigStat, CardShell, EmptyState, KeyValueList, Notice, Segmented } from '@/components/ui';
import { daysUntil } from '@/mock';
import { L } from '@/engine/l';
import { InsurerMark } from '@/components/InsurerMark';
import { INSURER_DISCLAIMER, insurerById } from '@/mock/insurers';
import { policyById } from '@/mock/policies';
import { clausesFor, type ClauseType } from '@/mock/clauses';
import { ClauseViewer } from './ClauseViewer';
import { LocalPolicyCard } from '../crossborder/LocalPolicyCard';
import { INCIDENTS } from '@/mock/incidents';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';

const CLAUSE_TYPES: ClauseType[] = ['coverage', 'exclusion', 'waiting', 'limit', 'condition'];
const TONE = { coverage: 'ok', exclusion: 'danger', waiting: 'warn', limit: 'info', condition: 'neutral' } as const;

export function PolicyDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { tx, date, lang } = useTx();
  const navigate = useNavigate();
  const p = policyById(id);
  const [q, setQ] = useState('');
  const [ctype, setCtype] = useState<ClauseType | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [tabId, setTabId] = useState<'summary' | 'clauses' | 'gaps'>('summary');
  const [copied, setCopied] = useState(false);
  if (!p) return <EmptyState icon="file" title={t('policies.notFound')} text={t('policies.notFoundText')} />;
  const clauses = clausesFor(p.id).filter((c) => (ctype === 'all' || c.type === ctype) && (q === '' || (tx(c.title) + tx(c.text) + c.id).toLowerCase().includes(q.toLowerCase())));
  const ask = () => {
    useAgentStore.getState().setDraft(p.type === 'medical' ? t('policies.askMedical') : t('policies.askGeneric', { name: tx(p.product) }));
    navigate('/ask');
  };
  return (
    <div className="space-y-4" data-screen="policyDetail">
      <section className="card space-y-4 shadow-card">
        <div className="flex items-start gap-3">
          <InsurerMark id={p.insurerId} size={44} />
          <div className="min-w-0 flex-1"><h2 className="text-[18px] font-semibold leading-tight text-ink">{tx(p.product)}</h2><p className="text-xs text-muted">{lang === 'zh' ? insurerById(p.insurerId).zh : insurerById(p.insurerId).name}</p></div>
          <BigStat value={Math.max(0, daysUntil(p.renewal))} tone={daysUntil(p.renewal) <= 60 ? 'warn' : 'neutral'} caption={tx(L('days remaining', '天后到期'))} />
        </div>
        <div className="flex items-center justify-between rounded-input bg-wash px-3 py-2.5 text-[13px]">
          <span className="min-w-0"><span className="block text-xs text-muted">{tx(L('Policy number', '保单号'))}</span><span className="font-semibold tabular-nums text-ink">{p.policyNo}</span></span>
          <button type="button" className="min-h-touch px-2 text-[13px] font-semibold text-primary" onClick={() => { void navigator.clipboard?.writeText(p.policyNo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? tx(L('Copied', '已复制')) : tx(L('Copy', '复制'))}</button>
        </div>
        <button type="button" className="btn-primary w-full" onClick={ask}>{t('policies.ask')}</button>
      </section>
      <Segmented label={tx(p.product)} value={tabId} onChange={setTabId} options={(['summary', 'clauses', 'gaps'] as const).map((k) => ({ id: k, label: t(`policies.tabs.${k}`) }))} />
      <div>
        {tabId === 'summary' && <div className="space-y-3 pt-1">
          <CardShell>
            <KeyValueList rows={[
              ...p.keyTerms.map((k) => ({ k: tx(k.label), v: tx(k.value) })),
              { k: t(p.status === 'upcoming' ? 'policies.coverPeriod' : 'policies.renews'), v: p.status === 'upcoming' ? `${date(p.inception, false)} – ${date(p.renewal)}` : date(p.renewal) },
            ]} />
          </CardShell>
          <p className="text-[11px] leading-snug text-muted">{tx(INSURER_DISCLAIMER)}</p>
          {p.type === 'travel' && <TravelLocal />}
        </div>}

        {tabId === 'clauses' && <div className="space-y-3 pt-1">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('policies.search')} aria-label={t('policies.search')} className="min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px]" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('policies.filterClause')}>
            {(['all', ...CLAUSE_TYPES] as const).map((x) => <button key={x} type="button" aria-pressed={ctype === x} onClick={() => setCtype(x)} className={`min-h-[36px] rounded-full border px-3 text-xs font-medium ${ctype === x ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`}>{x === 'all' ? t('policies.all') : t(`policies.clauseType.${x}`)}</button>)}
          </div>
          <ul className="space-y-2">
            {clauses.map((c) => (
              <li key={c.id} className="rounded-card border border-cardline bg-white">
                <button type="button" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)} className="flex min-h-touch w-full items-center gap-2 px-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-brand">{c.id} · p.{c.page}</span><span className="block text-[14px] font-semibold text-ink">{tx(c.title)}</span></span>
                  <Badge tone={TONE[c.type]} icon={false}>{t(`policies.clauseType.${c.type}`)}</Badge>
                </button>
                {open === c.id && <div className="px-3 pb-3"><ClauseViewer clauseId={c.id} /></div>}
              </li>
            ))}
          </ul>
          {clauses.length === 0 && <p className="text-center text-[13px] text-muted">{t('policies.noClauses')}</p>}
        </div>}

        {tabId === 'gaps' && <div className="space-y-3 pt-1">
          {p.gap ? <Notice tone="warn">{tx(p.gap)}</Notice> : <Notice tone="ok">{t('policies.noGap')}</Notice>}
          <button type="button" className="btn-secondary w-full" onClick={() => { useAgentStore.getState().setDraft(t('chat.chips.gapSend')); navigate('/ask'); }}>{t('policies.gapCheck')}</button>
        </div>}
      </div>
    </div>
  );
}

/** Travel policies: policy facts in the language of the destination (PRD A4). */
function TravelLocal() {
  const { tx } = useTx();
  const [country, setCountry] = useState('TH');
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted" htmlFor="travel-country">{tx({ en: 'Country you are in', zh: '您所在的国家' })}</label>
      <select id="travel-country" value={country} onChange={(e) => setCountry(e.target.value)} className="min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
        {INCIDENTS.map((i) => <option key={i.country} value={i.country}>{i.flag} {tx(i.name)}</option>)}
      </select>
      <LocalPolicyCard country={country} />
    </div>
  );
}
