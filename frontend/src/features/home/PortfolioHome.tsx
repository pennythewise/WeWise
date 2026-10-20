import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { CardShell, EmptyState } from '@/components/ui';
import { POLICIES } from '@/mock/policies';
import { CLAIMS } from '@/mock/claims';
import { portfolio, daysUntil } from '@/mock';
import { useTx } from '@/i18n/useTx';
import { useClaimView } from '../claims/useClaimView';
import { ClaimStatusBadge } from '../claims/ClaimStatusBadge';
import { CoverageDonut } from './CoverageDonut';
import { PolicyTwinCard } from './PolicyTwinCard';
import { RenewalList } from './RenewalList';
import { AssetShowcase } from '../showcase/AssetShowcase';
import { HomeLocation } from '../location/HomeLocation';
import { INSURER_DISCLAIMER } from '@/mock/insurers';
import { L } from '@/engine/l';
import type { IconName } from '@/components/AppIcon';

function OpenClaimRow({ id }: { id: string }) {
  const { tx } = useTx();
  const { t } = useTranslation();
  const v = useClaimView(id)!;
  return (
    <li>
      <Link to={`/claims/${id}`} className="flex min-h-touch items-center gap-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name="file" size={18} /></span>
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

  if (POLICIES.length === 0) {
    return <EmptyState icon="shield" title={t('home.emptyTitle')} text={t('home.emptyText')} action={<button className="btn-primary" onClick={() => navigate('/upload')}>{t('home.addPolicy')}</button>} />;
  }
  return (
    <div className="space-y-5" data-screen="home">
      <section className="rounded-card bg-gradient-to-br from-brand to-primary p-5 text-white shadow-card">
        <p className="text-[13px] opacity-90">{t('brand.taglineZh')}</p>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight">{t('home.hero')}</h2>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium">
          <AppIcon name="clock" size={14} />
          {tx(L(`${POLICIES.length} policies · next renewal in ${daysUntil(pf.nextRenewal.date)} days`, `${POLICIES.length} 份保单 · ${daysUntil(pf.nextRenewal.date)} 天后续保`))}
        </p>
      </section>

      <ul className="grid grid-cols-3 gap-2.5" aria-label={tx(L('Quick actions', '快捷操作'))}>
        {([
          { to: '/ask', icon: 'chat', label: L('Ask WeWise', '问微晓') },
          { to: '/upload', icon: 'scan', label: L('Add a document', '添加文件') },
          { to: '/claims', icon: 'file', label: L('Prepare a claim', '准备理赔') },
        ] as { to: string; icon: IconName; label: L }[]).map((a) => (
          <li key={a.to}>
            <Link to={a.to} className="flex min-h-[88px] flex-col items-start justify-between rounded-card border border-cardline bg-white p-3 shadow-card active:bg-bluewash">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name={a.icon} size={20} /></span>
              <span className="text-[13px] font-semibold leading-tight text-ink">{tx(a.label)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-label={tx(L('Needs your attention', '需要您关注'))}>
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{tx(L('Needs your attention', '需要您关注'))}</h3>
        <ul className="divide-y divide-cardline rounded-card border border-cardline bg-white px-4 shadow-card">
          <li>
            <Link to="/policies" className="flex min-h-touch items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wb-warning-bg)] text-warn"><AppIcon name="clock" size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{tx(POLICIES[0].product)}</span><span className="text-xs text-warn">{t('home.renewsIn', { n: daysUntil(POLICIES[0].renewal) })}</span></span>
              <AppIcon name="chevron" size={16} />
            </Link>
          </li>
          {CLAIMS.filter((c) => c.waitingOn === 'user').slice(0, 1).map((c) => <OpenClaimRow key={c.id} id={c.id} />)}
        </ul>
      </section>

      <HomeLocation />

      <CardShell title={t('home.glance')} icon="shield">
        <CoverageDonut />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-cardline pt-3 text-[13px]">
          <div><dt className="text-xs text-muted">{t('home.monthly')}</dt><dd className="font-semibold tabular-nums text-ink">{money(pf.monthlyPremium)}</dd></div>
          <div><dt className="text-xs text-muted">{t('home.nextRenewal')}</dt><dd className="font-semibold text-ink">{date(pf.nextRenewal.date)}</dd></div>
        </dl>
      </CardShell>

      <AssetShowcase />

      <section aria-label={t('home.policies')}>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[16px] font-semibold text-ink">{t('home.policies')}</h3><button type="button" className="min-h-touch text-[13px] font-semibold text-primary" onClick={() => navigate('/upload')}>+ {t('home.addPolicy')}</button></div>
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" tabIndex={0} role="region" aria-label={t('home.policies')}>
          {POLICIES.map((p) => <PolicyTwinCard key={p.id} policy={p} />)}
        </div>
      </section>

      <section aria-label={t('home.alerts')}><h3 className="mb-2 text-[16px] font-semibold text-ink">{t('home.alerts')}</h3><RenewalList /></section>

      <section aria-label={tx(L('Check-ups', '检查工具'))}>
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{tx(L('Check-ups', '检查工具'))}</h3>
        <ul className="grid grid-cols-1 gap-2">
          {([
            { to: '/coverage-check', icon: 'search', title: L('Overlaps & gaps', '重叠与缺口'), text: L('Am I paying twice? Am I covered for gig work?', '有没有重复投保？兼职配送有保障吗？') },
            { to: '/switch-check', icon: 'info', title: L('Switching check', '换保检查'), text: L('Told to cancel a policy and buy a new one? Check first.', '被劝退保换新？先检查一下。') },
            { to: '/upload', icon: 'heart', title: L('Analyse a report', '分析报告'), text: L('Health screening or payslip: what it means for your cover.', '体检报告或工资单对保障的影响。') },
          ] as { to: string; icon: IconName; title: L; text: L }[]).map((x) => (
            <li key={x.to}>
              <Link to={x.to} className="flex min-h-touch items-center gap-3 rounded-card border border-cardline bg-white p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name={x.icon} size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-ink">{tx(x.title)}</span><span className="block text-xs text-muted">{tx(x.text)}</span></span>
                <AppIcon name="chevron" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="pb-2 text-center text-xs leading-relaxed text-muted">{tx(INSURER_DISCLAIMER)}</p>
    </div>
  );
}
