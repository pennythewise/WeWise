import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, EmptyState, Notice } from '@/components/ui';
import { INITIAL_MEMORY } from '@/mock/users';
import { buildTurns } from '@/engine/inspect';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';

const PURPOSE: Record<string, string> = { clause_search: 'purposeSearch', policy_lookup: 'purposeLookup', waiting_period_check: 'purposeWaiting', ocr_extract: 'purposeOcr', handoff_send: 'purposeHandoff', claim_submit: 'purposeClaim' };

/** Memory (F4) and access log (E7): what I remember, what I accessed, with delete and an on/off switch. */
export function MemoryPage() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const [facts, setFacts] = useState(INITIAL_MEMORY);
  const [on, setOn] = useState(true);
  const events = useAgentStore((s) => s.events);
  const log = useMemo(() => buildTurns(events).flatMap((turn) => turn.tools.map((tool) => ({ ...tool, turnId: turn.turnId }))), [events]);

  return (
    <div className="space-y-4" data-screen="memory">
      <CardShell>
        <label className="flex min-h-touch items-center justify-between gap-3 text-[14px] font-semibold text-ink">
          {t('memory.toggle')}
          <input type="checkbox" role="switch" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-[#C9D3EC] transition-colors checked:bg-primary [&::before]:m-0.5 [&::before]:block [&::before]:h-5 [&::before]:w-5 [&::before]:rounded-full [&::before]:bg-white [&::before]:transition-transform [&::before]:content-[''] checked:[&::before]:translate-x-5" />
        </label>
        <p className="text-xs text-muted">{on ? t('memory.on') : t('memory.off')}</p>
      </CardShell>

      <section aria-label={t('memory.remember')}>
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{t('memory.remember')}</h3>
        {facts.length === 0 ? <EmptyState icon="lock" text={t('memory.empty')} /> : (
          <ul className={`divide-y divide-cardline rounded-card border border-cardline bg-white px-3 ${on ? '' : 'opacity-60'}`}>
            {facts.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-[14px] text-ink">{tx(f.text)}</span>
                <button type="button" className="icon-btn text-muted" aria-label={`${t('memory.delete')}: ${tx(f.text)}`} onClick={() => setFacts(facts.filter((x) => x.id !== f.id))}><AppIcon name="close" size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t('memory.accessed')}>
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{t('memory.accessed')}</h3>
        {log.length === 0 ? <Notice tone="info">{t('memory.noAccess')}</Notice> : (
          <ul className="divide-y divide-cardline rounded-card border border-cardline bg-white px-3 text-[13px]">
            {log.map((l) => (
              <li key={l.callId + l.turnId} className="py-2.5">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-brand">{l.tool}</span><Badge tone="neutral" icon={false}>{l.tier}</Badge></div>
                <p className="text-xs text-muted">{l.turnId} · +{l.t}ms · {t(`memory.${PURPOSE[l.tool] ?? 'purposeOther'}`)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
