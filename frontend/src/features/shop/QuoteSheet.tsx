import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/ui';
import type { InsuranceType } from '@/mock/products';
import { CATEGORIES, defaultAnswers, type Answers, type QuoteField } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { useShopStore } from './shopStore';

const input = 'mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink';

/** Per-category quote form. Prices elsewhere in the marketplace re-compute from the saved answers. */
export function QuoteSheet({ type, open, onOpenChange, onDone }: { type: InsuranceType; open: boolean; onOpenChange: (v: boolean) => void; onDone?: () => void }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const saved = useShopStore((s) => s.quotes[type]);
  const save = useShopStore((s) => s.saveQuote);
  const fields = CATEGORIES[type].fields;
  const [draft, setDraft] = useState<Answers>(() => ({ ...defaultAnswers(type), ...saved }));
  const [tried, setTried] = useState(false);
  const set = (k: string, v: string | number | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const bad = (f: QuoteField) => f.kind === 'number' && (draft[f.key] === '' || Number(draft[f.key]) < f.min || Number(draft[f.key]) > f.max || Number.isNaN(Number(draft[f.key])));
  const submit = () => {
    setTried(true);
    if (fields.some(bad)) return;
    save(type, Object.fromEntries(fields.map((f) => [f.key, f.kind === 'number' ? Number(draft[f.key]) : draft[f.key]])));
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" inPhone title={t('shop.quote.title', { type: t(`types.${type}`) })} height="82%">
      <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <p className="text-[13px] text-muted">{t('shop.quote.intro')}</p>
        {fields.map((f) => (
          <div key={f.key}>
            {f.kind === 'toggle' ? (
              <label className="flex min-h-[44px] items-center justify-between gap-3 text-[14px] text-ink">
                {tx(f.label)}
                <input type="checkbox" checked={!!draft[f.key]} onChange={(e) => set(f.key, e.target.checked)} className="h-6 w-6 accent-primary" />
              </label>
            ) : (
              <label className="block text-xs font-medium text-muted">{tx(f.label)}
                {f.kind === 'select' ? (
                  <select className={input} value={String(draft[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options.map((o) => <option key={o.v} value={o.v}>{tx(o.label)}</option>)}
                  </select>
                ) : (
                  <input className={input} type="number" inputMode="numeric" min={f.min} max={f.max} value={String(draft[f.key])} onChange={(e) => set(f.key, e.target.value)} aria-invalid={tried && bad(f)} />
                )}
              </label>
            )}
            {tried && bad(f) && f.kind === 'number' && <p className="mt-1 text-xs text-danger" role="alert">{t('shop.quote.range', { min: f.min, max: f.max })}</p>}
          </div>
        ))}
        <Notice tone="info">{t('shop.quote.note')}</Notice>
        <button type="submit" className="btn-primary w-full">{t('shop.quote.submit')}</button>
      </form>
    </Sheet>
  );
}
