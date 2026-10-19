import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { ASSIST_LINE, LOCAL, localFor, type LocalLang } from '@/mock/local';

const ORDER: LocalLang[] = ['th', 'ms', 'ja', 'en', 'zh'];

/**
 * "Show this to local staff" (PRD A4 / C6): the user's policy facts in the language of the country they are in.
 * The local language is picked from the country automatically; the user can switch, and enlarge the text to hand the phone over.
 */
export function LocalPolicyCard({ country }: { country: string }) {
  const { tx } = useTx();
  const local = localFor(country);
  const [lang, setLang] = useState<LocalLang>(local.lang);
  const [big, setBig] = useState(false);
  useEffect(() => setLang(local.lang), [local.lang]);
  const pack = LOCAL[lang];

  return (
    <section className="rounded-card border border-secline bg-bluewash/60 p-3" aria-label={tx(L('Policy facts in the local language', '当地语言的保单信息'))} data-testid="local-policy">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[14px] font-semibold text-ink">{tx(L('Show this to local staff', '出示给当地工作人员'))}</h4>
          <p className="text-xs text-muted">{tx(L('Picked from the country you are in. Tap a language to switch.', '根据您所在国家自动选择，可点击切换语言。'))}</p>
        </div>
        <button type="button" aria-pressed={big} onClick={() => setBig(!big)} className={`min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-semibold ${big ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`}>
          {tx(L('Large text', '大字'))}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={tx(L('Language', '语言'))}>
        {ORDER.map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`min-h-[32px] rounded-full px-3 text-xs font-medium ${lang === l ? 'bg-primary text-white' : 'bg-white text-ink ring-1 ring-cardline'}`}>
            {LOCAL[l].label}{l === local.lang && <span className="ml-1 opacity-80">· {tx(L('local', '当地'))}</span>}
          </button>
        ))}
      </div>
      <div lang={lang} className={`mt-3 rounded-input border border-cardline bg-white p-3 ${big ? 'text-[18px] leading-relaxed' : 'text-[13px] leading-relaxed'}`}>
        <p className={`font-semibold text-ink ${big ? 'text-[21px]' : 'text-[15px]'}`}>{pack.title}</p>
        <p className="mt-1 text-body">{pack.intro}</p>
        <dl className="mt-2 divide-y divide-cardline">
          {pack.facts.map((f) => <div key={f.label} className="flex justify-between gap-3 py-1.5"><dt className="text-muted">{f.label}</dt><dd className="text-right font-semibold tabular-nums text-ink">{f.value}</dd></div>)}
        </dl>
        <p className="mt-2 text-body">{pack.ask}</p>
        <a href={`tel:${ASSIST_LINE.replace(/\s/g, '')}`} className="btn-primary btn-compact mt-3 w-full"><AppIcon name="bell" size={16} />{pack.call} · {ASSIST_LINE}</a>
      </div>
      <p className="mt-2 text-[11px] text-muted">{tx(L('Machine-prepared translation. Policy details are a demo example. From abroad, use the overseas hotline printed on your policy card.', '系统翻译。保单信息为演示示例。在境外请拨打保单卡上印的境外服务电话。'))}</p>
    </section>
  );
}

/** The incident report in English, Chinese and the local language. */
export function LocalReport({ country, nameEn, nameZh }: { country: string; nameEn: string; nameZh: string }) {
  const local = localFor(country);
  const langs: LocalLang[] = local.lang === 'en' || local.lang === 'zh' ? ['en', 'zh'] : [local.lang, 'en', 'zh'];
  const name = (l: LocalLang) => (l === 'en' ? nameEn : l === 'zh' ? nameZh : local.name);
  return (
    <>
      {langs.map((l) => (
        <section key={l} lang={l} className="rounded-input border border-cardline p-3">
          <h4 className="mb-1 font-semibold text-ink">{LOCAL[l].label}</h4>
          <p>{LOCAL[l].report(name(l))}</p>
        </section>
      ))}
    </>
  );
}
