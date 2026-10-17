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
  reset: () => set({ docs: fresh(), step: 1, status: 'DRAFT', waitingOn: 'user', submittedDay: null, daysAdvanced: 0, sheetOpen: false }),
}));
