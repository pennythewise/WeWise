export type LayoutMode = 'phone' | 'tablet' | 'showcase';

const params = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const queryFlags = {
  record: () => params().get('record') === '1',
  mode: (): LayoutMode | null => {
    const m = params().get('mode');
    return m === 'phone' || m === 'tablet' || m === 'showcase' ? m : null;
  },
  lang: () => params().get('lang'),
  scenario: () => {
    const n = Number(params().get('scenario'));
    return n >= 1 && n <= 6 ? n : null;
  },
};
