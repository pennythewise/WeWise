import { useState } from 'react';
import { L, type L as LT } from '@/engine/l';
import { AppIcon, type IconName } from '@/components/AppIcon';
import { Badge, CardShell, Skeleton } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { ConfirmActionCard } from '../cards/ConfirmActionCard';
import { claimActions, findConfirmCard } from './claimActions';
import { useClaimStore } from './claimStore';

type State = 'idle' | 'running' | 'done' | 'attention';
type AgentId = 'collect' | 'check' | 'bill' | 'form' | 'chase';
const AGENTS: { id: AgentId; icon: IconName; name: LT; job: LT }[] = [
  { id: 'collect', icon: 'file', name: L('Document collector', '材料收集'), job: L('Fetches the discharge summary and bill from the hospital\'s e-portal', '从医院电子平台获取出院小结和账单') },
  { id: 'check', icon: 'search', name: L('Consistency checker', '一致性检查'), job: L('Cross-checks names, dates and amounts', '交叉核对姓名、日期和金额') },
  { id: 'bill', icon: 'coins', name: L('Bill checker', '账单检查'), job: L('Checks charges against your limits', '对照限额检查费用') },
  { id: 'form', icon: 'scan', name: L('Form filler', '表单填写'), job: L('Fills the claim form from your documents', '根据材料填写理赔表') },
  { id: 'chase', icon: 'bell', name: L('Document chaser', '材料催办'), job: L('Drafts requests for anything missing', '为缺失材料起草请求') },
];

function AgentRow({ a, state, result }: { a: (typeof AGENTS)[number]; state: State; result?: LT }) {
  const { tx } = useTx();
  return (
    <li className="flex gap-3 py-2.5" data-agent={a.id}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${state === 'attention' ? 'bg-[#FFF6E5] text-warn' : state === 'done' ? 'bg-[#E8F5EE] text-ok' : 'bg-bluewash text-brand'}`}>
        <AppIcon name={state === 'done' ? 'check' : a.icon} size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-ink">{tx(a.name)}</p>
          {state === 'running' && <Badge tone="info" icon="clock">{tx(L('Working', '处理中'))}</Badge>}
          {state === 'done' && <Badge tone="ok" icon="check">{tx(L('Done · review', '完成 · 待核对'))}</Badge>}
          {state === 'attention' && <Badge tone="warn" icon="info">{tx(L('Needs you', '需要您处理'))}</Badge>}
        </div>
        <p className="text-[13px] text-body">{result ? tx(result) : tx(a.job)}</p>
      </div>
    </li>
  );
}

/** AI agents that take over the repetitive parts of preparing a claim. They only prepare; the user confirms each document and the submission. */
export function ClaimAgents() {
  const { tx } = useTx();
  const [states, setStates] = useState<Record<AgentId, State>>({ collect: 'idle', check: 'idle', bill: 'idle', form: 'idle', chase: 'idle' });
  const [results, setResults] = useState<Partial<Record<AgentId, LT>>>({});
  const running = useAgentStore((s) => s.running);
  const started = Object.values(states).some((s) => s !== 'idle');
  const busy = Object.values(states).some((s) => s === 'running');

  const run = async () => {
    const claim = useClaimStore.getState();
    setStates((s) => ({ ...s, collect: 'running' }));
    for (const id of ['doc_discharge', 'doc_bill']) if (useClaimStore.getState().docs.find((d) => d.id === id)?.state === 'toAdd') await claimActions.upload(id);
    setStates((s) => ({ ...s, collect: 'done' }));
    setResults((r) => ({ ...r, collect: L('Fetched the discharge summary and itemised bill from Shenzhen People\'s Hospital.', '已从深圳市人民医院获取出院小结和费用明细账单。') }));
    setStates((s) => ({ ...s, check: 'running', bill: 'running', form: 'running', chase: 'running' }));
    claim.fillForm();
    const issue = !!useClaimStore.getState().docs.find((d) => d.id === 'doc_discharge')?.warning;
    await useAgentStore.getState().runTurn('claim.agents', issue ? 'issue' : 'ok');
    setStates({ collect: 'done', check: issue ? 'attention' : 'done', bill: 'done', form: 'done', chase: 'done' });
    setResults((r) => ({
      ...r,
      check: issue ? L('Found 1 issue: the discharge date is before the admission date. Please fix it below.', '发现 1 处问题：出院日期早于入院日期，请在下方更正。') : L('Names, dates and amounts match across documents.', '各材料的姓名、日期和金额一致。'),
      bill: L('Room ¥500 a night is within your ¥500/day cap. Estimated payout about ¥6,736 after the ¥10,000 deductible and 20% co-pay.', '房费每晚 ¥500，未超每日 ¥500 上限。扣除 ¥10,000 自付额及 20% 共付后，预计赔付约 ¥6,736。'),
      form: L('Filled 4 fields on the claim form. Please confirm it below.', '已在理赔表中填写 4 个字段，请在下方确认。'),
      chase: L('Drafted a request for the optional referral letter. Not needed to submit.', '已起草可选转诊信的请求，非提交必需。'),
    }));
  };

  return (
    <CardShell title={tx(L('Let AI agents do the paperwork', '让 AI 助手处理繁琐工作'))} icon="spark" right={started && !busy ? <Badge tone="ok">{tx(L('Ready for review', '待您核对'))}</Badge> : undefined}>
      <ul className="-my-2 divide-y divide-cardline">{AGENTS.map((a) => <AgentRow key={a.id} a={a} state={states[a.id]} result={results[a.id]} />)}</ul>
      {!started && (
        <>
          <p className="mt-2 text-xs text-muted">{tx(L('Agents only read and prepare. You confirm every document, and nothing reaches the insurer until you submit.', '助手只负责读取和准备。每份材料都由您确认，在您提交前不会发送给保险公司。'))}</p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={running} onClick={() => void run()} data-testid="run-agents"><AppIcon name="spark" size={18} />{tx(L('Run the agents', '启动助手'))}</button>
        </>
      )}
    </CardShell>
  );
}

/** Follow-up agent for a claim where the insurer asked for more information: finds the document and drafts the reply. */
export function FollowUpAgent({ claimId }: { claimId: string }) {
  const { tx } = useTx();
  const [phase, setPhase] = useState<'idle' | 'drafting' | 'ready'>('idle');
  const sent = useClaimStore((s) => s.sentReplies.includes(claimId));
  const state = useAgentStore((s) => s.actionStates.act_followup_send);
  const running = useAgentStore((s) => s.running);
  useAgentStore((s) => s.messages);
  const card = phase === 'ready' ? findConfirmCard('act_followup_send') : null;

  const start = async () => {
    setPhase('drafting');
    useClaimStore.getState().setFollowupFor(claimId);
    useAgentStore.setState((s) => ({ actionStates: { ...s.actionStates, act_followup_send: 'pending' } }));
    await useAgentStore.getState().runTurn('claim.followup', claimId);
    setPhase('ready');
  };

  if (sent) return <CardShell title={tx(L('Follow-up agent', '跟进助手'))} icon="spark"><p className="flex items-center gap-2 text-[14px] text-ok"><AppIcon name="check" size={18} />{tx(L('Reply sent. The insurer is reviewing your claim again.', '回复已发送，保险公司正在重新审核您的理赔。'))}</p></CardShell>;

  return (
    <CardShell title={tx(L('Follow-up agent', '跟进助手'))} icon="spark">
      {phase === 'idle' && (
        <>
          <p className="text-[13px] leading-relaxed text-body">{tx(L('The insurer asked for an itemised bill. I can find it in your e-receipts and draft the reply for you to check.', '保险公司需要费用明细账单。我可以从您的电子收据中找到它，并起草回复供您核对。'))}</p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={running} onClick={() => void start()} data-testid="run-followup"><AppIcon name="spark" size={18} />{tx(L('Find it and draft my reply', '查找材料并起草回复'))}</button>
        </>
      )}
      {phase === 'drafting' && <div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-16" /></div>}
      {phase === 'ready' && card && <ConfirmActionCard {...card.data} />}
      {phase === 'ready' && state === 'rejected' && <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setPhase('idle')}>{tx(L('Start again', '重新开始'))}</button>}
    </CardShell>
  );
}
