import type { Config } from 'tailwindcss';

// Colours reference CSS variables from src/styles/tokens.css so there is one source of truth.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--wb-primary)',
        brand: 'var(--wb-brand)',
        logo: 'var(--wb-logo-red)',
        ink: 'var(--wb-ink)',
        body: 'var(--wb-text)',
        muted: 'var(--wb-muted)',
        wash: 'var(--wb-wash)',
        surface: 'var(--wb-surface)',
        line: 'var(--wb-border)',
        bluewash: 'var(--wb-bluewash)',
        ok: 'var(--wb-success)',
        warn: 'var(--wb-warning)',
        danger: 'var(--wb-danger)',
        focus: 'var(--wb-focus)',
        cardline: 'var(--wb-card-border)',
        secline: 'var(--wb-secondary-border)',
      },
      fontFamily: { sans: ['var(--wb-font)'] },
      borderRadius: {
        card: 'var(--wb-radius-card)',
        control: 'var(--wb-radius-control)',
        input: 'var(--wb-radius-input)',
        shell: 'var(--wb-radius-shell)',
      },
      boxShadow: { card: 'var(--wb-shadow-card)' },
      spacing: { touch: 'var(--wb-touch-target)' },
      minHeight: { control: 'var(--wb-control-height)', touch: 'var(--wb-touch-target)' },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        inLeft: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        outLeft: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-100%)' } },
        inRight: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        outRight: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(100%)' } },
        inBottom: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        scan: { from: { top: '4%' }, to: { top: '92%' } },
        outBottom: { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out', 'fade-out': 'fadeOut 150ms ease-in',
        'in-left': 'inLeft 220ms ease-out', 'out-left': 'outLeft 160ms ease-in',
        'in-right': 'inRight 220ms ease-out', 'out-right': 'outRight 160ms ease-in',
        'in-bottom': 'inBottom 220ms ease-out', 'out-bottom': 'outBottom 160ms ease-in',
        scan: 'scan 1.6s linear infinite',
      },
      maxWidth: { app: 'var(--app-max-width)' },
    },
  },
  plugins: [],
} satisfies Config;
