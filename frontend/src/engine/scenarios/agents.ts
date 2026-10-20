import { L } from '../l';
import { tool, type TimedEvent } from '../script';

/** The orchestrator's role-scoped specialists. Tool counts and context mirror backend/app/agent_foundation.py. */
export const SPECIALISTS = {
  policy_agent: { name: L('Policy agent', '保单智能体'), tools: 14, context: ['policy_id'] },
  claims_agent: { name: L('Claims agent', '理赔智能体'), tools: 10, context: ['claim_id'] },
  buying_agent: { name: L('Buying agent', '投保智能体'), tools: 7, context: [] as string[] },
  records_agent: { name: L('Records agent', '记录智能体'), tools: 3, context: [] as string[] },
} as const;
export type SpecialistId = keyof typeof SPECIALISTS;

/** Which specialist each scripted turn is delegated to. Attack turns stay with the orchestrator, which holds no tools. */
const TURN_AGENT: Record<string, SpecialistId> = {
  's1.upload': 'policy_agent', 's1.confirm': 'policy_agent', 's1.coverage': 'policy_agent', 's1.gaps': 'policy_agent', 's4.inject': 'policy_agent',
  's7.medical': 'policy_agent', 's7.finance': 'policy_agent', 's7.overlap': 'policy_agent', 's7.switch': 'policy_agent', 's6.colloquial': 'policy_agent', 's6.correct': 'policy_agent',
  's2.needs': 'buying_agent', 's2.compare': 'buying_agent', 'handoff.preview': 'buying_agent', 'shop.compare.ask': 'buying_agent', 'shop.compare.result': 'buying_agent',
  's3.prescreen': 'claims_agent', 's3.excluded': 'claims_agent', 's3.prepare': 'claims_agent', 's3.read_doc': 'claims_agent', 's3.validate': 'claims_agent', 's3.submitted': 'claims_agent',
  's3.advance': 'claims_agent', 's3.explain': 'claims_agent', 'incident.guide': 'claims_agent', 'party.connect': 'claims_agent', 'claim.agents': 'claims_agent', 'claim.followup': 'claims_agent',
  's7.cover': 'claims_agent', 's7.guide': 'claims_agent', 's7.guarantee': 'claims_agent', 's7.docs': 'claims_agent', 's7.fix': 'claims_agent', 's7.kit': 'claims_agent', 's7.status': 'claims_agent',
};

/** Orchestrator → specialist hand-off, shown before the specialist plans. */
export function delegationEvents(turnId: string, t0 = 180): TimedEvent[] {
  const agent = TURN_AGENT[turnId];
  if (!agent) return [];
  const s = SPECIALISTS[agent];
  return tool(t0, 'route_to_specialist', 'T0', { from: 'orchestrator', to: agent, tools_in_scope: s.tools, context: s.context },
    L(`Delegated to the ${s.name.en} · ${s.tools} tools in scope`, `已委派给${s.name.zh} · 可用 ${s.tools} 个工具`), 40);
}
