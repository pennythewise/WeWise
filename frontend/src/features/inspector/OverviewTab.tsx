import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { useClaimStore } from '../claims/claimStore';

/** Static five-step claims experience explainer (from the reference mock-up), with the current step highlighted. */
export function OverviewTab() {
  const { t } = useTranslation();
  const { status, step } = useClaimStore();
  const current = status === 'DRAFT' ? Math.min(step, 3) : status === 'SUBMITTED' ? 4 : 5;
  return (
    <ol aria-label={t('inspector.tabs.overview')} className="space-y-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <li key={n} aria-current={n === current ? 'step' : undefined} className={`flex gap-3 rounded-card border p-3 ${n === current ? 'border-[#8298DA] bg-[#F4F7FF]' : 'border-transparent'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${n < current ? 'bg-primary text-white' : n === current ? 'bg-primary text-white' : 'bg-[#E2E9F8] text-brand'}`}>{n < current ? <AppIcon name="check" size={13} strokeWidth={2} /> : n}</span>
          <div><p className="text-[14px] font-semibold text-ink">{t(`inspector.overview.s${n}.t`)}{n === current && <span className="ml-2 text-xs font-medium text-primary">{t('claims.now')}</span>}</p><p className="mt-0.5 text-[13px] leading-relaxed text-body">{t(`inspector.overview.s${n}.d`)}</p></div>
        </li>
      ))}
    </ol>
  );
}
