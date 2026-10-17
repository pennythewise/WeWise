import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, type Tone } from '@/components/ui';
import type { TurnView } from '@/engine/inspect';
import type { RiskTier } from '@/engine/types';
import { useTx } from '@/i18n/useTx';

const TIER: Record<RiskTier, Tone> = { T0: 'neutral', T1: 'info', T2: 'warn', T3: 'warn', T4: 'danger' };
const SENSITIVE = /account|phone|name|id_no|payout/i;
/** Arguments are masked before display: the Inspector never shows raw PII. */
export const maskArgs = (a: Record<string, unknown>) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, SENSITIVE.test(k) && typeof v === 'string' ? v.replace(/[A-Za-z0-9]/g, (c, i, s) => (i >= s.length - 4 ? c : '•')) : v]));

export function ToolsTab({ turns }: { turns: TurnView[] }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const rows = turns.flatMap((tn) => tn.tools.map((tool) => ({ ...tool, turnId: tn.turnId })));
  if (rows.length === 0) return <EmptyState icon="spark" text={t('inspector.empty.tools')} />;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.turnId + r.callId} className={`animate-in-bottom rounded-input border bg-white px-3 py-2.5 [animation-duration:180ms] ${r.result && !r.result.ok ? 'border-[#F6CBC6]' : 'border-cardline'}`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-ink">{r.tool}</span>
            <Badge tone={TIER[r.tier]} icon={false}>{r.tier}</Badge>
          </div>
          <details className="mt-1">
            <summary className="min-h-[28px] cursor-pointer text-xs text-muted">{t('inspector.tools.args')}</summary>
            <pre className="mt-1 overflow-x-auto rounded-input bg-surface p-2 font-mono text-xs text-body">{JSON.stringify(maskArgs(r.args), null, 2)}</pre>
          </details>
          {r.result ? (
            <p className="mt-1 flex items-start gap-1.5 text-[13px]"><span className={r.result.ok ? 'text-ok' : 'text-danger'} aria-hidden="true">{r.result.ok ? '✓' : '✕'}</span><span className="min-w-0 flex-1 text-body">{tx(r.result.summary)}</span><span className="shrink-0 text-xs tabular-nums text-muted">{r.result.latencyMs}ms</span></p>
          ) : <p className="mt-1 text-xs text-primary">{t('inspector.tools.running')}</p>}
          {r.result && !r.result.ok && <p className="mt-1 text-xs font-semibold text-danger">{t('inspector.tools.blocked')}</p>}
        </li>
      ))}
    </ul>
  );
}
