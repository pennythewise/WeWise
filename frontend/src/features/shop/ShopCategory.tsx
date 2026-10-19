import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { INSURERS } from '@/mock/insurers';
import type { InsuranceType } from '@/mock/products';
import { CATEGORIES, priceRange, productsOfType, quote, SHOP_TYPES } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { CompareBar, CompareToggle, ProductCard } from './ProductCard';
import { QuoteSheet } from './QuoteSheet';
import { useShopStore } from './shopStore';

type Sort = 'rating' | 'price' | 'claim';

export function ShopCategory() {
  const { type } = useParams();
  if (!SHOP_TYPES.includes(type as InsuranceType)) return <Navigate to="/shop" replace />;
  return <Category type={type as InsuranceType} />;
}

function Category({ type }: { type: InsuranceType }) {
  const { t } = useTranslation();
  const { lang } = useTx();
  const answers = useShopStore((s) => s.quotes[type]);
  useEffect(() => () => useShopStore.getState().setCompareMode(false), []);
  const [sort, setSort] = useState<Sort>('rating');
  const [insurer, setInsurer] = useState('all');
  const [quoting, setQuoting] = useState(false);
  const rows = useMemo(() => {
    const list = productsOfType(type).filter((p) => insurer === 'all' || p.insurerId === insurer);
    const cost = (p: (typeof list)[number]) => (answers ? quote(p, answers) : priceRange(p)[0]);
    return list.sort((a, b) => sort === 'price' ? cost(a) - cost(b) : sort === 'claim' ? a.claimDays - b.claimDays : b.rating - a.rating);
  }, [type, insurer, sort, answers]);
  const chip = (on: boolean) => `min-h-[40px] shrink-0 rounded-full border px-3.5 text-[13px] font-medium ${on ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`;

  return (
    <div className="space-y-4 pb-16" data-screen="shopCategory">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t('shop.categories')}>
        {SHOP_TYPES.map((x) => <Link key={x} to={`/shop/c/${x}`} replace aria-current={x === type ? 'page' : undefined} className={`${chip(x === type)} inline-flex items-center`}>{t(`types.${x}`)}</Link>)}
      </div>

      <button type="button" onClick={() => setQuoting(true)} className="card flex w-full items-center gap-3 !p-3.5 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bluewash text-primary"><AppIcon name="spark" size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{answers ? t('shop.quote.done') : t('shop.quote.cta')}</span>
          <span className="block text-xs text-muted">{answers ? t('shop.quote.edit') : t('shop.quote.ctaHint', { n: CATEGORIES[type].fields.length })}</span>
        </span>
        <AppIcon name="chevron" size={18} />
      </button>

      <div className="flex gap-2">
        <label className="min-w-0 flex-1 text-xs font-medium text-muted">{t('shop.sort.label')}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
            <option value="rating">{t('shop.sort.rating')}</option><option value="price">{t('shop.sort.price')}</option><option value="claim">{t('shop.sort.claim')}</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-xs font-medium text-muted">{t('policies.insurer')}
          <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
            <option value="all">{t('policies.all')}</option>
            {INSURERS.filter((i) => productsOfType(type).some((p) => p.insurerId === i.id)).map((i) => <option key={i.id} value={i.id}>{lang === 'zh' ? i.zh : i.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{t('shop.count', { n: rows.length })}</span>
        <CompareToggle className="btn-compact" />
      </div>

      <ul className="space-y-3">
        {rows.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
      </ul>
      {rows.length === 0 && <p className="text-center text-[13px] text-muted">{t('shop.noResults')}</p>}

      <CompareBar />
      <QuoteSheet key={type + JSON.stringify(answers)} type={type} open={quoting} onOpenChange={setQuoting} />
    </div>
  );
}
