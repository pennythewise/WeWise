import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { TYPE_COLOR } from '@/components/typeMeta';
import { POLICIES } from '@/mock/policies';
import type { InsuranceType } from '@/mock/products';
import { useTx } from '@/i18n/useTx';

export function CoverageDonut() {
  const { t } = useTranslation();
  const { money } = useTx();
  const byType = POLICIES.reduce<Partial<Record<InsuranceType, number>>>((m, p) => ({ ...m, [p.type]: (m[p.type] ?? 0) + p.coverAmount }), {});
  const data = (Object.entries(byType) as [InsuranceType, number][]).map(([type, value]) => ({ type, value }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[116px] w-[116px] shrink-0" role="img" aria-label={t('home.donutAria', { total: money(total) })}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={38} outerRadius={56} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.type} fill={TYPE_COLOR[d.type]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted">{t('home.totalCover')}</span>
          <span className="text-[12px] font-semibold tabular-nums text-ink">{money(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[12px]">
        {data.map((d) => (
          <li key={d.type} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: TYPE_COLOR[d.type] }} aria-hidden="true" />
            <span className="flex-1 whitespace-nowrap text-body">{t(`types.${d.type}`)}</span>
            <span className="whitespace-nowrap font-semibold tabular-nums text-ink">{money(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
