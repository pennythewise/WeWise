import { lazy, Suspense } from 'react';
const SimulatorApp = lazy(() => import('./SimulatorApp'));

export default function App() {
  return <Suspense fallback={<div className="p-8 text-brand">正在打开 WeWise…</div>}><SimulatorApp /></Suspense>;
}
