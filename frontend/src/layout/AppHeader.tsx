import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { matchRoute } from '@/app/routes';
import type { LayoutMode } from './useBreakpoint';
import { useUiStore } from '@/store';

/** In-app header: ☰ (phone) / back, title, ⓘ (phone). */
export function AppHeader({ mode }: { mode: LayoutMode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const meta = matchRoute(pathname);
  const { setNavSheetOpen, setInspectorOpen } = useUiStore();
  const phone = mode === 'phone';

  return (
    <header className="shrink-0 border-b border-cardline bg-white">
      <div className="flex min-h-[53px] items-center gap-1 px-2">
        {phone && (
          <button type="button" className="icon-btn" aria-label={t('nav.open')} onClick={() => setNavSheetOpen(true)}>
            <span aria-hidden="true" className="text-[22px] leading-none">☰</span>
          </button>
        )}
        {meta.parent && (
          <Link to={meta.parent} className="icon-btn" aria-label={t('header.back')}>
            <AppIcon name="back" />
          </Link>
        )}
        <h1 className={`min-w-0 flex-1 py-1 text-[17px] font-semibold leading-tight text-ink ${phone || meta.parent ? '' : 'pl-3'}`}>
          {t(`screens.${meta.key}.title`)}
        </h1>
        {phone && (
          <button type="button" className="icon-btn text-primary" aria-label={t('header.inspector')} onClick={() => setInspectorOpen(true)}>
            <AppIcon name="info" />
          </button>
        )}
      </div>
    </header>
  );
}
