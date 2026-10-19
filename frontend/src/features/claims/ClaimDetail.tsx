import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, EmptyState, Notice } from '@/components/ui';
import { CitationChip } from '../chat/CitationChip';
import { useTx } from '@/i18n/useTx';
import { useClaimStore } from './claimStore';
import { useClaimView } from './useClaimView';
import { ClaimPrepare } from './ClaimPrepare';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import { Timeline } from './Timeline';
import { FollowUpAgent } from './ClaimAgents';
import { CrossBorderClaim } from './CrossBorderClaim';
import { policyById } from '@/mock/policies';
import { useAgentStore } from '@/agentStore';

export function ClaimDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { tx } = useTx();
  const status = useClaimStore((s) => s.status);
  const replied = useClaimStore((s) => s.sentReplies.includes(id));
  const view = useClaimView(id);
  if (!view) return <EmptyState icon="file" title={t('claims.notFound')} text={t('claims.notFoundText')} />;
  if (id === 'clm_mei_001' && status === 'DRAFT') return <ClaimPrepare />;

  const { claim, timeline, current } = view;
  const pol = policyById(claim.policyId);
  return (
    <div className="space-y-4" data-screen="claimDetail">
      <CardShell>
        <div className="flex items-start justify-between gap-2"><h2 className="text-[17px] font-semibold leading-snug text-ink">{tx(claim.title)}</h2><ClaimStatusBadge status={claim.status} /></div>
        <p className="mt-1 text-xs text-muted">{pol ? tx(pol.product) : ''}</p>
        {claim.waitingOn && <p className="mt-2"><Badge tone={claim.waitingOn === 'user' && !replied ? 'warn' : 'info'} icon="clock">{t(`claims.waitingOn.${replied ? 'insurer' : claim.waitingOn}`)}</Badge></p>}
      </CardShell>

      {claim.decline && (
        <CardShell title={t('claims.decline.title')} icon="info" tone="danger">
          <p className="text-[13px] leading-relaxed text-body">{tx(claim.decline.reason)}</p>
          <blockquote className="mt-3 border-l-[3px] border-danger bg-[var(--wb-danger-bg)] px-3 py-2 text-[13px] text-ink"><CitationChip id={claim.decline.clauseId} /> “{tx(claim.decline.quote)}”</blockquote>
          <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t('claims.decline.next')}</h4>
          <ul className="space-y-1.5 text-[13px] text-body">{(['add', 'appeal', 'regulator'] as const).map((k) => <li key={k} className="flex gap-2"><AppIcon name="arrow" size={14} className="mt-1 shrink-0 text-primary" />{t(`claims.decline.${k}`)}</li>)}</ul>
          <div className="mt-3"><Notice tone="info">{t('claims.decline.cant')}</Notice></div>
          <button type="button" className="btn-secondary mt-3 w-full" onClick={() => void useAgentStore.getState().send(t('chat.chips.complainSend'))}>{t('claims.decline.talk')}</button>
        </CardShell>
      )}

      {claim.id === 'clm_mei_004' && <CrossBorderClaim />}
      {claim.status === 'INFO_REQUESTED' && !replied && <Notice tone="warn" icon="bell">{t('claims.infoNeeded')}</Notice>}
      {claim.status === 'INFO_REQUESTED' && <FollowUpAgent claimId={claim.id} />}
      <CardShell title={t('claims.timeline')} icon="clock"><Timeline steps={timeline} current={current} /></CardShell>
    </div>
  );
}
