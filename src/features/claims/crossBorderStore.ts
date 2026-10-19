import { create } from 'zustand';
import { L } from '@/engine/l';
import type { TraceEvent, Txt } from '@/engine/types';

/** Milestones of the S3 cross-border claim. They are reached by what the agent actually does in the chat (see `syncCrossBorder`). */
export type XbKey = 'reported' | 'invited' | 'guarantee' | 'docs' | 'estimate' | 'kit';

export interface XbStep { key: XbKey | 'review' | 'payout'; label: Txt; actor: 'you' | 'ai' | 'insurer'; note: Txt }

/** Cross-border claims differ from domestic ones: the insurer's assistance team deals with the hospital first. */
export const XB_STEPS: XbStep[] = [
  { key: 'reported', label: L('Reported to the 24-hour assistance line', '已向 24 小时救援热线报案'), actor: 'you', note: L('Case TA-58213 opened', '已开立案件 TA-58213') },
  { key: 'invited', label: L('Hospital invited to the case, in Thai', '已用泰语邀请医院加入案件'), actor: 'ai', note: L('Secure link, only the items you ticked, masked', '安全链接，仅含您勾选且已脱敏的内容') },
  { key: 'guarantee', label: L('Insurer\'s assistance team contacted the hospital and issued a guarantee of payment', '保险公司救援团队已联系医院并出具付款担保'), actor: 'insurer', note: L('Direct billing: you should not need to pay covered items upfront', '直接结算：属于保障范围的费用通常无需您先行垫付') },
  { key: 'docs', label: L('Thai bill and discharge note read and translated', '泰文账单和出院小结已读取并翻译'), actor: 'ai', note: L('Originals kept as evidence', '原件保留作证据') },
  { key: 'estimate', label: L('Dates corrected and payout estimated', '日期已更正并估算赔付'), actor: 'you', note: L('210,000 THB ≈ ¥42,000 at the demo rate. An estimate, not a decision', '210,000 泰铢 ≈ ¥42,000（演示汇率），仅为估算，不是决定') },
  { key: 'kit', label: L('Claim kit ready for you to submit', '理赔资料包已备好，待您提交'), actor: 'you', note: L('Saved for download. Nothing was sent to the insurer', '已保存供下载，未发送给保险公司') },
  { key: 'review', label: L('Insurer reviews the documents and decides', '保险公司审核材料并作出决定'), actor: 'insurer', note: L('Only the insurer decides', '仅由保险公司决定') },
  { key: 'payout', label: L('Payment: settled with the hospital, any balance reimbursed to you', '付款：与医院直接结算，余额报销给您'), actor: 'insurer', note: L('If the hospital refuses a guarantee you pay and claim back with the originals', '若医院不接受担保，则由您先付费，凭原件事后报销') },
];

interface XbState {
  done: Partial<Record<XbKey, true>>;
  mark: (k: XbKey) => void;
  reset: () => void;
}

export const useCrossBorderStore = create<XbState>((set) => ({
  done: {},
  mark: (k) => set((s) => (s.done[k] ? s : { done: { ...s.done, [k]: true } })),
  reset: () => set({ done: {} }),
}));

/** Keeps the 理赔 entry in step with the S3 chat: each tool the agent runs moves the claim forward. */
export function syncCrossBorder(e: TraceEvent) {
  if (e.type !== 'tool.call') return;
  const { mark } = useCrossBorderStore.getState();
  const args = e.args as Record<string, unknown>;
  switch (e.tool) {
    case 'assistance_case_open': if (args.country === 'TH') mark('reported'); break;
    case 'party_invite': if (args.party === 'hospital') mark('invited'); break;
    case 'guarantee_letter_get': mark('guarantee'); break;
    case 'ocr_extract': if (args.lang === 'th') mark('docs'); break;
    case 'bill_check': if (args.rate_cny_per_thb) mark('estimate'); break;
    case 'crossborder_kit_export': mark('kit'); break;
  }
}
