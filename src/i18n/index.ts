import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';
import { queryFlags } from '@/lib';

export const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
] as const;
export type LangCode = (typeof LANGS)[number]['code'];

const isLang = (v: string | null): v is LangCode => !!v && LANGS.some((l) => l.code === v);

function initialLang(): LangCode {
  const q = queryFlags.lang();
  if (isLang(q)) return q;
  try {
    const saved = localStorage.getItem('wewise.lang');
    if (isLang(saved)) return saved;
  } catch { /* storage unavailable */ }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng === 'zh' ? 'zh-CN' : lng;
  try { localStorage.setItem('wewise.lang', lng); } catch { /* ignore */ }
});
document.documentElement.lang = i18n.language === 'zh' ? 'zh-CN' : i18n.language;

export default i18n;
