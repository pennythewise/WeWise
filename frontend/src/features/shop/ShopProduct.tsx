import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { InsurerMark } from '@/components/InsurerMark';
import { Badge, CardShell, Notice } from '@/components/ui';
import { useAgentStore } from '@/agentStore';
import { insurerById } from '@/mock/insurers';
import { CATEGORIES, shopProductById } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { PriceTag } from './ProductCard';
import { QuoteSheet } from './QuoteSheet';
import { useShopStore } from './shopStore';

export function ShopProduct() {
  const { id } = useParams();
  const p = shopProductById(id ?? '');
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const navigate = useNavigate();
  const quoted = useShopStore((s) => !!s.quotes[p?.type ?? 'medical']);
  const [quoting, setQuoting] = useState(false);
  if (!p) return <Navigate to="/shop" replace />;
  const cat = CATEGORIES[p.type];
  const ins = insurerById(p.insurerId);
  const buy = () => (quoted ? navigate(`/shop/checkout/${p.id}`) : setQuoting(true));
  const ask = () => {
    useAgentStore.getState().setDraft(lang === 'zh' ? `这款「${tx(p.name)}」适合我吗？和我现有的保单有重叠吗？` : `Is "${tx(p.name)}" right for me? Does it overlap with my current policies?`);
    navigate('/ask');
  };
  return (
    <div className="flex min-h-full flex-col gap-4" data-screen="shopProduct">
      <section className="card space-y-3">
        <div className="flex items-start gap-3">
          <InsurerMark id={p.insurerId} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold leading-snug text-ink">{tx(p.name)}</h2>
            <p className="text-xs text-muted">{lang === 'zh' ? ins.zh : ins.name} · {t(`types.${p.type}`)}</p>
          </div>
        </div>
        <p className="text-[14px] text-body">{tx(p.tagline)}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral" icon={false}>★ {p.rating.toFixed(1)}</Badge>
          <Badge tone="ok" icon="clock">{t('shop.claimDays', { n: p.claimDays })}</Badge>
        </div>
        <div className="flex items-end justify-between border-t border-cardline pt-3">
          <button type="button" onClick={() => setQuoting(true)} className="text-[13px] font-medium text-primary underline">{quoted ? t('shop.quote.edit') : t('shop.quote.cta')}</button>
          <PriceTag product={p} big />
        </div>
      </section>

      <CardShell title={t('shop.keyCover')} icon="shield">
        <dl className="divide-y divide-cardline">
          {cat.specLabels.map((label, i) => (
            <div key={i} className="flex justify-between gap-4 py-2.5 text-[14px]"><dt className="text-muted">{tx(label)}</dt><dd className="text-right font-medium text-ink">{tx(p.specs[i])}</dd></div>
          ))}
        </dl>
      </CardShell>

      <Notice tone="warn" icon="info">{t(cat.needsDeclaration ? 'shop.declarationNote' : 'shop.readTerms')}</Notice>

      <button type="button" className="btn-secondary w-full" onClick={ask}><AppIcon name="chat" size={18} />{t('shop.askWewise')}</button>
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto border-t border-cardline bg-white px-4 py-3">
        <button type="button" className="btn-primary w-full" onClick={buy}>{quoted ? t('shop.buy') : t('shop.quote.getAndBuy')}</button>
      </div>
      <QuoteSheet key={String(quoted)} type={p.type} open={quoting} onOpenChange={setQuoting} onDone={quoted ? undefined : () => navigate(`/shop/checkout/${p.id}`)} />
    </div>
  );
}
