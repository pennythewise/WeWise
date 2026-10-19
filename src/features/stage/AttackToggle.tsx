import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store';

/** Swaps the next turn for the adversarial variant (S5/S6) and highlights the Safety tab. */
export function AttackToggle() {
  const { t } = useTranslation();
  const { attack, setAttack, setInspectorTab } = useUiStore();
  return (
    <button type="button" role="switch" aria-checked={attack} title={t('stage.attackHint')}
      onClick={() => { setAttack(!attack); if (!attack) setInspectorTab('safety'); }}
      className={`min-h-[36px] rounded-control border px-3 text-[13px] font-medium ${attack ? 'border-danger bg-[var(--wb-danger-bg)] text-danger' : 'border-line bg-white text-ink'}`}>
      {t('stage.attack')}: {attack ? t('stage.on') : t('stage.off')}
    </button>
  );
}
