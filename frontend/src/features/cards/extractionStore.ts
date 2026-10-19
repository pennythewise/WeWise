import { create } from 'zustand';

interface S {
  corrections: Record<string, string>;
  editing: string | null;
  confirmed: boolean;
  setCorrection: (k: string, v: string) => void;
  setEditing: (k: string | null) => void;
  setConfirmed: (v: boolean) => void;
  reset: () => void;
}
/** Shared so autoplay can drive the same correction the user would make. */
export const useExtractionStore = create<S>((set) => ({
  corrections: {}, editing: null, confirmed: false,
  setCorrection: (k, v) => set((s) => ({ corrections: { ...s.corrections, [k]: v } })),
  setEditing: (editing) => set({ editing }),
  setConfirmed: (confirmed) => set({ confirmed }),
  reset: () => set({ corrections: {}, editing: null, confirmed: false }),
}));
