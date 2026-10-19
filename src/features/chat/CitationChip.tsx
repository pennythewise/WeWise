import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clauseById } from '@/mock/clauses';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { useUiStore } from '@/store';
import { useAgentStore } from '@/agentStore';
import { useBreakpoint } from '@/layout/useBreakpoint';

/** `[HS-4.2 · p.8]` chip. Tapping it expands the verbatim quote inline (no pop-up); "See evidence" jumps the Inspector to the Evidence tab. */
export function CitationChip({ id, messageId }: { id: string; messageId?: string }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const mode = useBreakpoint();
  const [open, setOpen] = useState(false);
  const clause = clauseById(id);
  if (!clause) return <span className="rounded bg-wash px-1 text-xs">[{id}]</span>;
  const policy = policyById(clause.policyId);

  const seeEvidence = () => {
    if (messageId) useAgentStore.getState().selectMessage(messageId);
    const ui = useUiStore.getState();
    ui.setInspectorTab('evidence');
    if (mode !== 'showcase') ui.setInspectorOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`mx-0.5 inline-flex min-h-[24px] items-center rounded-full border px-2 align-baseline text-xs font-semibold ${open ? 'border-primary bg-primary text-white' : 'border-secline bg-bluewash text-brand hover:bg-[#dfe8fb]'}`}
        aria-label={`${t('chat.citation')} ${id}, ${t('chat.page')} ${clause.page}`}
      >
        {id} · p.{clause.page}
      </button>
      {open && (
        <span className="my-2 block animate-fade-in rounded-input border border-cardline bg-white p-3 text-left font-normal" role="note">
          <span className="block text-xs font-semibold text-brand">{id} · {tx(clause.title)}</span>
          <span className="mt-2 block border-l-[3px] border-primary bg-bluewash px-3 py-2 text-[13px] leading-relaxed text-ink">“{tx(clause.text)}”</span>
          <span className="mt-2 block text-xs text-muted">{policy ? tx(policy.product) : ''} · {t('chat.page')} {clause.page}</span>
          <span className="mt-1 flex gap-4">
            <button type="button" onClick={seeEvidence} className="min-h-touch text-[13px] font-semibold text-primary">{t('chat.seeEvidence')}</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-touch text-[13px] font-medium text-muted">{t('nav.close')}</button>
          </span>
        </span>
      )}
    </>
  );
}

const TOKEN = /\[\[([A-Z]{2}-\d+\.\d+)\]\]/g;
/** Renders text with `[[HS-4.2]]` markers as citation chips. */
export function RichText({ text, messageId }: { text: string; messageId?: string }) {
  const parts = text.split(TOKEN);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <CitationChip key={i} id={p} messageId={messageId} /> : <span key={i}>{p}</span>))}</>;
}
