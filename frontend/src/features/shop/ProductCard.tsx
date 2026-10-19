import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { InsurerMark } from '@/components/InsurerMark';
import { insurerById } from '@/mock/insurers';
import { CATEGORIES, priceRange, quote, shopProductById, type ShopProduct } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { startAiCompare } from './compareFlow';
import { MAX_COMPARE, useShopStore } from './shopStore';

/** Exact price once the quote form is answered; otherwise an estimated range. */
export function PriceTag({ product, big }: { product: ShopProduct; big?: boolean }) {
  const { t } = useTranslation();
  const { money } = useTx();
  const answers = useShopStore((s) => s.quotes[product.type]);
  const [lo, hi] = priceRange(product);
  return (
    <span className="shrink-0 whitespace-nowrap text-right">
      <span className={`block font-semibold text-primary ${big ? 'text-[24px]' : 'text-[18px]'}`}>
        {answers ? money(quote(product, answers)) : <>{money(lo)}<span className="font-normal">–</span>{hi.toLocaleString()}</>}
        <span className="text-xs font-normal text-muted"> {t(`shop.unit.${CATEGORIES[product.type].unit}`)}</span>
      </span>
      <span className="block text-[11px] text-muted">{answers ? t('shop.forYou') : t('shop.estimate')}</span>
    </span>
  );
}

/** Marketplace product row. In compare mode the whole card toggles selection and a round circle shows on its right. */
export function ProductCard({ product, reason }: { product: ShopProduct; reason?: string }) {
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const ins = insurerById(product.insurerId);
  const mode = useShopStore((s) => s.compareMode);
  const compare = useShopStore((s) => s.compare);
  const toggle = useShopStore((s) => s.toggleCompare);
  const selected = compare.includes(product.id);
  const otherType = compare.length > 0 && shopProductById(compare[0])?.type !== product.type;
  const disabled = mode && !selected && (otherType || compare.length >= MAX_COMPARE);

  const body = (
    <>
      <span className="flex items-center gap-3">
        <InsurerMark id={product.insurerId} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-ink">{tx(product.name)}</span>
          <span className="block text-xs text-muted">{lang === 'zh' ? ins.zh : ins.name}</span>
        </span>
      </span>
      <span className="mt-2 block text-[13px] leading-relaxed text-body">{tx(product.tagline)}</span>
      <span className="mt-2.5 flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-wrap gap-1.5">
          <Badge tone="neutral" icon={false} className="whitespace-nowrap">★ {product.rating.toFixed(1)}</Badge>
          <Badge tone="ok" icon="clock" className="whitespace-nowrap">{t('shop.claimDays', { n: product.claimDays })}</Badge>
        </span>
        <PriceTag product={product} />
      </span>
    </>
  );
  return (
    <div className={`card relative !p-3.5 transition-colors ${selected ? '!border-primary bg-bluewash' : ''} ${disabled ? 'opacity-45' : ''}`}>
      {reason && <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand"><AppIcon name="spark" size={14} />{reason}</p>}
      {mode ? (
        <div
          role="checkbox" aria-checked={selected} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && toggle(product.id)}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !disabled) { e.preventDefault(); toggle(product.id); } }}
          className="block cursor-pointer pr-10"
        >
          {body}
          <span aria-hidden="true" className={`absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary text-white' : 'border-secline bg-white'}`}>
            {selected && <AppIcon name="check" size={16} strokeWidth={2.4} />}
          </span>
        </div>
      ) : <Link to={`/shop/p/${product.id}`} className="block">{body}</Link>}
    </div>
  );
}

/** Bottom bar shown in compare mode: count, cancel, and continue to 问微晓. */
export function CompareBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mode = useShopStore((s) => s.compareMode);
  const n = useShopStore((s) => s.compare.length);
  const setMode = useShopStore((s) => s.setCompareMode);
  if (!mode) return null;
  return (
    <div className="absolute inset-x-0 bottom-[var(--tabbar-height)] z-10 flex items-center gap-2 border-t border-cardline bg-white px-4 py-2.5">
      <span className="min-w-0 flex-1 text-[13px] leading-tight text-body">{n < 2 ? t('shop.pick.hint', { max: MAX_COMPARE }) : t('shop.compareBar', { n, max: MAX_COMPARE })}</span>
      <button type="button" className="btn-secondary btn-compact" onClick={() => setMode(false)}>{t('shop.pick.cancel')}</button>
      <button type="button" className="btn-primary btn-compact" disabled={n < 2} onClick={() => startAiCompare(navigate)}>{t('shop.pick.go')}</button>
    </div>
  );
}

/** Toggle that turns compare mode on or off. */
export function CompareToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const mode = useShopStore((s) => s.compareMode);
  const setMode = useShopStore((s) => s.setCompareMode);
  return <button type="button" aria-pressed={mode} className={`${mode ? 'btn-primary' : 'btn-secondary'} ${className}`} onClick={() => setMode(!mode)}>{t('shop.compare')}</button>;
}
