import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineStep } from '@/engine/types';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { useTx } from '@/i18n/useTx';

/**
 * Claim timeline, tracker style (Alan, Klarna, Vestiaire): done = filled green check, dotted green rail;
 * current = hollow ring and a raised card with an "In progress" pill; pending = grey, quiet.
 */
export function Timeline({ steps, current }: { steps: TimelineStep[]; current?: TimelineStep['stage'] }) {
  const { t } = useTranslation();
  const { tx, date } = useTx();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="relative" aria-label={t('claims.timeline')}>
      {steps.map((s, i) => {
        const reached = !!s.at;
        const isCurrent = current === s.stage;
        const done = reached && !isCurrent;
        const last = i === steps.length - 1;
        const railDone = done && !!steps[i + 1]?.at;
        return (
          <li key={s.stage} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isCurrent ? 'step' : undefined}>
            {!last && <span className={`absolute left-[11px] top-7 h-[calc(100%-20px)] w-0 border-l-2 ${railDone ? 'border-dotted border-ok' : 'border-dotted border-[#C9D3EC]'}`} aria-hidden="true" />}
            <span className={`z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-ok text-white' : isCurrent ? 'border-[3px] border-primary bg-white' : 'border-2 border-[#C9D3EC] bg-white'}`}>
              {done && <AppIcon name="check" size={13} strokeWidth={2.4} />}
              {isCurrent && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <div className={`min-w-0 flex-1 ${isCurrent ? 'rounded-card border border-cardline bg-white p-3.5 shadow-card' : ''}`}>
              {isCurrent && <Badge tone="info" icon="clock" className="mb-1.5">{t('claims.now')}</Badge>}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={`text-[15px] font-semibold ${reached ? 'text-ink' : 'text-muted'}`}>{t(`claims.stage.${s.stage}`)}</p>
                {s.actor && <Badge tone={s.actor === 'you' ? 'info' : s.actor === 'ai' ? 'ok' : 'neutral'} icon={false}>{t(`claims.actor.${s.actor}`)}</Badge>}
              </div>
              {s.at && <p className="text-xs text-muted">{date(s.at)}</p>}
              {s.note && <p className={`mt-1 text-[13px] leading-relaxed ${reached ? 'text-body' : 'text-muted'}`}>{tx(s.note)}</p>}
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
