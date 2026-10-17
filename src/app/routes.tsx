import type { IconName } from '@/components/AppIcon';

export type ScreenKey = 'home' | 'policies' | 'policyDetail' | 'claims' | 'claimDetail' | 'ask' | 'memory' | 'about' | 'capture';

export interface RouteMeta {
  key: ScreenKey;
  path: string;
  /** Sample URL for links to parametrised routes. */
  href: string;
  prd: string; // Frontend PRD section
  tab?: 'home' | 'policies' | 'claims' | 'ask';
  parent?: string; // shows a back chevron
}

export const ROUTES: RouteMeta[] = [
  { key: 'home', path: '/', href: '/', prd: '§6.2', tab: 'home' },
  { key: 'policies', path: '/policies', href: '/policies', prd: '§6.5', tab: 'policies' },
  { key: 'policyDetail', path: '/policies/:id', href: '/policies/pol_mei_health_01', prd: '§6.5', tab: 'policies', parent: '/policies' },
  { key: 'claims', path: '/claims', href: '/claims', prd: '§6.8', tab: 'claims' },
  { key: 'claimDetail', path: '/claims/:id', href: '/claims/clm_mei_001', prd: '§6.8', tab: 'claims', parent: '/claims' },
  { key: 'ask', path: '/ask', href: '/ask', prd: '§6.3', tab: 'ask' },
  { key: 'memory', path: '/memory', href: '/memory', prd: '§6.11', parent: '/' },
  { key: 'capture', path: '/capture', href: '/capture', prd: '§6.9 (C8)', parent: '/claims' },
  { key: 'about', path: '/about', href: '/about', prd: '§2.4 (nav) / §15', parent: '/' },
];

export const TABS: { id: NonNullable<RouteMeta['tab']>; to: string; icon: IconName }[] = [
  { id: 'home', to: '/', icon: 'home' },
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
