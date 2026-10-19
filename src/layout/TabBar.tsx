import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { matchRoute, TABS } from '@/app/routes';
import { useClaimStore } from '@/features/claims/claimStore';

/** In-app navigation: Home · Policies · Claims · Ask WeWise. */
export function TabBar() {
  const { t } = useTranslation();
  const active = matchRoute(useLocation().pathname).tab;
  const status = useClaimStore((s) => s.status);
  // Claims awaiting the user: the live S4 claim (draft or info requested) + the static INFO_REQUESTED claim.
  const awaiting = (status === 'DRAFT' || status === 'INFO_REQUESTED' ? 1 : 0) + 1;
  return (
    <nav
      aria-label={t('tabs.label')}
      className="shrink-0 border-t border-cardline bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-[var(--tabbar-height)] grid-cols-4">
        {TABS.map((tab) => {
          const on = active === tab.id;
          return (
            <li key={tab.id} className="min-w-0">
              <NavLink
                to={tab.to}
                aria-current={on ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 px-1 text-center text-xs ${on ? 'font-semibold text-primary' : 'text-muted'}`}
              >
                <span className="relative">
                  <AppIcon name={tab.icon} size={24} filled={on} />
                  {tab.id === 'claims' && awaiting > 0 && <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white" aria-label={t('tabs.awaiting', { n: awaiting })}>{awaiting}</span>}
                </span>
                <span className="leading-tight">{t(`tabs.${tab.id}`)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
