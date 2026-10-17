import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store';
import { playScenario } from './autoplay';

/** Scenario switcher. Horizontal S1–S6 chips by default; `vertical` lists each scenario with its name and a one-line description. */
export function ScenarioPicker({ vertical = false }: { vertical?: boolean }) {
  const { t } = useTranslation();
  const { scenario } = useUiStore();
  if (vertical) {
    return (
      <div role="radiogroup" aria-label={t('stage.scenario')} className="flex flex-col gap-1">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={scenario === n} onClick={() => void playScenario(n)}
            className={`flex items-start gap-2.5 rounded-control px-2.5 py-2 text-left ${scenario === n ? 'bg-bluewash' : 'hover:bg-wash'}`}>
            <span className={`mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-[6px] text-[12px] font-semibold ${scenario === n ? 'bg-primary text-white' : 'bg-wash text-ink'}`}>S{n}</span>
            <span className="min-w-0">
              <span className={`block text-[13px] font-medium leading-snug ${scenario === n ? 'text-primary' : 'text-ink'}`}>{t(`stage.names.s${n}`)}</span>
              <span className="block text-xs leading-snug text-muted">{t(`stage.descs.s${n}`)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label={t('stage.scenario')} className="inline-flex rounded-control border border-line bg-white p-0.5">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={scenario === n} title={t(`stage.names.s${n}`)} aria-label={`S${n} ${t(`stage.names.s${n}`)}`}
          onClick={() => void playScenario(n)}
          className={`min-h-[36px] min-w-[36px] rounded-[7px] text-[13px] font-medium ${scenario === n ? 'bg-primary text-white' : 'text-ink hover:bg-wash'}`}>S{n}</button>
      ))}
    </div>
  );
}
