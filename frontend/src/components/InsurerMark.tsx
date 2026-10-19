import pingan from '@/assets/insurers/pingan.png';
import zhongan from '@/assets/insurers/zhongan.png';
import chinalife from '@/assets/insurers/chinalife.png';
import cpic from '@/assets/insurers/cpic.png';
import picc from '@/assets/insurers/picc.png';
import { insurerById } from '@/mock/insurers';
import { useTx } from '@/i18n/useTx';

/** Insurer logo by id, shown on a white tile so every brand colour stays legible. Falls back to a monogram. */
const LOGO: Record<string, string> = { harbour: pingan, orchid: zhongan, pinnacle: chinalife, sunrise: cpic, banyan: picc };

export function InsurerMark({ id, size = 36 }: { id: string; size?: number }) {
  const { lang } = useTx();
  const i = insurerById(id);
  const label = lang === 'zh' ? i.zh : i.name;
  const logo = LOGO[id];
  if (logo) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-cardline bg-white" style={{ width: size, height: size, padding: size * 0.1 }} role="img" aria-label={label}>
        <img src={logo} alt="" className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-control font-semibold text-white" style={{ width: size, height: size, background: i.color, fontSize: size * 0.4 }} role="img" aria-label={label}>
      {i.mark}
    </span>
  );
}
