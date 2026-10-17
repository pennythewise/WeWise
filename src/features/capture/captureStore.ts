import { create } from 'zustand';

export interface Shot { stepId: string; ok: boolean; time: string; reason?: 'early' }
interface S { shots: Shot[]; attached: boolean; add: (s: Shot) => void; retake: (stepId: string) => void; attach: () => void; reset: () => void }

export const useCaptureStore = create<S>((set) => ({
  shots: [], attached: false,
  add: (shot) => set((s) => ({ shots: [...s.shots.filter((x) => x.stepId !== shot.stepId), shot] })),
  retake: (stepId) => set((s) => ({ shots: s.shots.filter((x) => x.stepId !== stepId), attached: false })),
  attach: () => set({ attached: true }),
  reset: () => set({ shots: [], attached: false }),
}));
