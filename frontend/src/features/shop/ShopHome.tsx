import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Notice } from '@/components/ui';
import { TYPE_ICON } from '@/components/typeMeta';
import { INSURER_DISCLAIMER, insurerById } from '@/mock/insurers';
import type { InsuranceType } from '@/mock/products';
import { recommendations, SHOP_PRODUCTS, SHOP_TYPES, sortCost } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { CompareBar, CompareToggle, ProductCard } from './ProductCard';
import { useShopStore } from './shopStore';

/** 选保险: marketplace home. Search, category tiles, personalised picks, top rated. */
export function ShopHome() {
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const [q, setQ] = useState('');
  const orders = useShopStore((s) => s.orders.length);
  const recs = useMemo(recommendations, []);
  const quotes = useShopStore((s) => s.quotes);
  useEffect(() => () => useShopStore.getState().setCompareMode(false), []);
  const [cat, setCat] = useState<InsuranceType | 'all'>('all');
  const [sort, setSort] = useState<'rating' | 'price' | 'claim'>('rating');
  const all = useMemo(() => SHOP_PRODUCTS.filter((p) => cat === 'all' || p.type === cat).sort((a, b) => sort === 'price' ? sortCost(a, quotes[a.type]) - sortCost(b, quotes[b.type]) : sort === 'claim' ? a.claimDays - b.claimDays : b.rating - a.rating), [cat, sort, quotes]);
  const chip = (on: boolean) => `min-h-[40px] shrink-0 rounded-full border px-3.5 text-[13px] font-medium ${on ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`;
  const needle = q.trim().toLowerCase();
  const results = needle
    ? SHOP_PRODUCTS.filter((p) => [p.name.en, p.name.zh, insurerById(p.insurerId).name, insurerById(p.insurerId).zh, t(`types.${p.type}`)].some((x) => x.toLowerCase().includes(needle)))
    : [];

  return (
    <div className="space-y-5 pb-14" data-screen="shop">
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{t('shop.search')}</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><AppIcon name="search" size={18} /></span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('shop.search')} className="min-h-[46px] w-full rounded-full border border-line bg-white pl-10 pr-4 text-[14px] text-ink" />
        </label>
        <CompareToggle className="!min-h-[46px] shrink-0 !rounded-full !px-4" />
      </div>

      {needle ? (
        <section className="space-y-3" aria-live="polite">
          <h2 className="text-[15px] font-semibold text-ink">{t('shop.results', { n: results.length })}</h2>
          {results.map((p) => <ProductCard key={p.id} product={p} />)}
          {results.length === 0 && <p className="text-center text-[13px] text-muted">{t('shop.noResults')}</p>}
        </section>
      ) : (
        <>
          <nav aria-label={t('shop.categories')} className="grid grid-cols-4 gap-y-4 rounded-card border border-cardline bg-white px-2 py-4">
            {SHOP_TYPES.map((x) => (
              <Link key={x} to={`/shop/c/${x}`} className="flex min-h-touch flex-col items-center gap-1.5 text-[13px] text-ink">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bluewash text-primary"><AppIcon name={TYPE_ICON[x]} size={22} /></span>
                {t(`types.${x}`)}
              </Link>
            ))}
          </nav>

          {orders > 0 && (
            <Link to="/policies" className="block"><Notice tone="ok" icon="check">{t('shop.ordersNote', { n: orders })} <span className="font-semibold text-primary">{t('shop.viewPolicies')}</span></Notice></Link>
          )}

          {recs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-ink">{t('shop.forYouTitle')}</h2>
              {recs.map((r) => <ProductCard key={r.product.id} product={r.product} reason={tx(r.reason)} />)}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">{t('shop.allProducts')}</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t('shop.categories')}>
              <button type="button" aria-pressed={cat === 'all'} className={chip(cat === 'all')} onClick={() => setCat('all')}>{t('policies.all')}</button>
              {SHOP_TYPES.map((x) => <button key={x} type="button" aria-pressed={cat === x} className={chip(cat === x)} onClick={() => setCat(x)}>{t(`types.${x}`)}</button>)}
            </div>
            <label className="block text-xs font-medium text-muted">{t('shop.sort.label')}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
                <option value="rating">{t('shop.sort.rating')}</option><option value="price">{t('shop.sort.price')}</option><option value="claim">{t('shop.sort.claim')}</option>
              </select>
            </label>
            {all.map((p) => <ProductCard key={p.id} product={p} />)}
          </section>
          <p className="text-[11px] leading-relaxed text-muted" lang={lang}>{tx(INSURER_DISCLAIMER)}</p>
        </>
      )}
      <CompareBar />
    </div>
  );
}
