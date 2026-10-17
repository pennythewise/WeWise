import icons from '@/assets/icons.json';

// `mic` is a local addition in the same geometry (24 grid, 1.65 stroke, round caps); the brand folder has no microphone.
const EXTRA = { mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3' };
const PATHS: Record<string, string> = { ...icons.paths, ...EXTRA };
export type IconName = keyof typeof icons.paths | keyof typeof EXTRA;

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Subtle translucent fill, only for the selected bottom-nav icon (brand folder rule). */
  filled?: boolean;
  className?: string;
}

/** The project's 27 SVG icons (webank-insurance-ui). Decorative: pair with a text label or aria-label on the parent. */
export function AppIcon({ name, size = 22, strokeWidth = 1.65, filled, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      fillOpacity={filled ? 0.12 : undefined}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
