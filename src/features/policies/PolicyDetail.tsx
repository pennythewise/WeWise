import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, CardShell, EmptyState, Notice } from '@/components/ui';
import { InsurerMark } from '@/components/InsurerMark';
import { insurerById } from '@/mock/insurers';
import { policyById } from '@/mock/policies';
import { clausesFor, type ClauseType } from '@/mock/clauses';
import { ClauseViewer } from './ClauseViewer';
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
  if (!p) return <EmptyState icon="file" title={t('policies.notFound')} text={t('policies.notFoundText')} />;
  const clauses = clausesFor(p.id).filter((c) => (ctype === 'all' || c.type === ctype) && (q === '' || (tx(c.title) + tx(c.text) + c.id).toLowerCase().includes(q.toLowerCase())));
  const ask = () => {
    useAgentStore.getState().setDraft(p.type === 'medical' ? t('policies.askMedical') : t('policies.askGeneric', { name: tx(p.product) }));
    navigate('/ask');
  };
  const tab = 'min-h-touch flex-1 border-b-2 border-transparent text-[14px] font-medium text-muted data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary';
  return (
    <div className="space-y-4" data-screen="policyDetail">
      <div className="flex items-center gap-3">
        <InsurerMark id={p.insurerId} size={44} />
        <div className="min-w-0"><h2 className="text-[18px] font-semibold leading-tight text-ink">{tx(p.product)}</h2><p className="text-xs text-muted">{lang === 'zh' ? insurerById(p.insurerId).zh : insurerById(p.insurerId).name} · {p.policyNo}</p></div>
      </div>
      <button type="button" className="btn-primary w-full" onClick={ask}>{t('policies.ask')}</button>
      <Tabs.Root defaultValue="summary">
        <Tabs.List className="flex border-b border-cardline bg-white" aria-label={tx(p.product)}>
          {(['summary', 'clauses', 'gaps'] as const).map((k) => <Tabs.Trigger key={k} value={k} className={tab}>{t(`policies.tabs.${k}`)}</Tabs.Trigger>)}
        </Tabs.List>

        <Tabs.Content value="summary" className="space-y-3 pt-4 outline-none">
          <CardShell>
            <dl className="divide-y divide-cardline text-[13px]">
              {p.keyTerms.map((k, i) => <div key={i} className="flex justify-between gap-3 py-2"><dt className="text-muted">{tx(k.label)}</dt><dd className="text-right font-semibold text-ink">{tx(k.value)}</dd></div>)}
              <div className="flex justify-between gap-3 py-2"><dt className="text-muted">{t(p.status === 'upcoming' ? 'policies.coverPeriod' : 'policies.renews')}</dt><dd className="text-right font-semibold text-ink">{p.status === 'upcoming' ? `${date(p.inception, false)} – ${date(p.renewal)}` : date(p.renewal)}</dd></div>
            </dl>
          </CardShell>
        </Tabs.Content>

        <Tabs.Content value="clauses" className="space-y-3 pt-4 outline-none">
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
        </Tabs.Content>

        <Tabs.Content value="gaps" className="space-y-3 pt-4 outline-none">
          {p.gap ? <Notice tone="warn">{tx(p.gap)}</Notice> : <Notice tone="ok">{t('policies.noGap')}</Notice>}
          <button type="button" className="btn-secondary w-full" onClick={() => { useAgentStore.getState().setDraft(t('chat.chips.gapSend')); navigate('/ask'); }}>{t('policies.gapCheck')}</button>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
