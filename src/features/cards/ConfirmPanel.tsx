import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, Notice } from '@/components/ui';
import type { ActionState } from '@/agentStore';

interface Props {
  title: string; what: string; to: string; shared: string[]; payout?: string; expiresInSec: number;
  state: ActionState; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}

/** What, to whom, which data, expiry. Nothing happens without an explicit Confirm (PRD E5, US-10). */
export function ConfirmPanel({ title, what, to, shared, payout, expiresInSec, state, onConfirm, onCancel, busy }: Props) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(expiresInSec);
  useEffect(() => {
    if (state !== 'pending') return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, [state]);
  const expired = state === 'pending' && left === 0;
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className="space-y-3" role="group" aria-label={title}>
      <dl className="space-y-2 text-[13px]">
        <div><dt className="text-xs text-muted">{t('cards.confirm.what')}</dt><dd className="font-semibold text-ink">{what}</dd></div>
        <div><dt className="text-xs text-muted">{t('cards.confirm.to')}</dt><dd className="font-semibold text-ink">{to}</dd></div>
        <div><dt className="text-xs text-muted">{t('cards.confirm.shared')}</dt><dd className="text-ink">{shared.join(' · ')}</dd></div>
        {payout && (
          <div>
            <dt className="text-xs text-muted">{t('cards.confirm.payout')}</dt>
            <dd className="flex items-center gap-2 font-semibold text-ink"><AppIcon name="lock" size={16} />{payout}</dd>
            <dd className="text-xs text-muted">{t('claims.payoutLocked')}</dd>
          </div>
        )}
      </dl>
      <Notice tone="warn">{t('claims.riskNotice')}</Notice>
      {state === 'pending' && (
        <>
          <p className={`text-xs tabular-nums ${expired ? 'font-semibold text-danger' : 'text-muted'}`} aria-live="off">{expired ? t('cards.confirm.expired') : t('cards.confirm.expires', { time: mm })}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>{t('cards.confirm.cancel')}</button>
            <button type="button" className="btn-primary flex-1" onClick={onConfirm} disabled={expired || busy}>{t('cards.confirm.confirm')}</button>
          </div>
        </>
      )}
      {state === 'confirmed' && <Badge tone="ok">{t('cards.confirm.done')}</Badge>}
      {state === 'rejected' && <Badge tone="neutral" icon="close">{t('cards.confirm.cancelled')}</Badge>}
    </div>
  );
}
