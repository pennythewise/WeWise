export type Locale = 'en' | 'zh';
/** Bilingual text. Cards and events carry these so a language switch re-renders past messages live. */
export interface L { en: string; zh: string }
export type Txt = string | L;
export const L = (en: string, zh: string): L => ({ en, zh });
export const pick = (t: Txt, lang: Locale): string => (typeof t === 'string' ? t : t[lang]);
export const bothLangs = (t: Txt): string[] => (typeof t === 'string' ? [t] : [t.en, t.zh]);

/** Fixed "today" for the demo so dates and waiting-period maths are reproducible. */
export const DEMO_TODAY = '2026-10-14';
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
