import i18n from 'i18next';
import { useAgentStore } from '@/agentStore';
import { useExtractionStore } from './extractionStore';

/** Confirm all fields; the message states the correction so the agent's reply can acknowledge it (S1). */
export function confirmExtraction() {
  const { corrections, setConfirmed } = useExtractionStore.getState();
  setConfirmed(true);
  const fixed = corrections.annual_limit;
  const text = fixed ? i18n.t('cards.extract.confirmWithFix', { value: fixed }) : i18n.t('cards.extract.confirmPlain');
  void useAgentStore.getState().send(text, []);
}
