import { useTranslation } from 'react-i18next';
import { Badge, type Tone } from '@/components/ui';
import type { ClaimStatus } from '@/engine/types';

const MAP: Record<ClaimStatus, { tone: Tone; icon: 'clock' | 'check' | 'info' | 'close' | 'file' }> = {
  DRAFT: { tone: 'neutral', icon: 'file' }, SUBMITTED: { tone: 'info', icon: 'check' }, IN_REVIEW: { tone: 'info', icon: 'clock' },
  INFO_REQUESTED: { tone: 'warn', icon: 'info' }, DECLINED: { tone: 'danger', icon: 'close' }, PAID: { tone: 'ok', icon: 'check' },
};
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation();
  return <Badge tone={MAP[status].tone} icon={MAP[status].icon}>{t(`claims.status.${status}`)}</Badge>;
}
