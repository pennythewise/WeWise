import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/ui';
import { insurerById, INSURER_DISCLAIMER } from '@/mock/insurers';
import { shopProductById } from '@/mock/shop';
import { compareRows, DIMENSIONS, type Dimension } from '@/mock/shopCompare';
import { useShopStore } from '@/features/shop/shopStore';
import { useTx } from '@/i18n/useTx';

/** Marketplace comparison table for the dimension the user chose in chat. Winner dots mark the best value per row. */
export function ShopCompareCard({ productIds, dimension }: { productIds: string[]; dimension: Dimension }) {
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const ps = productIds.map(shopProductById).filter((p) => !!p).map((p) => p!);
  const answers = useShopStore((s) => s.quotes[ps[0]?.type]);
  if (ps.length < 2) return null;
  const rows = compareRows(dimension, ps, answers);
  const title = DIMENSIONS.find((d) => d.key === dimension)!.chip;
  return (
    <CardShell title={tx(title)} icon="file" className="overflow-hidden">
      <div className="-mx-4 overflow-x-auto px-4" tabIndex={0} role="region" aria-label={tx(title)}>
        <table className="w-full min-w-[340px] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white py-2 pr-3" scope="col"><span className="sr-only">{t('cards.compare.term')}</span></th>
              {ps.map((p) => (
                <th key={p.id} scope="col" className="min-w-[120px] px-2 py-2 align-bottom">
                  <span className="font-semibold text-ink">{tx(p.name)}</span>
                  <span className="block text-xs font-normal text-muted">{lang === 'zh' ? insurerById(p.insurerId).zh : insurerById(p.insurerId).name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <th scope="row" className="sticky left-0 z-10 border-t border-cardline bg-white py-2.5 pr-3 text-xs font-medium text-muted">{tx(r.label)}</th>
                {r.cells.map((c, i) => (
                  <td key={ps[i].id} className="border-t border-cardline px-2 py-2.5 align-top text-ink">
                    {tx(c)}
                    {r.best === i && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-ok align-middle" role="img" aria-label={t('cards.compare.better')} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><span className="inline-block h-2 w-2 rounded-full bg-ok" aria-hidden="true" />{t('cards.compare.better')}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{tx(INSURER_DISCLAIMER)}</p>
    </CardShell>
  );
}
