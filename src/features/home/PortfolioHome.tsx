import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { CardShell, EmptyState } from '@/components/ui';
import { POLICIES } from '@/mock/policies';
import { CLAIMS } from '@/mock/claims';
import { portfolio } from '@/mock';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { useUiStore } from '@/store';
import { useClaimView } from '../claims/useClaimView';
import { ClaimStatusBadge } from '../claims/ClaimStatusBadge';
import { CoverageDonut } from './CoverageDonut';
import { PolicyTwinCard } from './PolicyTwinCard';
import { RenewalList } from './RenewalList';
import { INSURER_DISCLAIMER } from '@/mock/insurers';

function OpenClaimRow({ id }: { id: string }) {
  const { tx } = useTx();
  const { t } = useTranslation();
  const v = useClaimView(id)!;
  return (
    <li>
      <Link to={`/claims/${id}`} className="flex min-h-touch items-center gap-3 py-2">
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{tx(v.claim.title)}</span>{v.claim.waitingOn === 'user' && <span className="text-xs text-warn">{t('claims.waitingOn.user')}</span>}</span>
        <ClaimStatusBadge status={v.claim.status} />
        <AppIcon name="chevron" size={16} />
      </Link>
    </li>
  );
}

export function PortfolioHome() {
  const { t } = useTranslation();
  const { money, tx, date } = useTx();
  const navigate = useNavigate();
  const pf = portfolio();
  const gaps = [
    { label: t('home.gaps.outpatient'), prompt: t('home.gaps.outpatientSend') },
    { label: t('home.gaps.ci'), prompt: t('chat.chips.gapSend') },
    { label: t('home.gaps.child'), prompt: t('chat.chips.compareSend') },
  ];
  const ask = (prompt: string) => { useAgentStore.getState().setDraft(prompt); navigate('/ask'); };

  if (POLICIES.length === 0) {
    return <EmptyState icon="shield" title={t('home.emptyTitle')} text={t('home.emptyText')} action={<button className="btn-primary" onClick={() => useUiStore.getState().setUploadOpen(true)}>{t('home.addPolicy')}</button>} />;
  }
  return (
    <div className="space-y-5" data-screen="home">
      <section className="rounded-card bg-gradient-to-br from-brand to-primary p-5 text-white">
        <p className="text-[13px] opacity-90">{t('brand.taglineZh')}</p>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight">{t('home.hero')}</h2>
        <p className="mt-1 text-[13px] opacity-90">{t('brand.tagline')}</p>
      </section>

      <CardShell title={t('home.glance')} icon="shield" right={
        <button type="button" onClick={() => useUiStore.getState().setShowcaseOpen(true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white" data-testid="open-showcase">
          <AppIcon name="car" size={16} />{t('showcase.open')}
        </button>
      }>
        <CoverageDonut />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-cardline pt-3 text-[13px]">
          <div><dt className="text-xs text-muted">{t('home.monthly')}</dt><dd className="font-semibold tabular-nums text-ink">{money(pf.monthlyPremium)}</dd></div>
          <div><dt className="text-xs text-muted">{t('home.nextRenewal')}</dt><dd className="font-semibold text-ink">{date(pf.nextRenewal.date)}</dd></div>
        </dl>
      </CardShell>

      <section aria-label={t('home.policies')}>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[16px] font-semibold text-ink">{t('home.policies')}</h3><button type="button" className="min-h-touch text-[13px] font-semibold text-primary" onClick={() => useUiStore.getState().setUploadOpen(true)}>+ {t('home.addPolicy')}</button></div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" tabIndex={0} role="region" aria-label={t('home.policies')}>
          {POLICIES.map((p) => <PolicyTwinCard key={p.id} policy={p} />)}
        </div>
      </section>

      <section aria-label={t('home.alerts')}><h3 className="mb-2 text-[16px] font-semibold text-ink">{t('home.alerts')}</h3><RenewalList /></section>

      <section aria-label={t('home.gapsTitle')}>
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{t('home.gapsTitle')}</h3>
        <div className="flex flex-wrap gap-2">{gaps.map((g) => <button key={g.label} type="button" onClick={() => ask(g.prompt)} className="min-h-[40px] rounded-full border border-secline bg-white px-3.5 text-[13px] font-medium text-primary">{g.label}</button>)}</div>
      </section>

      <section aria-label={t('home.openClaims')}>
        <h3 className="mb-1 text-[16px] font-semibold text-ink">{t('home.openClaims')}</h3>
        <ul className="divide-y divide-cardline rounded-card border border-cardline bg-white px-3">{CLAIMS.filter((c) => c.status !== 'DECLINED').map((c) => <OpenClaimRow key={c.id} id={c.id} />)}</ul>
      </section>

      <p className="pb-2 text-center text-xs leading-relaxed text-muted">{tx(INSURER_DISCLAIMER)}</p>
    </div>
  );
}
