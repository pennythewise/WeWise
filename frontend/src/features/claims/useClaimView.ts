import { addDays, DEMO_TODAY } from '@/engine/l';
import type { Claim, TimelineStep } from '@/engine/types';
import { claimById } from '@/mock/claims';
import { useClaimStore } from './claimStore';

/** Claim with the live state of the S4 claim (clm_mei_001) overlaid on the static fixtures. */
export function useClaimView(id: string): { claim: Claim; timeline: TimelineStep[]; current?: TimelineStep['stage'] } | null {
  const base = claimById(id);
  const live = useClaimStore();
  if (!base) return null;
  if (id !== 'clm_mei_001') {
    const reached = base.timeline.filter((s) => s.at);
    return { claim: base, timeline: base.timeline, current: reached[reached.length - 1]?.stage };
  }
  const d = (n: number) => addDays(DEMO_TODAY, n);
  const t: TimelineStep[] = [...base.timeline.map((s) => ({ stage: s.stage }))];
  const set = (stage: TimelineStep['stage'], patch: Partial<TimelineStep>) => { const i = t.findIndex((x) => x.stage === stage); t[i] = { ...t[i], ...patch }; };
  if (live.status !== 'DRAFT') set('SUBMITTED', { at: d(0), actor: 'you', note: { en: 'Claim HM-CL-70418 sent with 4 documents', zh: '理赔 HM-CL-70418 已提交，附 4 份材料' } });
  if (live.status === 'INFO_REQUESTED' || live.status === 'IN_REVIEW') {
    set('DOCUMENT_REVIEW', { at: d(1), actor: 'insurer', note: { en: 'Documents received', zh: '材料已收到' } });
    set('INFO_REQUESTED', { at: d(3), actor: 'insurer', note: { en: 'The insurer needs an itemised pharmacy bill', zh: '保险公司需要药房费用明细账单' } });
  }
  if (live.status === 'IN_REVIEW') set('ASSESSMENT', { at: d(3), actor: 'ai', note: { en: 'You sent the pharmacy bill (found and drafted by the follow-up agent)', zh: '您已发送药房账单（由跟进助手查找并起草）' } });
  const reached = t.filter((s) => s.at);
  return { claim: { ...base, status: live.status, waitingOn: live.waitingOn }, timeline: t, current: reached[reached.length - 1]?.stage };
}
