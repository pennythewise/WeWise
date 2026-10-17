import { lazy, Suspense } from 'react';
const LiveApp = lazy(() => import('@/live/LiveApp'));
const SimulatorApp = lazy(() => import('./SimulatorApp'));

/** Live API is the default. Preset scenarios are a separate, explicitly chosen mode. */
export default function App() {
  const simulation = new URLSearchParams(location.search).get('mode') === 'simulator';
  return <Suspense fallback={<div className="p-8 text-brand">正在打开 WeWise…</div>}>{simulation ? <SimulatorApp /> : <LiveApp />}</Suspense>;
}
