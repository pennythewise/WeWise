import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useUiStore } from '@/store';
import { tokenize, useTypingStore } from '../chat/typingStore';

type Item =
  | { kind: 'text'; node: Text; tokens: string[]; orig: string; last: string }
  | { kind: 'leaf'; el: HTMLElement | SVGElement; prev: string };

const TICK_MS = 28;
const MAX_TICKS = 70;

/**
 * Builds a card up like generated output: its text types out in reading order and its visual elements
 * (bars, dots, icons) appear as the text reaches them. Works on the rendered DOM so no card needs changes.
 * Skipped at high stage speed, with reduced motion, or once the card has been shown.
 */
export function GenerativeReveal({ id, children }: { id: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const speed = useUiStore((s) => s.speed);

  useLayoutEffect(() => {
    const el = root.current;
    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || speed >= 50 || reduce || useTypingStore.getState().seen.has(id)) return;

    const items: Item[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n as Text;
        if (t.data.trim()) items.push({ kind: 'text', node: t, tokens: tokenize(t.data), orig: t.data, last: t.data });
      } else {
        const e = n as HTMLElement;
        if (e.childNodes.length === 0 && !['BR', 'INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName)) items.push({ kind: 'leaf', el: e, prev: e.style.visibility });
      }
    }
    const total = items.reduce((a, i) => a + (i.kind === 'text' ? i.tokens.length : 1), 0);
    if (total === 0) return;
    const step = Math.max(1, Math.ceil(total / MAX_TICKS));

    const render = (shown: number) => {
      let left = shown;
      for (const it of items) {
        if (it.kind === 'text') {
          const k = Math.max(0, Math.min(it.tokens.length, left));
          left -= it.tokens.length;
          it.last = it.tokens.slice(0, k).join('');
          it.node.data = it.last;
        } else {
          it.el.style.visibility = left > 0 ? it.prev : 'hidden';
          left -= 1;
        }
      }
    };
    const restore = () => {
      for (const it of items) {
        if (it.kind === 'text') { if (it.node.data === it.last) it.node.data = it.orig; } // leave text React has since changed
        else it.el.style.visibility = it.prev;
      }
    };

    let shown = 0;
    render(0);
    const h = setInterval(() => {
      shown += step;
      if (shown >= total) { clearInterval(h); restore(); useTypingStore.getState().markSeen(id); return; }
      render(shown);
    }, TICK_MS / speed);
    return () => { clearInterval(h); restore(); };
  }, [id, speed]);

  return <div ref={root} className="contents">{children}</div>;
}
