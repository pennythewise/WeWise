import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, type IconName } from '@/components/AppIcon';
import { ScenarioPicker } from '@/features/stage/ScenarioPicker';
import { useUiStore } from '@/store';
import logo from '@/assets/webank-logo.png';

export type NavVariant = 'full' | 'rail' | 'sheet';

interface Item { key: string; icon: IconName; to?: string; active?: boolean }

const ITEMS: Item[] = [
  { key: 'bankHome', icon: 'home' },
  { key: 'insurance', icon: 'shield' },
  { key: 'buy', icon: 'umbrella' },
  { key: 'policiesClaims', icon: 'wallet', active: true, to: '/' },
  { key: 'team', icon: 'user', to: '/about' },
];

/** Website-level navigation (bank site sections). Distinct from the in-app bottom tab bar. */
export function WebsiteNav({ variant, onNavigate }: { variant: NavVariant; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { record } = useUiStore();
  const onAbout = pathname === '/about';
  const rail = variant === 'rail';
  // Phone: "About the team" moves to the sheet footer (PRD §2.4).
  const main = variant === 'sheet' ? ITEMS.filter((i) => i.key !== 'team') : ITEMS;

  const row = (item: Item, current: boolean) =>
    `flex min-h-touch items-center gap-3 rounded-control px-3 text-[15px] ${rail ? 'justify-center px-0' : ''} ${
      current ? 'bg-bluewash font-semibold text-primary' : 'text-ink'
    } ${item.to ? 'hover:bg-wash' : 'cursor-not-allowed text-muted'}`;

  const content = (item: Item) => (
    <>
      <AppIcon name={item.icon} size={rail ? 24 : 22} />
      {!rail && <span>{t(`nav.${item.key}`)}</span>}
      {rail && <span className="sr-only">{t(`nav.${item.key}`)}</span>}
    </>
  );

  const isCurrent = (item: Item) => (item.key === 'team' ? onAbout : item.key === 'policiesClaims' ? !onAbout : false);

  return (
    <nav aria-label={t("nav.label")} className={`flex flex-col bg-white ${variant === "sheet" ? "" : "h-full"}`}>
      {variant !== 'sheet' && (
        <div className={`flex shrink-0 items-center border-b border-cardline ${rail ? 'justify-center py-4' : 'px-5 py-4'}`}>
          {rail ? (
            <span className="text-brand" title={t('brand.name')}><AppIcon name="shield" size={27} /></span>
          ) : (
            <img src={logo} alt="WeBank 微众银行" width={170} className="h-auto w-[170px] object-contain" />
          )}
        </div>
      )}
      {variant === 'sheet' && (
        <div className="shrink-0 px-5 py-4">
          <img src={logo} alt="WeBank 微众银行" width={170} className="h-auto w-[170px] object-contain" />
        </div>
      )}

      {/* Desktop and tablet sidebars show only the logo and the scenario list; the phone menu keeps the site sections. */}
      {variant === 'sheet' && <ul className={`flex flex-col gap-1 ${rail ? 'p-2' : 'p-3'}`}>
        {main.map((item) => {
          const current = isCurrent(item);
          return (
            <li key={item.key}>
              {item.to ? (
                <NavLink to={item.to} onClick={onNavigate} aria-current={current ? 'page' : undefined} className={row(item, current)} title={rail ? t(`nav.${item.key}`) : undefined}>
                  {content(item)}
                </NavLink>
              ) : (
                <button type="button" aria-disabled="true" title={t('nav.notInDemo')} className={`${row(item, false)} w-full text-left`}>
                  {content(item)}
                </button>
              )}
            </li>
          );
        })}
      </ul>}

      {variant === 'sheet' && (
        <ul className="border-t border-cardline p-3">
          <li>
            <NavLink to="/about" onClick={onNavigate} aria-current={onAbout ? 'page' : undefined} className={row({ key: 'team', icon: 'user', to: '/about' }, onAbout)}>
              <AppIcon name="user" />
              <span>{t('screens.about.title')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/memory" onClick={onNavigate} className={row({ key: 'memory', icon: 'lock', to: '/memory' }, pathname === '/memory')}>
              <AppIcon name="lock" />
              <span>{t('screens.memory.title')}</span>
            </NavLink>
          </li>
        </ul>
      )}

      {variant === 'full' && !record && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <h2 className="px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t('stage.scenario')}</h2>
          <ScenarioPicker vertical />
        </div>
      )}

      {variant === 'full' && (
        <p className="mt-auto px-5 pb-5 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-brand">{t('brand.name')}</span>
          <br />
          {t('brand.tagline')}
        </p>
      )}
    </nav>
  );
}
