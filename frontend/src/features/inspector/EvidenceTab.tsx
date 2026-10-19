import { useTranslation } from 'react-i18next';
import { Badge, EmptyState } from '@/components/ui';
import { clauseById } from '@/mock/clauses';
import { SAMPLE_POLICY_FIELDS } from '@/mock/fixtures';
import { ClauseViewer } from '../policies/ClauseViewer';
import { useAgentStore } from '@/agentStore';
import { useExtractionStore } from '../cards/extractionStore';
import { useTx } from '@/i18n/useTx';

/** Citations behind the selected answer: verbatim quote, page and extraction confidence (PRD §7). */
export function EvidenceTab() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const msg = useAgentStore((s) => s.messages.find((m) => m.id === s.selectedMessageId));
  const corrections = useExtractionStore((s) => s.corrections);
  const ids = [...new Set(msg?.citations ?? [])];
  if (ids.length === 0) return <EmptyState icon="file" text={t('inspector.empty.evidence')} />;
  return (
    <ul className="space-y-3">
      {ids.map((id) => {
        const c = clauseById(id);
        if (!c) return null;
        const field = SAMPLE_POLICY_FIELDS.find((f) => f.clauseId === id);
        const fixed = field && corrections[field.key];
        return (
          <li key={id} className="space-y-2 rounded-card border border-cardline bg-white p-3" data-evidence={id}>
            <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-brand">{id} · p.{c.page}</span><span className="min-w-0 flex-1 truncate text-[13px] text-ink">{tx(c.title)}</span></div>
            <blockquote className="border-l-[3px] border-primary bg-bluewash px-3 py-2 text-[13px] leading-relaxed text-ink">“{tx(c.text)}”</blockquote>
            {field && <p className="flex items-center gap-2 text-xs text-muted">{t('inspector.evidence.confidence')}: <Badge tone={fixed || field.confidence >= 0.9 ? 'ok' : field.confidence >= 0.75 ? 'warn' : 'danger'} icon={false}>{fixed ? t('inspector.evidence.userConfirmed') : `${Math.round(field.confidence * 100)}%`}</Badge></p>}
            <details><summary className="min-h-[32px] cursor-pointer text-[13px] font-semibold text-primary">{t('inspector.evidence.viewPage')}</summary><div className="mt-2"><ClauseViewer clauseId={id} compact /></div></details>
          </li>
        );
      })}
    </ul>
  );
}
