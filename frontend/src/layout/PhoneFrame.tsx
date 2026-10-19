import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { matchRoute } from '@/app/routes';
import { AppHeader } from './AppHeader';
import { TabBar } from './TabBar';
import { ToastHost } from './ToastHost';
import type { LayoutMode } from './useBreakpoint';

/**
 * The real app column. Never wider than 430px in any mode.
 * Showcase/tablet: rounded "device card" (no fake bezel). Phone: full-bleed.
 */
export function PhoneFrame({ mode }: { mode: LayoutMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meta = matchRoute(useLocation().pathname);
  const key = meta.key;
  const immersive = !!meta.immersive;
  const card = mode !== 'phone';
  const screen = (
    <div
      data-testid="app-column"
      className={`app-col relative flex h-full w-[min(100%,var(--app-max-width))] flex-col overflow-hidden bg-white ${card ? 'w-full rounded-[38px]' : 'border-x border-cardline'}`}
    >
      {card && <StatusBar dark={immersive} />}
      {!immersive && <AppHeader mode={mode} />}
      <main className={`min-h-0 flex-1 bg-wash ${key === 'ask' || immersive ? 'overflow-hidden' : 'overflow-y-auto px-4 py-4'}`}>
        <Outlet />
      </main>
      {!immersive && <TabBar />}
      <ToastHost />
      {key === 'home' && (
        <button type="button" onClick={() => navigate('/emergency')} className="absolute bottom-[calc(var(--tabbar-height)+16px)] right-4 z-20 inline-flex min-h-touch items-center gap-2 rounded-full bg-danger px-4 text-[14px] font-semibold text-white shadow-card">
          <AppIcon name="bell" size={18} />{t('emergency.fab')}
        </button>
      )}
      {card && <div aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-1 w-32 -translate-x-1/2 rounded-full bg-ink/80" />}
    </div>
  );
  if (!card) return screen;
  return <ScaledDevice>{screen}</ScaledDevice>;
}

const DEVICE_W = 410; // 390pt screen + 10px bezel each side
const DEVICE_H = 864; // 844pt screen + bezel (iPhone 14 proportions)

/**
 * Lays the app out at a fixed 390x844 logical size and scales the whole device to fit the space available,
 * so text and cards never reflow on short or narrow windows.
 */
function ScaledDevice({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / DEVICE_W, el.clientHeight / DEVICE_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={host} className="flex h-full w-full items-center justify-center">
      <div style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }} className="shrink-0">
        <div className="relative origin-top-left" style={{ width: DEVICE_W, height: DEVICE_H, transform: `scale(${scale})` }} data-testid="phone-device">
          <span aria-hidden="true" className="absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l bg-[#2B2F3A]" />
          <span aria-hidden="true" className="absolute -left-[3px] top-[160px] h-14 w-[3px] rounded-l bg-[#2B2F3A]" />
          <span aria-hidden="true" className="absolute -left-[3px] top-[228px] h-14 w-[3px] rounded-l bg-[#2B2F3A]" />
          <span aria-hidden="true" className="absolute -right-[3px] top-[170px] h-20 w-[3px] rounded-r bg-[#2B2F3A]" />
          <div className="h-full rounded-[50px] bg-[#0B0D12] p-[10px] shadow-[0_0_0_2px_#3A3F4B,0_30px_60px_-15px_rgba(15,23,42,0.45)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** iOS-style status bar with the dynamic island. Decorative. */
function StatusBar({ dark }: { dark: boolean }) {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  return (
    <div aria-hidden="true" className={`relative flex h-[46px] shrink-0 items-end justify-between px-7 pb-1.5 text-[14px] font-semibold ${dark ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
      <span className="tabular-nums">{time}</span>
      <span className="absolute left-1/2 top-2 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-[#0B0D12]" />
      <span className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" /><rect x="23" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" /></svg>
      </span>
    </div>
  );
}
