import { useTranslation } from 'react-i18next';
import type { Txt } from '@/engine/types';
import { CardShell, Notice } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';

export function EscalationCard({ reason }: { reason: Txt }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const running = useAgentStore((s) => s.running);
  return (
    <CardShell title={t('cards.escalation.title')} icon="user">
      <Notice tone="info">{tx(reason)}</Notice>
      <button type="button" disabled={running} className="btn-primary mt-3 w-full" onClick={() => void useAgentStore.getState().send(t('cards.verdict.talkSend'))}>{t('cards.verdict.talk')}</button>
    </CardShell>
  );
}
