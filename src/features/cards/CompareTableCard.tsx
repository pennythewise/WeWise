import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/ui';
import { insurerById } from '@/mock/insurers';
import { productById } from '@/mock/products';
import { useTx } from '@/i18n/useTx';

/** Horizontally scrollable table with a sticky first column and winner dots per row (PRD §6.7). */
export function CompareTableCard({ productIds, winners }: { productIds: string[]; winners: Record<string, string> }) {
  const { t } = useTranslation();
  const { tx, money } = useTx();
  const products = productIds.map(productById);
  const rows: { key: string; label: string; val: (i: number) => string }[] = [
    { key: 'premium', label: t('cards.compare.premium'), val: (i) => `${money(products[i].monthlyPremium)}${t('cards.compare.perMonth')}` },
    { key: 'deductible', label: t('cards.compare.deductible'), val: (i) => money(products[i].deductible) },
    { key: 'coPay', label: t('cards.compare.copay'), val: (i) => `${products[i].coPayPct}%` },
    { key: 'limit', label: t('cards.compare.limit'), val: (i) => money(products[i].annualLimit) },
    { key: 'waiting', label: t('cards.compare.waiting'), val: (i) => t('cards.summary.days', { n: products[i].waitingDays }) },
    { key: 'hike', label: t('cards.compare.trajectory'), val: (i) => tx(products[i].premiumTrajectory) },
  ];
  return (
    <CardShell title={t('cards.compare.title')} icon="file" className="overflow-hidden">
      <div className="-mx-4 overflow-x-auto px-4" tabIndex={0} role="region" aria-label={t('cards.compare.title')}>
        <table className="w-full min-w-[340px] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white py-2 pr-3 text-xs font-semibold text-muted" scope="col"><span className="sr-only">{t('cards.compare.term')}</span></th>
              {products.map((p, i) => (
                <th key={p.id} scope="col" className="min-w-[120px] px-2 py-2 align-bottom">
                  <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">{i === 0 ? 'A' : 'B'}</span>
                  <span className="font-semibold text-ink">{tx(p.name)}</span>
                  <span className="block text-xs font-normal text-muted">{insurerById(p.insurerId).name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 z-10 border-t border-cardline bg-white py-2.5 pr-3 text-xs font-medium text-muted">{r.label}</th>
                {products.map((p, i) => (
                  <td key={p.id} className="border-t border-cardline px-2 py-2.5 align-top text-ink">
                    {r.val(i)}
                    {winners[r.key] === p.id && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-ok align-middle" title={t('cards.compare.better')} role="img" aria-label={t('cards.compare.better')} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><span className="inline-block h-2 w-2 rounded-full bg-ok" aria-hidden="true" />{t('cards.compare.better')}</p>
    </CardShell>
  );
}
