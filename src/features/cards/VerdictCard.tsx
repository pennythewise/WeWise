import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Txt, VerdictCriterion } from '@/engine/types';
import { Badge, CardShell, Notice, ProgressBar } from '@/components/ui';
import { estimateCost, productById } from '@/mock/products';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';

interface Props { a: string; b: string; criteria: VerdictCriterion[]; winsA: Txt; winsB: Txt; cautions: Txt[]; headline: Txt }

/** Worked example: figures come from the pure `estimateCost` function, never from the model (PRD B2). */
function WorkedExample({ a, b }: { a: string; b: string }) {
  const { t } = useTranslation();
  const { money } = useTx();
  const [bill, setBill] = useState(200000);
  const ca = estimateCost(productById(a), bill);
  const cb = estimateCost(productById(b), bill);
  return (
    <div className="rounded-input border border-cardline bg-surface p-3">
      <label htmlFor="bill" className="flex items-baseline justify-between text-[13px] font-semibold text-ink">
        {t('cards.verdict.bill')}<span className="tabular-nums">{money(bill)}</span>
      </label>
      <input id="bill" type="range" min={20000} max={500000} step={10000} value={bill} onChange={(e) => setBill(Number(e.target.value))} className="mt-2 h-8 w-full accent-[var(--wb-primary)]" />
      <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]" aria-live="polite">
        {[['A', ca], ['B', cb]].map(([k, c]) => (
          <div key={k as string} className="rounded-input border border-cardline bg-white p-2.5">
            <p className="text-xs font-semibold text-muted">{t('cards.verdict.product', { side: k })}</p>
            <p className="mt-1">{t('cards.verdict.youPay')} <strong className="tabular-nums text-ink">≈ {money((c as typeof ca).youPay)}</strong></p>
            <p className="text-muted">{t('cards.verdict.insurerPays')} <span className="tabular-nums">≈ {money((c as typeof ca).insurerPays)}</span></p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t('cards.verdict.computed')}</p>
    </div>
  );
}

export function VerdictCard({ a, b, criteria, winsA, winsB, cautions, headline }: Props) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const running = useAgentStore((s) => s.running);
  return (
    <CardShell title={tx(headline)} icon="shield" right={<Badge tone="info" icon="spark">{t('cards.verdict.judge')}</Badge>}>
      <ul className="space-y-2.5">
        {criteria.map((c, i) => (
          <li key={i}>
            <p className="mb-1 flex justify-between text-xs font-medium text-ink"><span>{tx(c.name)}</span><span className="text-muted">A {c.a} · B {c.b}</span></p>
            <div className="space-y-1">
              <ProgressBar value={c.a} label={`${tx(c.name)} A`} tone="info" />
              <ProgressBar value={c.b} label={`${tx(c.name)} B`} tone="ok" />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 text-[13px]">
        <p><strong className="text-brand">{t('cards.verdict.aWins')}</strong> {tx(winsA)}</p>
        <p><strong className="text-ok">{t('cards.verdict.bWins')}</strong> {tx(winsB)}</p>
      </div>
      <div className="mt-3 space-y-2">{cautions.map((c, i) => <Notice key={i} tone="warn">{tx(c)}</Notice>)}</div>
      <div className="mt-4"><WorkedExample a={a} b={b} /></div>
      <button type="button" disabled={running} className="btn-primary mt-4 w-full" onClick={() => void useAgentStore.getState().send(t('cards.verdict.talkSend'))}>{t('cards.verdict.talk')}</button>
    </CardShell>
  );
}
