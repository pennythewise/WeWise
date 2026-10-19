import { useEffect, useMemo, useState } from 'react';
import { useUiStore } from '@/store';
import { tokenize, useTypingStore } from './typingStore';

const TICK_MS = 34;
/** Types the segments out token by token, like a model streaming. Skipped at high stage speed, with reduced motion, or once the message has been shown. */
export function useTypedReveal(id: string, segments: string[], enabled: boolean) {
  const speed = useUiStore((s) => s.speed);
  const seen = useTypingStore((s) => s.seen.has(id));
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const active = enabled && !seen && speed < 50 && !reduce;
  const tokens = useMemo(() => segments.map(tokenize), [segments.join('\u0000')]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = tokens.reduce((a, t) => a + t.length, 0);
  const [n, setN] = useState(0);
  const done = !active || n >= total;
  useEffect(() => {
    if (!active) return;
    useTypingStore.getState().setTyping(id);
    const h = setInterval(() => setN((x) => x + 1), TICK_MS / speed);
    return () => { clearInterval(h); if (useTypingStore.getState().typingId === id) useTypingStore.getState().setTyping(null); };
  }, [active, id, speed]);
  useEffect(() => {
    if (enabled && active && total > 0 && n >= total) { const st = useTypingStore.getState(); st.markSeen(id); if (st.typingId === id) st.setTyping(null); }
  }, [enabled, active, n, total, id]);
  let left = n;
  const visible = tokens.map((t, i) => { const k = Math.max(0, Math.min(t.length, left)); left -= t.length; return done ? segments[i] : t.slice(0, k).join(''); });
  const current = done ? -1 : visible.findIndex((v, i) => v.length < segments[i].length);
  return { visible, done, current };
}
