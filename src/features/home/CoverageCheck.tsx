import { useNavigate } from 'react-router-dom';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { OverlapReportCard } from '../cards/OverlapReportCard';

/** Overlaps & gaps screen (PRD D2): the same matrix the agent shows in chat, with a gig-work switch. */
export function CoverageCheck() {
  const { tx } = useTx();
  const navigate = useNavigate();
  const ask = (text: string) => { useAgentStore.getState().setDraft(text); navigate('/ask'); };
  return (
    <div className="space-y-4" data-screen="coverageCheck">
      <p className="text-[13px] leading-relaxed text-body">{tx(L('Your five policies from four insurers, side by side. Overlaps are not always bad, and gaps are where a claim would surprise you.', '并排查看您来自四家保险公司的五份保单。重叠不一定是坏事，缺口才是理赔时可能让您意外的地方。'))}</p>
      <OverlapReportCard />
      <button type="button" className="btn-secondary w-full" onClick={() => ask(tx(L('Talk to a licensed agent', '联系持牌顾问')))}>{tx(L('Discuss these gaps with a licensed agent', '与持牌顾问讨论这些缺口'))}</button>
    </div>
  );
}
