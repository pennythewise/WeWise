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
  return (
    <div
      data-testid="app-column"
      className={`app-col relative flex h-full w-[min(100%,var(--app-max-width))] flex-col overflow-hidden bg-white ${card ? 'rounded-shell border border-cardline shadow-card' : 'border-x border-cardline'}`}
    >
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
    </div>
  );
}
