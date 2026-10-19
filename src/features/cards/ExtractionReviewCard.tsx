import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExtractedField } from '@/engine/types';
import { Badge, CardShell } from '@/components/ui';
import { ClauseViewer } from '../policies/ClauseViewer';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { useExtractionStore } from './extractionStore';
import { confirmExtraction } from './extractionActions';

const GROUPS = ['basics', 'limits', 'waiting', 'exclusions'] as const;

function Confidence({ c }: { c: number }) {
  const { t } = useTranslation();
  if (c >= 0.9) return <Badge tone="ok" icon="check">{t('cards.extract.high')}</Badge>;
  if (c >= 0.75) return <Badge tone="warn" icon="info">{t('cards.extract.medium')}</Badge>;
  return <Badge tone="danger" icon="info">{t('cards.extract.low')}</Badge>;
}

export function ExtractionReviewCard({ fields }: { fields: ExtractedField[] }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const { corrections, editing, confirmed, setCorrection, setEditing } = useExtractionStore();
  const [viewer, setViewer] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const running = useAgentStore((s) => s.running);

  const confirmAll = confirmExtraction;
  const lowCount = fields.filter((f) => f.confidence < 0.75 && !corrections[f.key]).length;

  return (
    <CardShell title={t('cards.extract.title')} icon="scan" right={confirmed ? <Badge tone="ok">{t('cards.extract.confirmed')}</Badge> : undefined}>
      <div className="space-y-4">
        {GROUPS.map((g) => (
          <div key={g}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t(`cards.extract.group.${g}`)}</h4>
            <ul className="divide-y divide-cardline rounded-input border border-cardline">
              {fields.filter((f) => f.group === g).map((f) => {
                const fixed = corrections[f.key];
                const low = f.confidence < 0.75 && !fixed;
                return (
                  <li key={f.key} className={`px-3 py-2.5 ${low ? 'bg-[var(--wb-danger-bg)]/50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{tx(f.label)}</p>
                        {editing === f.key ? (
                          <div className="mt-1 flex gap-2">
                            <input
                              autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={tx(f.label)}
                              className="min-h-[44px] w-full min-w-0 rounded-input border border-line px-3 text-[14px] text-ink"
                            />
                            <button type="button" className="btn-primary btn-compact" onClick={() => { setCorrection(f.key, draft); setEditing(null); }}>{t('cards.extract.save')}</button>
                          </div>
                        ) : (
                          <p className="text-[14px] font-semibold text-ink">
                            {fixed ?? tx(f.value)}
                            {fixed && <span className="ml-2 text-xs font-medium text-ok">{t('cards.extract.corrected')}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button type="button" onClick={() => setViewer(viewer === f.key ? null : f.key)} disabled={!f.clauseId} aria-expanded={f.clauseId ? viewer === f.key : undefined} className={`rounded-full px-2 py-0.5 text-xs disabled:cursor-default ${viewer === f.key ? 'bg-primary text-white' : 'bg-wash text-muted'}`} aria-label={`${t('chat.page')} ${f.page}`}>p.{f.page}</button>
                        {!fixed && <Confidence c={f.confidence} />}
                      </div>
                    </div>
                    {viewer === f.key && f.clauseId && (
                      <div className="mt-2 animate-fade-in">
                        <p className="mb-1 text-xs font-semibold text-muted">{t('cards.extract.source')}</p>
                        <ClauseViewer clauseId={f.clauseId} compact />
                      </div>
                    )}
                    {editing !== f.key && !confirmed && (
                      <button type="button" className="mt-1 min-h-[36px] text-[13px] font-semibold text-primary" onClick={() => { setDraft(fixed ?? ''); setEditing(f.key); }}>
                        {t('cards.extract.correct')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {!confirmed && (
        <div className="mt-4 space-y-2">
          {lowCount > 0 && <p className="text-[13px] text-warn">{t('cards.extract.lowHint', { count: lowCount })}</p>}
          <button type="button" className="btn-primary w-full" onClick={confirmAll} disabled={running}>{t('cards.extract.confirmAll')}</button>
        </div>
      )}
    </CardShell>
  );
}
