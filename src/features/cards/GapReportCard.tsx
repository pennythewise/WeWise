import { useTranslation } from 'react-i18next';
import type { GapRow } from '@/engine/types';
import { Badge, CardShell, Notice } from '@/components/ui';
import { CitationChip } from '../chat/CitationChip';
import { useTx } from '@/i18n/useTx';
import type { Txt } from '@/engine/types';

export function GapReportCard({ rows, considerations, messageId }: { rows: GapRow[]; considerations: Txt[]; messageId?: string }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  return (
    <CardShell title={t('cards.gap.title')} icon="shield">
      <ul className="divide-y divide-cardline">
        {rows.map((r, i) => (
          <li key={i} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">{tx(r.area)}</span>
              {r.status === 'covered' && <Badge tone="ok" icon="check">{t('cards.gap.covered')}</Badge>}
              {r.status === 'partial' && <Badge tone="warn" icon="info">{t('cards.gap.partial')}</Badge>}
              {r.status === 'gap' && <Badge tone="danger" icon="close">{t('cards.gap.gap')}</Badge>}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-body">
              {tx(r.why)} {r.cite ? <CitationChip id={r.cite} messageId={messageId} /> : <span className="text-xs text-muted">({t('cards.gap.noClause')})</span>}
            </p>
          </li>
        ))}
      </ul>
      <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('cards.gap.consider')}</h4>
      <ol className="list-decimal space-y-1 pl-5 text-[13px] text-body">{considerations.map((c, i) => <li key={i}>{tx(c)}</li>)}</ol>
      <div className="mt-3"><Notice tone="info">{t('cards.gap.notice')}</Notice></div>
    </CardShell>
  );
}
