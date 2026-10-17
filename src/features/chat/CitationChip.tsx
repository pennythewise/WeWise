import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { clauseById } from '@/mock/clauses';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { useUiStore } from '@/store';
import { useAgentStore } from '@/agentStore';
import { useBreakpoint } from '@/layout/useBreakpoint';

/** `[HS-4.2 · p.8]` chip. Popover shows the verbatim quote; "See evidence" jumps the Inspector to the Evidence tab. */
export function CitationChip({ id, messageId }: { id: string; messageId?: string }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const mode = useBreakpoint();
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
    <Popover.Root>
      <Popover.Trigger
        className="mx-0.5 inline-flex min-h-[24px] items-center rounded-full border border-secline bg-bluewash px-2 align-baseline text-xs font-semibold text-brand hover:bg-[#dfe8fb]"
        aria-label={`${t('chat.citation')} ${id}, ${t('chat.page')} ${clause.page}`}
      >
        {id} · p.{clause.page}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-[60] w-[min(86vw,320px)] rounded-card border border-cardline bg-white p-4 shadow-card">
          <p className="text-xs font-semibold text-brand">{id} · {tx(clause.title)}</p>
          <blockquote className="mt-2 border-l-[3px] border-primary bg-bluewash px-3 py-2 text-[13px] leading-relaxed text-ink">“{tx(clause.text)}”</blockquote>
          <p className="mt-2 text-xs text-muted">{policy ? tx(policy.product) : ''} · {t('chat.page')} {clause.page}</p>
          <button type="button" onClick={seeEvidence} className="mt-3 min-h-touch text-[13px] font-semibold text-primary">{t('chat.seeEvidence')}</button>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const TOKEN = /\[\[([A-Z]{2}-\d+\.\d+)\]\]/g;
/** Renders text with `[[HS-4.2]]` markers as citation chips. */
export function RichText({ text, messageId }: { text: string; messageId?: string }) {
  const parts = text.split(TOKEN);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <CitationChip key={i} id={p} messageId={messageId} /> : <span key={i}>{p}</span>))}</>;
}
