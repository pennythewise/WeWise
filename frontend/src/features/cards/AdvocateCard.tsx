import { useTranslation } from 'react-i18next';
import type { Txt } from '@/engine/types';
import { productById } from '@/mock/products';
import { useTx } from '@/i18n/useTx';
import { L } from '@/engine/l';

export function AdvocateCard({ side, productId, argument }: { side: 'A' | 'B'; productId: string; argument: Txt }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const a = side === 'A';
  return (
    <figure className={`flex gap-2.5 ${a ? '' : 'flex-row-reverse'}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${a ? 'bg-brand' : 'bg-ok'}`} aria-hidden="true">{side}</span>
      <div className={`max-w-[85%] rounded-card border px-3 py-2.5 ${a ? 'border-[#D5E0F7] bg-bluewash' : 'border-[#CFE6DB] bg-[var(--wb-success-bg)]'}`}>
        <figcaption className="text-xs font-semibold text-ink">{t('cards.advocate.label', { side })} · {tx(productById(productId).name)}</figcaption>
        <p className="mt-1 text-[13px] leading-relaxed text-body">{tx(argument)}</p>
        <p className="mt-1.5 text-[11px] text-muted">{tx(L('AI advocate · every claim checked against source facts', 'AI 辩方 · 每条论点均已对照来源核验'))}</p>
      </div>
    </figure>
  );
}
