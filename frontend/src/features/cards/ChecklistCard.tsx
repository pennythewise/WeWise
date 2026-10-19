import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CardShell, ProgressBar } from '@/components/ui';
import { DocRow } from '../claims/DocRow';
import { preparedCount, requiredCount, useClaimStore } from '../claims/claimStore';

export function ChecklistCard({ claimId }: { claimId: string }) {
  const { t } = useTranslation();
  const { docs, status } = useClaimStore();
  const n = preparedCount(docs), total = requiredCount(docs);
  return (
    <CardShell title={t('cards.checklist.title')} icon="file" right={<span className="text-[13px] font-semibold text-brand" aria-live="polite">{t('claims.prepared', { n, total })}</span>}>
      <ProgressBar value={n} max={total} tone={n === total ? 'ok' : 'info'} label={t('claims.prepared', { n, total })} />
      <ul className="mt-3 rounded-input border border-[#E2E9F4]">{docs.map((d) => <DocRow key={d.id} doc={d} locked={status !== 'DRAFT'} compact />)}</ul>
      <Link to={`/claims/${claimId}`} className="btn-primary mt-3 w-full">{t('cards.checklist.open')}</Link>
    </CardShell>
  );
}
