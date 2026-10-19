import { useEffect } from 'react';
import { useUiStore } from '@/store';
import { nextStep, playScenario, resetAll, togglePlay } from './autoplay';

/** Space play/pause · → next step · R reset · 1–6 jump · A attack · I inspector (PRD §12). */
export function useStageShortcuts(showcase: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input,textarea,select,button,a,[contenteditable],[role=tab],[role=radio],[role=switch],[role=dialog]')) return;
      const ui = useUiStore.getState();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'r' || e.key === 'R') resetAll();
      else if (/^[1-6]$/.test(e.key)) void playScenario(Number(e.key));
      else if (e.key === 'a' || e.key === 'A') { ui.setAttack(!ui.attack); if (!ui.attack) ui.setInspectorTab('safety'); }
      else if ((e.key === 'i' || e.key === 'I') && !showcase) ui.setInspectorOpen(!ui.inspectorOpen);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showcase]);
}
