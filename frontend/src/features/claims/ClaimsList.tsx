import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { CLAIMS } from '@/mock/claims';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { L } from '@/engine/l';
import { useClaimView } from './useClaimView';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import { useXbProgress } from './CrossBorderClaim';

function Row({ id }: { id: string }) {
  const { t } = useTranslation();
  const { tx, date } = useTx();
  const v = useClaimView(id)!;
  const xb = useXbProgress();
  const pol = policyById(v.claim.policyId);
  return (
    <li>
      <Link to={`/claims/${id}`} className="card flex items-center gap-3 !p-3.5 shadow-card">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{tx(v.claim.title)}</span>
          <span className="block text-xs text-muted">{pol ? tx(pol.product) : ''} · {date(v.claim.updated)}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <ClaimStatusBadge status={v.claim.status} />
            {id === 'clm_mei_004' && <Badge tone="info" icon="clock">{xb.count} / {xb.total}</Badge>}
            {v.claim.waitingOn === 'user' && <Badge tone="warn" icon="clock">{t('claims.waitingOn.user')}</Badge>}
          </span>
        </span>
        <AppIcon name="chevron" size={18} />
      </Link>
    </li>
  );
}

export function ClaimsList() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const { started } = useXbProgress();
  // The cross-border claim (S3) appears once the assistant has opened a case for it.
  const order = [...(started ? ['clm_mei_004'] : []), 'clm_mei_001', 'clm_mei_002', 'clm_mei_003'].filter((id) => CLAIMS.some((c) => c.id === id));
  const waiting = order.filter((id) => CLAIMS.find((c) => c.id === id)?.waitingOn === 'user');
  const rest = order.filter((id) => !waiting.includes(id));
  const group = (title: L, ids: string[]) => ids.length > 0 && (
    <section>
      <h3 className="mb-2 text-[13px] font-semibold text-muted">{tx(title)}</h3>
      <ul className="space-y-3">{ids.map((id) => <Row key={id} id={id} />)}</ul>
    </section>
  );
  return (
    <div className="space-y-5" data-screen="claims">
      <p className="text-[13px] leading-relaxed text-body">{t('claims.listIntro')}</p>
      <Link to="/capture" className="btn-secondary w-full"><AppIcon name="scan" size={18} />{t('claims.captureLink')}</Link>
      {group(L('Needs your action', '需要您处理'), waiting)}
      {group(L('In progress and closed', '进行中与已结束'), rest)}
    </div>
  );
}
