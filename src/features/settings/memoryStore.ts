import { create } from 'zustand';
import { INITIAL_MEMORY, type MemoryFact } from '@/mock/users';
import type { L } from '@/engine/l';

/** Long-term memory (F4), shared so other screens (e.g. report analysis) can add facts the user chooses to keep. */
interface MemoryState {
  facts: MemoryFact[];
  add: (text: L) => void;
  remove: (id: string) => void;
  reset: () => void;
}
export const useMemoryStore = create<MemoryState>((set) => ({
  facts: INITIAL_MEMORY,
  add: (text) => set((s) => (s.facts.some((f) => f.text.en === text.en) ? s : { facts: [...s.facts, { id: `mem_${s.facts.length}_${Date.now()}`, text }] })),
  remove: (id) => set((s) => ({ facts: s.facts.filter((f) => f.id !== id) })),
  reset: () => set({ facts: INITIAL_MEMORY }),
}));
