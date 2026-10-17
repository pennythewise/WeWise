import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, CardShell } from '@/components/ui';
import { useClaimView } from '../claims/useClaimView';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';
import { ClaimStatusBadge } from '../claims/ClaimStatusBadge';

export function ClaimStatusCard({ claimId }: { claimId: string }) {
  const { t } = useTranslation();
  const { tx, date } = useTx();
  const view = useClaimView(claimId);
  const running = useAgentStore((s) => s.running);
  if (!view) return null;
  const { claim, timeline } = view;
  const recent = timeline.filter((s) => s.at).slice(-2);
  return (
    <CardShell title={tx(claim.title)} icon="clock" right={<ClaimStatusBadge status={claim.status} />}>
      {claim.waitingOn && <p className="mb-2"><Badge tone={claim.waitingOn === 'user' ? 'warn' : 'info'} icon="clock">{t(`claims.waitingOn.${claim.waitingOn}`)}</Badge></p>}
      <ul className="space-y-1.5 text-[13px]">
        {recent.map((s) => <li key={s.stage}><strong className="text-ink">{t(`claims.stage.${s.stage}`)}</strong> <span className="text-muted">· {date(s.at!)}</span>{s.note ? <span className="block text-body">{tx(s.note)}</span> : null}</li>)}
      </ul>
      <div className="mt-3 flex gap-2">
        <Link to={`/claims/${claim.id}`} className="btn-secondary btn-compact flex-1">{t('cards.status.open')}</Link>
        <button type="button" disabled={running} className="btn-secondary btn-compact flex-1" onClick={() => void useAgentStore.getState().send(t('cards.status.whySend'))}>{t('claims.explain')}</button>
      </div>
    </CardShell>
  );
}
