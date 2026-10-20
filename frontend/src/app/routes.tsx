import type { IconName } from '@/components/AppIcon';

export type ScreenKey = 'home' | 'policies' | 'policyDetail' | 'claims' | 'claimDetail' | 'ask' | 'memory' | 'profile' | 'about' | 'capture' | 'upload' | 'emergency' | 'coverageCheck' | 'switchCheck' | 'shop' | 'shopCategory' | 'shopProduct' | 'shopCheckout';

export interface RouteMeta {
  key: ScreenKey;
  path: string;
  /** Sample URL for links to parametrised routes. */
  href: string;
  prd: string; // Frontend PRD section
  tab?: 'home' | 'shop' | 'policies' | 'claims' | 'ask';
  parent?: string; // shows a back chevron
  /** Full-bleed screen inside the phone: no app header or tab bar (call screen, 3D showcase). */
  immersive?: boolean;
}

export const ROUTES: RouteMeta[] = [
  { key: 'home', path: '/', href: '/', prd: '§6.2', tab: 'home' },
  { key: 'shop', path: '/shop', href: '/shop', prd: '§6.12', tab: 'shop' },
  { key: 'shopCategory', path: '/shop/c/:type', href: '/shop/c/medical', prd: '§6.12', tab: 'shop', parent: '/shop' },
  { key: 'shopProduct', path: '/shop/p/:id', href: '/shop/p/shop_med_1', prd: '§6.12', tab: 'shop', parent: '/shop' },
  { key: 'shopCheckout', path: '/shop/checkout/:id', href: '/shop/checkout/shop_med_1', prd: '§6.12', tab: 'shop', parent: '/shop' },
  { key: 'policies', path: '/policies', href: '/policies', prd: '§6.5', tab: 'policies' },
  { key: 'policyDetail', path: '/policies/:id', href: '/policies/pol_mei_health_01', prd: '§6.5', tab: 'policies', parent: '/policies' },
  { key: 'claims', path: '/claims', href: '/claims', prd: '§6.8', tab: 'claims' },
  { key: 'claimDetail', path: '/claims/:id', href: '/claims/clm_mei_001', prd: '§6.8', tab: 'claims', parent: '/claims' },
  { key: 'ask', path: '/ask', href: '/ask', prd: '§6.3', tab: 'ask' },
  { key: 'memory', path: '/memory', href: '/memory', prd: '§6.11', parent: '/' },
  { key: 'capture', path: '/capture', href: '/capture', prd: '§6.9 (C8)', parent: '/claims' },
  { key: 'upload', path: '/upload', href: '/upload', prd: '§6.4 (A1)', parent: '/policies' },
  { key: 'emergency', path: '/emergency', href: '/emergency', prd: '§6.9 (C7)', parent: '/' },
  { key: 'coverageCheck', path: '/coverage-check', href: '/coverage-check', prd: '§4.1 D2', parent: '/' },
  { key: 'switchCheck', path: '/switch-check', href: '/switch-check', prd: '§4.1 B5', parent: '/' },
  { key: 'profile', path: '/profile', href: '/profile', prd: '§6.11', parent: '/' },
  { key: 'about', path: '/about', href: '/about', prd: '§2.4 (nav) / §15', parent: '/' },
];

export const TABS: { id: NonNullable<RouteMeta['tab']>; to: string; icon: IconName }[] = [
  { id: 'home', to: '/', icon: 'home' },
  { id: 'shop', to: '/shop', icon: 'coins' },
  { id: 'policies', to: '/policies', icon: 'wallet' },
  { id: 'claims', to: '/claims', icon: 'file' },
  { id: 'ask', to: '/ask', icon: 'chat' },
];

/** Match a pathname to its route (longest static prefix wins). */
export function matchRoute(pathname: string): RouteMeta {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const found = ROUTES.find((r) => {
    const re = new RegExp('^' + r.path.replace(/:[^/]+/g, '[^/]+') + '$');
    return re.test(clean);
  });
  return found ?? ROUTES[0];
}
