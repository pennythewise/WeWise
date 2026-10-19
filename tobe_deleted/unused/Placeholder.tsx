import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, type ScreenKey } from '@/app/routes';
import { AppIcon } from './AppIcon';

/** Phase 1 screen stub: title, one-line description, PRD section, links to related screens. */
export function Placeholder({ screen, links = [] }: { screen: ScreenKey; links?: ScreenKey[] }) {
  const { t } = useTranslation();
  const meta = ROUTES.find((r) => r.key === screen)!;
  return (
    <section className="card space-y-3" data-screen={screen}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('screens.placeholder')}</p>
      <h2 className="text-[21px] font-semibold leading-snug text-ink">{t(`screens.${screen}.title`)}</h2>
      <p className="text-sm leading-[1.8] text-body">{t(`screens.${screen}.desc`)}</p>
      <p className="inline-flex rounded-input bg-bluewash px-2.5 py-1 text-xs font-medium text-brand">
        {t('screens.prdRef', { ref: `Frontend ${meta.prd}` })}
      </p>
      {links.length > 0 && (
        <ul className="divide-y divide-cardline border-t border-cardline pt-1">
          {links.map((k) => {
            const target = ROUTES.find((r) => r.key === k)!;
            return (
              <li key={k}>
                <Link to={target.href} className="flex min-h-touch items-center justify-between text-sm font-medium text-primary">
                  {t(`screens.${k}.title`)}
                  <AppIcon name="chevron" size={16} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
