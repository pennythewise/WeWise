import { useSyncExternalStore } from 'react';
import { queryFlags, type LayoutMode } from '@/lib';

export type { LayoutMode };

export const PHONE_MAX = 768; // < 768 phone
export const SHOWCASE_MIN = 1200; // >= 1200 showcase

const modeFromWidth = (w: number): LayoutMode => (w < PHONE_MAX ? 'phone' : w < SHOWCASE_MIN ? 'tablet' : 'showcase');

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

/** phone (<768) · tablet (768–1199) · showcase (≥1200). `?mode=` overrides for testing. */
export function useBreakpoint(): LayoutMode {
  const forced = queryFlags.mode();
  const fromWidth = useSyncExternalStore(subscribe, () => modeFromWidth(window.innerWidth), () => 'showcase' as LayoutMode);
  return forced ?? fromWidth;
}
