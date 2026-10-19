import { useAgentStore } from '@/agentStore';
import { useClaimStore } from './claimStore';

/** UI-driven claim steps. Each one also plays a scripted turn so the Inspector shows the tool calls. */
export const claimActions = {
  async upload(docId: string) {
    useClaimStore.getState().uploadDoc(docId);
    await useAgentStore.getState().runTurn('s3.read_doc', docId === 'doc_discharge' ? 'discharge' : 'bill');
  },
  async validate() {
    await useAgentStore.getState().runTurn('s3.validate');
  },
};

/** Latest ConfirmActionCard for an action, if the agent has produced one. */
export function findConfirmCard(actionId: string) {
  const msgs = useAgentStore.getState().messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const c = msgs[i].cards.find((x) => x.kind === 'ConfirmActionCard' && x.data.actionId === actionId);
    if (c && c.kind === 'ConfirmActionCard') return c;
  }
  return null;
}
