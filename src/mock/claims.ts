import { L } from '@/engine/l';
import type { Claim } from '@/engine/types';

export const CLAIMS: Claim[] = [
  {
    // S3: cross-border claim. Prepared with the agent, not yet submitted to the insurer.
    id: 'clm_mei_004', policyId: 'pol_mei_travel_01', status: 'DRAFT', title: L('Dengue hospitalisation, Phuket (Thailand)', '登革热住院，泰国普吉'), updated: '2026-12-25', waitingOn: 'user',
    timeline: [
      { stage: 'SUBMITTED' }, { stage: 'DOCUMENT_REVIEW' }, { stage: 'INFO_REQUESTED' }, { stage: 'ASSESSMENT' }, { stage: 'DECISION' }, { stage: 'PAYOUT' },
    ],
  },
  {
    id: 'clm_mei_001', policyId: 'pol_mei_health_01', status: 'DRAFT', title: L('Dengue hospitalisation, admitted 10 Oct', '登革热住院，10 月 10 日入院'), updated: '2026-10-14', waitingOn: 'user',
    timeline: [
      { stage: 'SUBMITTED' }, { stage: 'DOCUMENT_REVIEW' }, { stage: 'INFO_REQUESTED' }, { stage: 'ASSESSMENT' }, { stage: 'DECISION' }, { stage: 'PAYOUT' },
    ],
  },
  {
    id: 'clm_mei_002', policyId: 'pol_mei_pa_01', status: 'INFO_REQUESTED', title: L('Ankle fracture treatment', '脚踝骨折治疗'), updated: '2026-10-09', waitingOn: 'user',
    timeline: [
      { stage: 'SUBMITTED', at: '2026-10-02', actor: 'you', note: L('Claim sent with 4 documents', '已提交理赔，附 4 份材料') },
      { stage: 'DOCUMENT_REVIEW', at: '2026-10-05', actor: 'insurer', note: L('Documents received', '材料已收到') },
      { stage: 'INFO_REQUESTED', at: '2026-10-09', actor: 'insurer', note: L('The insurer needs an itemised bill from the clinic', '保险公司需要诊所出具的费用明细账单') },
      { stage: 'ASSESSMENT' }, { stage: 'DECISION' }, { stage: 'PAYOUT' },
    ],
  },
  {
    id: 'clm_mei_003', policyId: 'pol_mei_health_01', status: 'DECLINED', title: L('Illness treatment, Dec 2025', '2025 年 12 月疾病治疗'), updated: '2026-01-22',
    timeline: [
      { stage: 'SUBMITTED', at: '2026-01-06', actor: 'you', note: L('Claim sent', '已提交理赔') },
      { stage: 'DOCUMENT_REVIEW', at: '2026-01-09', actor: 'insurer' },
      { stage: 'ASSESSMENT', at: '2026-01-15', actor: 'insurer', note: L('Waiting period checked against symptom date', '已按症状出现日期核对等待期') },
      { stage: 'DECISION', at: '2026-01-22', actor: 'insurer', note: L('Declined: illness began within the waiting period', '已拒赔：疾病始于等待期内') },
    ],
    decline: {
      clauseId: 'HS-4.2',
      reason: L('Your symptoms began on 20 Dec 2025, which is 25 days after the policy started on 25 Nov 2025. The waiting period for illness is 90 days.', '您的症状始于 2025 年 12 月 20 日，距保单 2025 年 11 月 25 日生效仅 25 天，而疾病等待期为 90 天。'),
      quote: L('No benefit is payable for any illness that first shows symptoms or is diagnosed within 90 days of the policy inception date.', '自保单生效日起 90 天内首次出现症状或确诊的任何疾病，不予赔付。'),
    },
  },
];
export const claimById = (id: string) => CLAIMS.find((c) => c.id === id);

export type DocState = 'toAdd' | 'recognised' | 'confirmed' | 'optional';
export interface DocField { key: string; label: L; value: string; page?: number }
export interface ClaimDoc {
  id: string; name: L; required: boolean; state: DocState;
  fields: DocField[]; warning?: L;
  /** Demo document that gets "uploaded" for this row. */
  sample?: { fields: DocField[]; warning?: L };
}

/** Starting checklist for the S4 claim: 3 of 5 prepared, 2 to add (PRD §6.8 "3 / 5"). */
export const CLAIM_DOCS_TEMPLATE: ClaimDoc[] = [
  { id: 'doc_form', name: L('Claim form', '理赔申请表'), required: true, state: 'recognised', fields: [{ key: 'claimant', label: L('Claimant', '申请人'), value: 'M** L** T**' }, { key: 'policy', label: L('Policy', '保单'), value: 'HM-2025-48****91' }] },
  { id: 'doc_id', name: L('Identity document', '身份证明'), required: true, state: 'confirmed', fields: [{ key: 'name', label: L('Name', '姓名'), value: 'M** L** T**' }] },
  { id: 'doc_bank', name: L('Payout account (insurer file)', '赔款账户（保险公司档案）'), required: true, state: 'confirmed', fields: [{ key: 'acct', label: L('Account', '账户'), value: '•••• •••• 4821' }] },
  {
    id: 'doc_discharge', name: L('Discharge summary', '出院小结'), required: true, state: 'toAdd', fields: [],
    sample: {
      fields: [
        { key: 'patient', label: L('Patient', '患者'), value: 'M** L** T**', page: 1 },
        { key: 'admit', label: L('Admission date', '入院日期'), value: '2026-10-10', page: 1 },
        { key: 'discharge', label: L('Discharge date', '出院日期'), value: '2026-10-08', page: 1 },
        { key: 'dx', label: L('Diagnosis', '诊断'), value: 'Dengue fever (A90)', page: 2 },
      ],
      warning: L('The discharge date (8 Oct) is earlier than the admission date (10 Oct). Please check the date on the document.', '出院日期（10 月 8 日）早于入院日期（10 月 10 日），请核对文件上的日期。'),
    },
  },
  {
    id: 'doc_bill', name: L('Itemised hospital bill', '医院费用明细账单'), required: true, state: 'toAdd', fields: [],
    sample: {
      fields: [
        { key: 'total', label: L('Total charges', '总费用'), value: '¥18,420', page: 1 },
        { key: 'room', label: L('Room (3 nights)', '房费（3 晚）'), value: '¥1,500', page: 1 },
        { key: 'hospital', label: L('Hospital', '医院'), value: 'Shenzhen People\'s Hospital', page: 1 },
      ],
    },
  },
  { id: 'doc_referral', name: L('Doctor referral letter', '医生转诊信'), required: false, state: 'optional', fields: [] },
];
