import { create } from 'zustand';

/** Which assistant message is currently being typed out, plus the ids already shown in full (so revisiting the chat does not replay them). */
interface TypingState { typingId: string | null; seen: Set<string>; setTyping: (id: string | null) => void; markSeen: (id: string) => void; reset: () => void }

export const useTypingStore = create<TypingState>((set, get) => ({
  typingId: null,
  seen: new Set(),
  setTyping: (typingId) => set({ typingId }),
  markSeen: (id) => { get().seen.add(id); },
  reset: () => set({ typingId: null, seen: new Set() }),
}));

/** Splits text into reveal steps: an English word with its trailing spaces, two Chinese characters, or a whole `[[HS-4.2]]` citation marker. */
export function tokenize(text: string): string[] {
  return text.match(/\[\[[^\]]+\]\]\s*|[^\s　-鿿＀-￯\[]+\s*|[　-鿿＀-￯]{1,2}\s*|\s+|\[/g) ?? [];
}
