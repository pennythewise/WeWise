import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
import { useUiStore } from '@/store';
import { hasWebGL } from './webgl';

const AssetScene = lazy(() => import('./AssetScene')); // three.js loads only when the showcase opens

/** Full-screen, car-HMI style showcase of everything the user has insured. Swipe, arrow keys or the dots to move between assets. */
export function AssetShowcase() {
  const { t } = useTranslation();
  const { tx, money, lang } = useTx();
  const navigate = useNavigate();
  const { showcaseOpen, setShowcaseOpen } = useUiStore();
  const [index, setIndex] = useState(0);
  const drag = useRef(0);
  const start = useRef<number | null>(null);
  const webgl = hasWebGL();
  const total = ASSETS.length;
  const asset = ASSETS[index];
  const policy = asset.policyId ? policyById(asset.policyId) : undefined;
  const go = (d: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + d)));

  useEffect(() => {
    if (!showcaseOpen) return;
    setIndex(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showcaseOpen]);

  const down = (e: React.PointerEvent) => { start.current = e.clientX; drag.current = 0; };
  const move = (e: React.PointerEvent) => { if (start.current !== null) drag.current = Math.max(-220, Math.min(220, e.clientX - start.current)); };
  const up = (e: React.PointerEvent) => {
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null; drag.current = 0;
    if (Math.abs(dx) > 55) go(dx < 0 ? 1 : -1);
  };

  const close = () => setShowcaseOpen(false);
  const openPolicy = () => { close(); navigate(`/policies/${policy!.id}`); };
  const addCover = () => { close(); useAgentStore.getState().setDraft(t('showcase.addSend')); navigate('/ask'); };
  const days = policy ? daysUntil(policy.renewal) : 0;

  return (
    <Dialog.Root open={showcaseOpen} onOpenChange={setShowcaseOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-fade-in" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-1/2 z-50 flex w-[min(100vw,var(--app-max-width))] -translate-x-1/2 flex-col overflow-hidden bg-[#070A12] text-white outline-none data-[state=open]:animate-fade-in">
          <Dialog.Title className="sr-only">{t('showcase.title')}</Dialog.Title>

          <div className="absolute inset-0 touch-pan-y" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="showcase-stage">
            {webgl ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-[13px] text-white/60">{t('showcase.loading')}</div>}>
                <AssetScene index={index} drag={drag} />
              </Suspense>
            ) : <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#0B1020] to-[#070A12] px-8 text-center text-[13px] text-white/60">{t('showcase.noWebgl')}</div>}
          </div>

          {/* HUD */}
          <div className="pointer-events-none relative z-10 flex items-center justify-between px-4 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{t('showcase.title')}</p>
              <p className="text-[13px] tabular-nums text-white/80" aria-live="polite">{t('showcase.count', { n: index + 1, total })}</p>
            </div>
            <Dialog.Close className="pointer-events-auto icon-btn bg-white/10 text-white hover:bg-white/20" aria-label={t('showcase.close')}><AppIcon name="close" /></Dialog.Close>
          </div>

          <div className="pointer-events-none relative z-10 mt-auto space-y-3 px-4 pb-5">
            <div className="pointer-events-auto flex items-center justify-between">
              <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={t('showcase.prev')} className="icon-btn bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"><AppIcon name="back" /></button>
              <div className="flex items-center gap-2" role="tablist" aria-label={t('showcase.title')}>
                {ASSETS.map((a, i) => <button key={a.id} type="button" role="tab" aria-selected={i === index} aria-label={tx(a.name)} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-[#8CA3EF]' : 'w-2 bg-white/35'}`} />)}
              </div>
              <button type="button" onClick={() => go(1)} disabled={index === total - 1} aria-label={t('showcase.next')} className="icon-btn bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"><AppIcon name="chevron" /></button>
            </div>

            <section key={asset.id} className="pointer-events-auto animate-fade-in rounded-[20px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl" aria-label={tx(asset.name)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[22px] font-semibold leading-tight">{tx(asset.name)}</h2>
                  <p className="text-[13px] text-white/60">{tx(asset.subtitle)}</p>
                </div>
                {policy ? <Badge tone="ok" icon="check" className="!border-transparent !bg-[#167C59]/25 !text-[#6EE7B7]">{t('showcase.insured')}</Badge>
                        : <Badge tone="warn" icon="info" className="!border-transparent !bg-[#F59E0B]/20 !text-[#FCD34D]">{t('showcase.notInsured')}</Badge>}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-[13px]">
                {asset.facts.map((f, i) => <div key={i}><dt className="text-[11px] text-white/50">{tx(f.label)}</dt><dd className="font-semibold tabular-nums">{tx(f.value)}</dd></div>)}
                {policy && <div><dt className="text-[11px] text-white/50">{t('showcase.cover')}</dt><dd className="font-semibold tabular-nums">{money(policy.coverAmount)}</dd></div>}
              </dl>

              {policy ? (
                <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-black/25 p-2.5">
                  <InsurerMark id={policy.insurerId} size={34} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{tx(policy.product)}</p><p className="text-xs text-white/55">{lang === 'zh' ? insurerById(policy.insurerId).zh : insurerById(policy.insurerId).name} · {t('showcase.renews', { n: days })}</p></div>
                  <button type="button" onClick={openPolicy} className="min-h-[40px] shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-[#1D2943]">{t('showcase.openPolicy')}</button>
                </div>
              ) : (
                <button type="button" onClick={addCover} className="mt-3 min-h-control w-full rounded-control bg-[#3A5ECF] px-5 text-[15px] font-semibold text-white">{t('showcase.addCover')}</button>
              )}
              <p className="mt-2 text-center text-[11px] text-white/40">{index === 0 ? `${t('showcase.swipe')} · ` : ''}{t('showcase.hint')}</p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
