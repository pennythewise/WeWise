import { useRef, useState } from 'react';
import { AppIcon } from './AppIcon';

/** Slide-to-confirm for actions that must not fire by accident (DoorDash "swipe for 911", Lyft). Pointer and keyboard (Enter/Space) both work. */
export function SlideToConfirm({ label, onConfirm, tone = 'danger' }: { label: string; onConfirm: () => void; tone?: 'danger' | 'primary' }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const KNOB = 48;
  const max = () => (track.current?.clientWidth ?? 280) - KNOB - 8;
  const bg = tone === 'danger' ? 'bg-danger' : 'bg-primary';
  const wash = tone === 'danger' ? 'bg-[var(--wb-danger-bg)] text-danger' : 'bg-bluewash text-primary';

  const move = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (r) setX(Math.max(0, Math.min(max(), clientX - r.left - KNOB / 2 - 4)));
  };
  const end = () => {
    setDrag(false);
    if (x >= max() * 0.9) { setX(max()); onConfirm(); setTimeout(() => setX(0), 600); } else setX(0);
  };

  return (
    <div ref={track} className={`relative h-14 select-none overflow-hidden rounded-full ${wash}`} role="group">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[14px] font-semibold" style={{ opacity: 1 - x / (max() || 1) }}>{label}</span>
      <button
        type="button" aria-label={label}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); }}
        onPointerMove={(e) => drag && move(e.clientX)}
        onPointerUp={end} onPointerCancel={end}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfirm(); } }}
        className={`absolute left-1 top-1 flex h-12 w-12 touch-none items-center justify-center rounded-full text-white ${bg} ${drag ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${x}px)` }}
      ><AppIcon name="arrow" size={22} strokeWidth={2} /></button>
    </div>
  );
}
