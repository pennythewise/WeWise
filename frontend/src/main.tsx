import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './styles/index.css';
import App from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.DEV) {
  // Test hook: inspect stores from the console / Playwright.
  void Promise.all([import('./agentStore'), import('./features/claims/claimStore')]).then(([a, c]) => {
    (window as unknown as Record<string, unknown>).__stores = { agent: a.useAgentStore, claim: c.useClaimStore };
  });
}
