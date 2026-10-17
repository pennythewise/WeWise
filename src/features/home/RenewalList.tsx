import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui';
import { POLICIES } from '@/mock/policies';
import { daysUntil } from '@/mock';
import { useTx } from '@/i18n/useTx';

/** Alerts: renewal + premium-hike warning with a premium-history sparkline (PRD B4). */
export function RenewalList() {
  const { t } = useTranslation();
  const { tx, money, date } = useTx();
  const p = POLICIES[0];
  const first = p.premiumHistory[0], last = p.premiumHistory[p.premiumHistory.length - 1];
  const pct = Math.round(((last - first) / first) * 100);
  return (
    <div className="space-y-2">
      <Notice tone="warn" icon="clock"><strong className="text-ink">{tx(p.product)}</strong> {t('home.renewsOn', { n: daysUntil(p.renewal), date: date(p.renewal) })}</Notice>
      <div className="flex items-center gap-3 rounded-card border border-cardline bg-white p-3">
        <div className="h-12 w-24 shrink-0" role="img" aria-label={t('home.sparkAria', { from: money(first), to: money(last) })}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={p.premiumHistory.map((v, i) => ({ i, v }))}><YAxis hide domain={['dataMin - 10', 'dataMax + 10']} /><Line type="monotone" dataKey="v" stroke="#9B5A10" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
        </div>
        <p className="text-[13px] leading-relaxed text-body"><strong className="text-warn">{t('home.hike', { pct })}</strong><br />{t('home.hikeDetail', { from: money(first), to: money(last) })}</p>
      </div>
    </div>
  );
}
