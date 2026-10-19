import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShareItem, Txt } from '@/engine/types';
import { Badge, CardShell } from '@/components/ui';
import { agentById } from '@/mock/agents';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { ConfirmPanel } from './ConfirmPanel';

interface Props { agentIds: string[]; why: Record<string, Txt[]>; shares: ShareItem[]; actionId: string }

export function HandoffPreviewCard({ agentIds, why, shares, actionId }: Props) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const [agentId, setAgentId] = useState(agentIds[0]);
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(shares.map((s) => [s.id, true])));
  const [consent, setConsent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const state = useAgentStore((s) => s.actionStates[actionId] ?? 'pending');
  const running = useAgentStore((s) => s.running);
  const agent = agentById(agentId);
  const picked = shares.filter((s) => included[s.id]);
  const done = state !== 'pending';

  return (
    <CardShell title={t('cards.handoff.title')} icon="user" right={done ? <Badge tone={state === 'confirmed' ? 'ok' : 'neutral'}>{state === 'confirmed' ? t('cards.handoff.shared') : t('cards.confirm.cancelled')}</Badge> : undefined}>
      <fieldset disabled={done} className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.handoff.recommended')}</legend>
        {agentIds.map((id, i) => {
          const a = agentById(id);
          const on = id === agentId;
          return (
            <label key={id} className={`flex cursor-pointer gap-3 rounded-card border p-3 ${on ? 'border-[#8298DA] bg-[#F4F7FF]' : 'border-cardline'}`}>
              <input type="radio" name="agent" className="mt-1 h-4 w-4 accent-[var(--wb-primary)]" checked={on} onChange={() => setAgentId(id)} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">{a.name}{i === 0 && <Badge tone="ok" icon="check">{t('cards.handoff.best')}</Badge>}</span>
                <span className="block text-xs text-muted">{a.license}</span>
                {on && <ul className="mt-1.5 space-y-0.5 text-[13px] text-body">{why[id]?.map((w, k) => <li key={k} className="flex gap-1.5"><span className="text-ok">✓</span>{tx(w)}</li>)}</ul>}
              </span>
            </label>
          );
        })}
      </fieldset>

      <details className="mt-3 rounded-input border border-cardline" open>
        <summary className="flex min-h-touch cursor-pointer items-center px-3 text-[14px] font-semibold text-ink">{t('cards.handoff.willShare')}</summary>
        <ul className="divide-y divide-cardline border-t border-cardline">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <input id={s.id} type="checkbox" className="h-5 w-5 accent-[var(--wb-primary)]" checked={included[s.id]} disabled={done} onChange={(e) => setIncluded({ ...included, [s.id]: e.target.checked })} />
              <label htmlFor={s.id} className="min-w-0 flex-1 text-[13px]"><span className="block text-xs text-muted">{tx(s.label)}</span><span className="break-words font-semibold text-ink">{tx(s.value)}</span></label>
            </li>
          ))}
        </ul>
        <p className="border-t border-cardline px-3 py-2 text-xs text-muted">{t('cards.handoff.masked')}</p>
      </details>

      {!done && (
        <>
          <label className="mt-3 flex items-start gap-3 text-[13px] text-body">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--wb-primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t('cards.handoff.consent', { name: agent.name })}
          </label>
          {!confirmOpen && <button type="button" className="btn-primary mt-3 w-full" disabled={!consent || picked.length === 0 || running} onClick={() => setConfirmOpen(true)}>{t('cards.handoff.share')}</button>}
        </>
      )}

      {confirmOpen && (
        <div className="mt-3 animate-fade-in rounded-card border border-[#8298DA] bg-[#F4F7FF] p-4">
          <h4 className="mb-2 text-[15px] font-semibold text-ink">{t('cards.handoff.confirmTitle')}</h4>
          <ConfirmPanel
            title={t('cards.handoff.confirmTitle')} what={t('cards.handoff.confirmWhat', { name: agent.name })} to={`${agent.name} · ${agent.license}`} shared={picked.map((s) => tx(s.label))}
            expiresInSec={300} state="pending"
            onCancel={() => { setConfirmOpen(false); void useAgentStore.getState().resolve(actionId, 'reject'); }}
            onConfirm={() => { setConfirmOpen(false); void useAgentStore.getState().resolve(actionId, 'confirm'); }}
          />
        </div>
      )}
    </CardShell>
  );
}
