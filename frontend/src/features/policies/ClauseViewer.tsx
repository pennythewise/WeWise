import { clauseById, clausesFor } from '@/mock/clauses';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { useTranslation } from 'react-i18next';

/** PDF-like page with the cited clause highlighted (PRD §6.4 ClauseViewer, §7 Evidence mini-viewer). */
export function ClauseViewer({ clauseId, compact = false }: { clauseId: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const clause = clauseById(clauseId);
  if (!clause) return null;
  const policy = policyById(clause.policyId);
  const page = clausesFor(clause.policyId).filter((c) => c.page === clause.page);
  return (
    <figure className="overflow-hidden rounded-input border border-line bg-white shadow-sm" aria-label={`${t('chat.page')} ${clause.page}`}>
      <figcaption className="flex items-center justify-between border-b border-line bg-wash px-3 py-1.5 text-xs text-muted">
        <span>{policy ? tx(policy.product) : ''}</span>
        <span>{t('chat.page')} {clause.page}</span>
      </figcaption>
      <div className={`space-y-2 px-3 py-3 font-serif text-[13px] leading-relaxed text-[#43536F] ${compact ? 'max-h-48 overflow-y-auto' : ''}`}>
        {page.map((c) =>
          c.id === clause.id ? (
            <p key={c.id} className="rounded-sm bg-[#FFF3B0] px-1.5 py-1 text-ink" data-highlight>
              <strong className="mr-1 font-sans text-xs text-brand">{c.id}</strong>
              {tx(c.text)}
            </p>
          ) : (
            <p key={c.id} className="px-1.5 opacity-70"><strong className="mr-1 font-sans text-xs">{c.id}</strong>{tx(c.text)}</p>
          ),
        )}
      </div>
    </figure>
  );
}
