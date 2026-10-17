import { useTranslation } from 'react-i18next';
import { AppIcon, type IconName } from '@/components/AppIcon';
import { Badge, EmptyState, type Tone } from '@/components/ui';
import type { TurnView } from '@/engine/inspect';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';

type Guard = TurnView['guards'][number];
const mask = (s: string) => s.replace(/\d(?=[\d-]*\d{4})/g, '•');

export function SafetyTab({ turns }: { turns: TurnView[] }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const actions = useAgentStore((s) => s.actionStates);
  const rows = turns.flatMap((tn) => tn.guards.map((g, i) => ({ g, key: `${tn.turnId}-${i}` })));
  if (rows.length === 0) return <EmptyState icon="shield" text={t('inspector.empty.safety')} />;

  const view = (g: Guard): { icon: IconName; tone: Tone; title: string; why: string; code: string; extra?: string } => {
    switch (g.type) {
      case 'guard.pii_masked': return { icon: 'lock', tone: 'info', title: t('inspector.safety.pii', { n: g.fields.length, fields: g.fields.map(tx).join(', ') }), why: g.why ? tx(g.why) : t('inspector.safety.piiWhy'), code: 'PII_MASKED' };
      case 'guard.injection_flagged': return { icon: 'scan', tone: 'warn', title: t('inspector.safety.injection', { page: g.page ?? '?' }), why: g.why ? tx(g.why) : t('inspector.safety.injectionWhy'), code: 'INJECTION_FLAGGED', extra: mask(g.snippet) };
      case 'guard.denied': return { icon: 'close', tone: 'danger', title: tx(g.title), why: tx(g.why), code: g.reasonCode };
      case 'guard.confirm_required': {
        const st = actions[g.actionId] ?? 'pending';
        return { icon: 'info', tone: st === 'pending' ? 'warn' : 'ok', title: `${tx(g.what)} · ${t(`inspector.safety.${st}`)}`, why: g.why ? tx(g.why) : t('inspector.safety.confirmWhy'), code: 'CONFIRM_REQUIRED' };
      }
    }
  };
  return (
    <ul className="space-y-2">
      {rows.map(({ g, key }) => {
        const v = view(g);
        return (
          <li key={key} className={`animate-in-bottom rounded-card border bg-white p-3 [animation-duration:180ms] ${v.tone === 'danger' ? 'border-[#F6CBC6]' : 'border-cardline'}`}>
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 ${v.tone === 'danger' ? 'text-danger' : v.tone === 'warn' ? 'text-warn' : v.tone === 'ok' ? 'text-ok' : 'text-brand'}`}><AppIcon name={v.icon} size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug text-ink">{v.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-body"><span className="font-semibold">{t('inspector.safety.protects')}</span> {v.why}</p>
                {v.extra && <code className="mt-1.5 block break-words rounded-input bg-surface p-2 font-mono text-xs text-body">{v.extra}</code>}
                <p className="mt-1.5"><Badge tone={v.tone} icon={false}><span className="font-mono">{v.code}</span></Badge></p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
