import { useTranslation } from 'react-i18next';
import { LANGS } from '@/i18n';

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();
  return (
    <div role="group" aria-label={t('header.language')} className={`inline-flex rounded-control border border-line bg-white p-0.5 ${className}`}>
      {LANGS.map((l) => {
        const on = i18n.language === l.code;
        return (
          <button
            key={l.code}
            type="button"
            aria-pressed={on}
            lang={l.code === 'zh' ? 'zh-CN' : l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={`min-h-[36px] min-w-[44px] rounded-[7px] px-2.5 text-[13px] font-medium ${on ? 'bg-primary text-white' : 'text-ink hover:bg-wash'}`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
