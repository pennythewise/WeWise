import { useTranslation } from 'react-i18next';
import { pick, type Locale, type Txt } from '@/engine/l';

/** Language-aware helpers for bilingual content (L) plus number/date formatting via Intl. */
export function useTx() {
  const { i18n } = useTranslation();
  const lang: Locale = i18n.language === 'zh' ? 'zh' : 'en';
  const locale = lang === 'zh' ? 'zh-CN' : 'en-GB';
  const tx = (t: Txt) => pick(t, lang);
  const money = (n: number) => `¥${Math.round(n).toLocaleString(locale)}`;
  const date = (iso: string, withYear = true) =>
    new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(iso + 'T00:00:00'));
  return { lang, tx, money, date, locale };
}
