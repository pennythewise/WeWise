import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { CardView } from '../cards/CardView';
import { RichText } from './CitationChip';
import { TypingIndicator } from './TypingIndicator';
import { pick, type Locale } from '@/engine/l';
import type { Verdict } from '@/engine/types';
import type { ChatMessage } from '@/agentStore';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';
import { useUiStore } from '@/store';
import { useBreakpoint } from '@/layout/useBreakpoint';

const VERDICT: Record<Verdict, { tone: 'ok' | 'danger' | 'warn' | 'neutral'; icon: 'check' | 'close' | 'info' }> = {
  covered: { tone: 'ok', icon: 'check' }, not_covered: { tone: 'danger', icon: 'close' }, depends: { tone: 'warn', icon: 'info' }, unsure: { tone: 'neutral', icon: 'info' },
};

export function UserBubble({ m }: { m: ChatMessage }) {
  const { tx } = useTx();
  return (
    <div className="flex flex-col items-end gap-1">
      {m.attachments?.map((a) => (
        <span key={a.id} className="inline-flex max-w-[85%] items-center gap-1.5 rounded-input border border-secline bg-white px-2.5 py-1.5 text-xs text-brand"><AppIcon name="file" size={15} /><span className="truncate">{a.name}</span></span>
      ))}
      {m.text && <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] rounded-br-[4px] bg-primary px-3.5 py-2.5 text-[14px] leading-relaxed text-white">{tx(m.text)}</p>}
    </div>
  );
}

export function AssistantBubble({ m }: { m: ChatMessage }) {
  const { t } = useTranslation();
  const { lang: uiLang } = useTx();
  const mode = useBreakpoint();
  const [override, setOverride] = useState<Locale | null>(null);
  const lang = override ?? uiLang;
  const other: Locale = lang === 'en' ? 'zh' : 'en';
  const selected = useAgentStore((s) => s.selectedMessageId === m.id);

  const howIKnow = () => {
    useAgentStore.getState().selectMessage(m.id);
    const ui = useUiStore.getState();
    ui.setInspectorTab(m.citations.length ? 'evidence' : 'pipeline');
    if (mode !== 'showcase') ui.setInspectorOpen(true);
  };
  const v = m.verdict ? VERDICT[m.verdict] : null;

  return (
    <div className="flex gap-2.5" data-msg={m.id}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bluewash text-primary" aria-hidden="true"><AppIcon name="spark" size={18} strokeWidth={1.8} /></span>
      <div className="min-w-0 flex-1 space-y-2">
        {m.status === 'streaming' && !m.text && <TypingIndicator progress={m.progress} />}
        {(m.text || m.cards.length > 0) && m.status === 'streaming' && m.progress && <TypingIndicator progress={m.progress} />}
        {m.text && (
          <div className={`rounded-[16px] rounded-tl-[4px] border bg-white px-3.5 py-3 text-[14px] leading-[1.7] text-body ${selected ? 'border-primary' : 'border-cardline'}`}>
            {v && <p className="mb-2"><Badge tone={v.tone} icon={v.icon}>{t(`chat.verdict.${m.verdict}`)}</Badge></p>}
            <p><RichText text={pick(m.text, lang)} messageId={m.id} /></p>
            {m.bullets && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {m.bullets.map((b, i) => <li key={i}><RichText text={pick(b, lang)} messageId={m.id} /></li>)}
              </ul>
            )}
            {m.verdict === 'depends' || m.verdict === 'unsure' ? (
              <button type="button" className="mt-2 min-h-touch text-[13px] font-semibold text-primary" onClick={() => void useAgentStore.getState().send(t('cards.verdict.talkSend'))}>{t('chat.askAgent')}</button>
            ) : null}
          </div>
        )}
        {m.cards.map((c) => <CardView key={c.id} card={c} messageId={m.id} />)}
        {m.status === 'done' && m.text && (
          <div className="flex flex-wrap items-center gap-x-4">
            <button type="button" className="min-h-touch text-[13px] font-semibold text-primary" onClick={howIKnow}>{t('chat.howIKnow')}</button>
            <button type="button" className="min-h-touch text-[13px] font-medium text-muted" onClick={() => setOverride(override ? null : other)} aria-pressed={!!override}>
              {override ? t('chat.original') : t('chat.translate', { lang: other === 'en' ? 'EN' : '中文' })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
