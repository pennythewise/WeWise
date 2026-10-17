import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, EmptyState } from '@/components/ui';
import type { StepStatus, TurnView } from '@/engine/inspect';
import { useTx } from '@/i18n/useTx';

const STATUS: Record<StepStatus, { glyph: string; key: string; cls: string }> = {
  pending: { glyph: '○', key: 'pending', cls: 'text-muted' },
  running: { glyph: '◔', key: 'running', cls: 'text-primary' },
  done: { glyph: '✓', key: 'done', cls: 'text-ok' },
  failed: { glyph: '✕', key: 'failed', cls: 'text-danger' },
  replanned: { glyph: '↻', key: 'replanned', cls: 'text-warn' },
};

function Phase({ n, title, state, children }: { n: number; title: string; state: 'done' | 'active' | 'todo'; children?: React.ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0" aria-current={state === 'active' ? 'step' : undefined}>
      <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 bg-[#D6DFF2] last:hidden" aria-hidden="true" />
      <span className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${state === 'done' ? 'bg-primary text-white' : state === 'active' ? 'border-2 border-primary bg-white text-primary' : 'bg-[#E2E9F8] text-brand'}`}>
        {state === 'done' ? <AppIcon name="check" size={13} strokeWidth={2} /> : n}
      </span>
      <div className="min-w-0 flex-1"><p className={`text-[14px] font-semibold ${state === 'todo' ? 'text-muted' : 'text-ink'}`}>{title}</p>{children}</div>
    </li>
  );
}

export function PipelineTab({ turn }: { turn?: TurnView }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  if (!turn) return <EmptyState icon="spark" text={t('inspector.empty.pipeline')} />;
  const u = turn.understand;
  const running = turn.steps.findIndex((s) => s.status === 'running');
  const allDone = turn.steps.length > 0 && turn.steps.every((s) => s.status === 'done' || s.status === 'replanned' || s.status === 'failed');
  const ph = (done: boolean, active: boolean) => (done ? 'done' : active ? 'active' : 'todo');
  return (
    <ol aria-label={t('inspector.tabs.pipeline')}>
      <Phase n={1} title={t('inspector.pipe.understand')} state={ph(!!u, !u && !turn.completed)}>
        {u && (
          <div className="mt-1 text-[13px] text-body">
            <p><span className="text-muted">{t('inspector.pipe.intent')}</span> <strong className="font-mono text-xs text-brand">{u.intent}</strong> · <span className="text-muted">{t('inspector.pipe.lang')}</span> {u.language}</p>
            {Object.keys(u.slots).length > 0 && <p className="mt-0.5 flex flex-wrap gap-1">{Object.entries(u.slots).map(([k, v]) => <Badge key={k} tone="neutral" icon={false}>{k}: {v}</Badge>)}</p>}
          </div>
        )}
      </Phase>
      <Phase n={2} title={t('inspector.pipe.plan')} state={ph(turn.steps.length > 0, !!u && turn.steps.length === 0 && !turn.completed)}>
        {turn.parallel && <p className="mt-1"><Badge tone="info" icon="spark">{t('inspector.pipe.parallel')}</Badge></p>}
        {turn.replans.map((r, i) => <p key={i} className="mt-1 rounded-input bg-[var(--wb-warning-bg)] px-2.5 py-1.5 text-[13px] text-warn">↻ {tx(r.reason)}</p>)}
      </Phase>
      <Phase n={3} title={t('inspector.pipe.execute')} state={ph(allDone, running >= 0)}>
        <ul className="mt-1 space-y-1">
          {turn.steps.map((s) => {
            const st = STATUS[s.status];
            return <li key={s.step.id} className="flex items-start gap-2 text-[13px]"><span className={`w-4 shrink-0 text-center font-semibold ${st.cls}`} aria-hidden="true">{st.glyph}</span><span className={s.status === 'replanned' ? 'text-muted line-through' : 'text-body'}>{tx(s.step.label)}</span><span className="sr-only">{t(`inspector.step.${st.key}`)}</span><span className={`ml-auto shrink-0 text-xs ${st.cls}`}>{t(`inspector.step.${st.key}`)}</span></li>;
          })}
        </ul>
      </Phase>
      <Phase n={4} title={t('inspector.pipe.verify')} state={ph(!!turn.verify, allDone && !turn.verify && !turn.completed)}>
        {turn.verify && (
          <p className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={turn.verify.citationsOk ? 'ok' : 'danger'} icon={turn.verify.citationsOk ? 'check' : 'close'}>{t('inspector.pipe.citations')}</Badge>
            <Badge tone={turn.verify.numbersOk ? 'ok' : 'danger'} icon={turn.verify.numbersOk ? 'check' : 'close'}>{t('inspector.pipe.numbers')}</Badge>
          </p>
        )}
      </Phase>
      <Phase n={5} title={t('inspector.pipe.respond')} state={ph(turn.responded, false)} />
    </ol>
  );
}
