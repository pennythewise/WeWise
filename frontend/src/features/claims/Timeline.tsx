import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineStep } from '@/engine/types';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { useTx } from '@/i18n/useTx';

/** Claim timeline: Submitted → Document review → Info requested → Assessment → Decision → Payout. */
export function Timeline({ steps, current }: { steps: TimelineStep[]; current?: TimelineStep['stage'] }) {
  const { t } = useTranslation();
  const { tx, date } = useTx();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="relative space-y-0" aria-label={t('claims.timeline')}>
      {steps.map((s, i) => {
        const reached = !!s.at;
        const isCurrent = current === s.stage;
        const last = i === steps.length - 1;
        return (
          <li key={s.stage} className="relative flex gap-3 pb-5 last:pb-0" aria-current={isCurrent ? 'step' : undefined}>
            {!last && <span className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 ${reached ? 'bg-primary' : 'bg-[#D6DFF2]'}`} aria-hidden="true" />}
            <span className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${reached ? 'bg-primary text-white' : 'border-2 border-[#C9D3EC] bg-white text-muted'}`}>
              {reached ? <AppIcon name={isCurrent ? 'clock' : 'check'} size={13} strokeWidth={2} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#C9D3EC]" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={`text-[14px] font-semibold ${reached ? 'text-ink' : 'text-muted'}`}>{t(`claims.stage.${s.stage}`)}</p>
                {s.actor && <Badge tone={s.actor === 'you' ? 'info' : s.actor === 'ai' ? 'ok' : 'neutral'} icon={false}>{t(`claims.actor.${s.actor}`)}</Badge>}
                {isCurrent && <Badge tone="warn" icon="clock">{t('claims.now')}</Badge>}
              </div>
              {s.at && <p className="text-xs text-muted">{date(s.at)}</p>}
              {s.note && <p className="mt-0.5 text-[13px] text-body">{tx(s.note)}</p>}
              {reached && (
                <>
                  <button type="button" className="mt-1 min-h-[36px] text-[13px] font-semibold text-primary" aria-expanded={open === s.stage} onClick={() => setOpen(open === s.stage ? null : s.stage)}>
                    {t('claims.explain')}
                  </button>
                  {open === s.stage && <p className="rounded-input bg-bluewash px-3 py-2 text-[13px] leading-relaxed text-ink">{t(`claims.plain.${s.stage}`)}</p>}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
