import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { InsurerMark } from '@/components/InsurerMark';
import { ASSETS } from '@/mock/assets';
import { insurerById } from '@/mock/insurers';
import { policyById } from '@/mock/policies';
import { daysUntil } from '@/mock';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';
import { hasWebGL } from './webgl';

const AssetScene = lazy(() => import('./AssetScene')); // three.js loads only once the card scrolls into view

/** 3D showcase of everything the user has insured, embedded on Home in the app's light theme. Swipe, arrow keys or the dots to move. */
export function AssetShowcase() {
  const { t } = useTranslation();
  const { tx, money, lang } = useTx();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const drag = useRef(0);
  const start = useRef<number | null>(null);
  const box = useRef<HTMLElement>(null);
  const webgl = hasWebGL();
  const total = ASSETS.length;
  const asset = ASSETS[index];
  const policy = asset.policyId ? policyById(asset.policyId) : undefined;
  const go = (d: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + d)));

  useEffect(() => { // mount the WebGL scene only when the card is near the viewport
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const down = (e: React.PointerEvent) => { start.current = e.clientX; drag.current = 0; };
  const move = (e: React.PointerEvent) => { if (start.current !== null) drag.current = Math.max(-220, Math.min(220, e.clientX - start.current)); };
  const up = (e: React.PointerEvent) => {
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null; drag.current = 0;
    if (Math.abs(dx) > 55) go(dx < 0 ? 1 : -1);
  };
  const addCover = () => { useAgentStore.getState().setDraft(t('showcase.addSend')); navigate('/ask'); };
  const days = policy ? daysUntil(policy.renewal) : 0;

  return (
    <section ref={box} className="overflow-hidden rounded-card border border-cardline bg-white" aria-label={t('showcase.title')} data-testid="asset-showcase"
      tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); }}>
      <header className="flex items-center gap-2 border-b border-cardline px-4 py-3">
        <span className="text-brand"><AppIcon name="car" size={18} /></span>
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{t('showcase.title')}</h3>
        <span className="text-xs tabular-nums text-muted" aria-live="polite">{t('showcase.count', { n: index + 1, total })}</span>
      </header>

      <div className="relative h-[250px] touch-pan-y bg-white" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="showcase-stage">
        {webgl && visible ? (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[13px] text-muted">{t('showcase.loading')}</div>}>
            <AssetScene index={index} drag={drag} />
          </Suspense>
        ) : <div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-muted">{webgl ? t('showcase.loading') : t('showcase.noWebgl')}</div>}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={t('showcase.prev')} className="pointer-events-auto icon-btn border border-cardline bg-white/90 text-ink shadow-sm disabled:opacity-30"><AppIcon name="back" /></button>
          <div className="pointer-events-auto flex items-center gap-2" role="tablist" aria-label={t('showcase.title')}>
            {ASSETS.map((a, i) => <button key={a.id} type="button" role="tab" aria-selected={i === index} aria-label={tx(a.name)} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-primary' : 'w-2 bg-[#C9D3EC]'}`} />)}
          </div>
          <button type="button" onClick={() => go(1)} disabled={index === total - 1} aria-label={t('showcase.next')} className="pointer-events-auto icon-btn border border-cardline bg-white/90 text-ink shadow-sm disabled:opacity-30"><AppIcon name="chevron" /></button>
        </div>
      </div>

      <div key={asset.id} className="animate-fade-in p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-[18px] font-semibold leading-tight text-ink">{tx(asset.name)}</h4>
            <p className="text-[13px] text-muted">{tx(asset.subtitle)}</p>
          </div>
          {policy ? <Badge tone="ok" icon="check">{t('showcase.insured')}</Badge> : <Badge tone="warn" icon="info">{t('showcase.notInsured')}</Badge>}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-cardline pt-3 text-[13px]">
          {asset.facts.map((f, i) => <div key={i}><dt className="text-[11px] text-muted">{tx(f.label)}</dt><dd className="font-semibold tabular-nums text-ink">{tx(f.value)}</dd></div>)}
          {policy && <div><dt className="text-[11px] text-muted">{t('showcase.cover')}</dt><dd className="font-semibold tabular-nums text-ink">{money(policy.coverAmount)}</dd></div>}
        </dl>
        {policy ? (
          <div className="mt-3 flex items-center gap-3 rounded-input bg-wash p-2.5">
            <InsurerMark id={policy.insurerId} size={34} />
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{tx(policy.product)}</p><p className="text-xs text-muted">{lang === 'zh' ? insurerById(policy.insurerId).zh : insurerById(policy.insurerId).name} · {t('showcase.renews', { n: days })}</p></div>
            <button type="button" onClick={() => navigate(`/policies/${policy.id}`)} className="btn-secondary btn-compact shrink-0">{t('showcase.openPolicy')}</button>
          </div>
        ) : (
          <button type="button" onClick={addCover} className="btn-primary mt-3 w-full">{t('showcase.addCover')}</button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted">{index === 0 ? `${t('showcase.swipe')} · ` : ''}{t('showcase.hint')}</p>
      </div>
    </section>
  );
}
