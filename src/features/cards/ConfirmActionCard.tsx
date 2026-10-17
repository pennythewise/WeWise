import { CardShell } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import type { Txt } from '@/engine/types';
import { useAgentStore } from '@/agentStore';
import { ConfirmPanel } from './ConfirmPanel';

interface Props { actionId: string; title: Txt; what: Txt; to: Txt; shared: Txt[]; payout?: string; expiresInSec: number }

export function ConfirmActionCard({ actionId, title, what, to, shared, payout, expiresInSec }: Props) {
  const { tx } = useTx();
  const state = useAgentStore((s) => s.actionStates[actionId] ?? 'pending');
  const running = useAgentStore((s) => s.running);
  return (
    <CardShell title={tx(title)} icon="lock" className="border-primary/40">
      <ConfirmPanel
        title={tx(title)} what={tx(what)} to={tx(to)} shared={shared.map(tx)} payout={payout} expiresInSec={expiresInSec} state={state} busy={running}
        onConfirm={() => void useAgentStore.getState().resolve(actionId, 'confirm')}
        onCancel={() => void useAgentStore.getState().resolve(actionId, 'reject')}
      />
    </CardShell>
  );
}
