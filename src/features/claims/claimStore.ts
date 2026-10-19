import { create } from 'zustand';
import { CLAIM_DOCS_TEMPLATE, type ClaimDoc } from '@/mock/claims';
import type { ClaimStatus } from '@/engine/types';

interface ClaimState {
  docs: ClaimDoc[];
  step: 1 | 2 | 3;
  status: ClaimStatus;
  waitingOn?: 'user' | 'insurer';
  submittedDay: number | null;
  daysAdvanced: number;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
  setStep: (s: 1 | 2 | 3) => void;
  uploadDoc: (id: string) => void;
  confirmDoc: (id: string) => void;
  correctField: (docId: string, key: string, value: string) => void;
  markSubmitted: () => void;
  addEvidence: (n: number) => void;
  advanceDays: (n: number) => void;
  replySent: () => void;
  /** Claim the follow-up agent is drafting a reply for, and claims whose reply was sent. */
  followupFor: string | null;
  sentReplies: string[];
  setFollowupFor: (id: string | null) => void;
  fillForm: () => void;
  reset: () => void;
}

const fresh = () => CLAIM_DOCS_TEMPLATE.map((d) => ({ ...d, fields: d.fields.map((f) => ({ ...f })) }));
export const isPrepared = (d: ClaimDoc) => d.state === 'recognised' || d.state === 'confirmed';
export const preparedCount = (docs: ClaimDoc[]) => docs.filter((d) => d.required && isPrepared(d)).length;
export const requiredCount = (docs: ClaimDoc[]) => docs.filter((d) => d.required).length;

/** Claim draft + status for clm_mei_001 (S3). Submitted state is a snapshot: later edits cannot change it. */
export const useClaimStore = create<ClaimState>((set) => ({
  docs: fresh(), step: 1, status: 'DRAFT', waitingOn: 'user', submittedDay: null, daysAdvanced: 0, sheetOpen: false,
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  setStep: (step) => set({ step }),
  uploadDoc: (id) => set((s) => ({
    docs: s.docs.map((d) => (d.id === id && d.sample ? { ...d, state: 'recognised', fields: d.sample.fields.map((f) => ({ ...f })), warning: d.sample.warning } : d)),
  })),
  // Confirming is blocked while an inconsistency warning is open.
  confirmDoc: (id) => set((s) => ({ docs: s.docs.map((d) => (d.id === id && !d.warning ? { ...d, state: 'confirmed' } : d)) })),
  // Any edit invalidates earlier confirmation (brand guideline: changing facts invalidates prior confirmation).
  correctField: (docId, key, value) => set((s) => ({
    docs: s.docs.map((d) => {
      if (d.id !== docId || s.status !== 'DRAFT') return d;
      const fields = d.fields.map((f) => (f.key === key ? { ...f, value } : f));
      const admit = fields.find((f) => f.key === 'admit')?.value;
      const dis = fields.find((f) => f.key === 'discharge')?.value;
      const warning = d.id === 'doc_discharge' && admit && dis && dis < admit ? d.warning : undefined;
      return { ...d, fields, warning, state: d.state === 'confirmed' ? 'recognised' : d.state };
    }),
  })),
  addEvidence: (n) => set((s) => (s.docs.some((d) => d.id === 'doc_evidence') ? s : { docs: [...s.docs, { id: 'doc_evidence', name: { en: `Evidence photos (${n})`, zh: `现场证据照片（${n} 张）` }, required: false, state: 'confirmed', fields: [] }] })),
  markSubmitted: () => set({ status: 'SUBMITTED', waitingOn: 'insurer', step: 3, submittedDay: 0 }),
  advanceDays: (n) => set((s) => (s.status === 'SUBMITTED' ? { status: 'INFO_REQUESTED', waitingOn: 'user', daysAdvanced: s.daysAdvanced + n } : s)),
  followupFor: null, sentReplies: [],
  setFollowupFor: (followupFor) => set({ followupFor }),
  replySent: () => set((s) => {
    const id = s.followupFor ?? 'clm_mei_001';
    const sentReplies = [...s.sentReplies, id];
    return id === 'clm_mei_001' && s.status === 'INFO_REQUESTED' ? { sentReplies, status: 'IN_REVIEW', waitingOn: 'insurer' } : { sentReplies };
  }),
  // Form filler agent: copies facts from the discharge summary and bill into the claim form (still needs the user's confirmation).
  fillForm: () => set((s) => ({
    docs: s.docs.map((d) => (d.id === 'doc_form' && !d.fields.some((f) => f.key === 'amount') ? {
      ...d, state: d.state === 'confirmed' ? 'recognised' : d.state,
      fields: [...d.fields,
        { key: 'admitted', label: { en: 'Admitted', zh: '入院' }, value: s.docs.find((x) => x.id === 'doc_discharge')?.fields.find((f) => f.key === 'admit')?.value ?? '2026-10-10' },
        { key: 'diagnosis', label: { en: 'Diagnosis', zh: '诊断' }, value: 'Dengue fever (A90)' },
        { key: 'hospital', label: { en: 'Hospital', zh: '医院' }, value: 'Shenzhen People\'s Hospital' },
        { key: 'amount', label: { en: 'Amount claimed', zh: '申请金额' }, value: '¥18,420' },
      ],
    } : d)),
  })),
  reset: () => set({ docs: fresh(), step: 1, status: 'DRAFT', waitingOn: 'user', submittedDay: null, daysAdvanced: 0, sheetOpen: false, followupFor: null, sentReplies: [] }),
}));
