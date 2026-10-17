import { insurerById } from '@/mock/insurers';
import { useTx } from '@/i18n/useTx';

/** Monogram stand-in for an insurer logo (fictional brands, no real logos). */
export function InsurerMark({ id, size = 36 }: { id: string; size?: number }) {
  const { lang } = useTx();
  const i = insurerById(id);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-control font-semibold text-white" style={{ width: size, height: size, background: i.color, fontSize: size * 0.4 }} role="img" aria-label={lang === 'zh' ? i.zh : i.name}>
      {i.name[0]}
    </span>
  );
}
