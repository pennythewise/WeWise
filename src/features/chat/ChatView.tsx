import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import type { Chip } from '@/engine/types';
import { useAgentStore } from '@/agentStore';
import { AssistantBubble, UserBubble } from './MessageBubble';
import { Chips } from './Chips';
import { Composer } from './Composer';
import { Notice } from '@/components/ui';

const useDefaultChips = (): Chip[] => {
  const { t } = useTranslation();
  return [
    { label: t('chat.chips.policy'), send: t('chat.chips.policySend') },
    { label: t('chat.chips.claim'), send: t('chat.chips.claimSend') },
    { label: t('chat.chips.compare'), send: t('chat.chips.compareSend') },
  ];
};

export function ChatView() {
  const { t } = useTranslation();
  const messages = useAgentStore((s) => s.messages);
  const running = useAgentStore((s) => s.running);
  const defaults = useDefaultChips();
  const endRef = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' }); }, [messages, reduce]);

  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  const chips = last && last.status === 'done' ? (last.chips.length >= 3 ? last.chips : [...last.chips, ...defaults].slice(0, Math.max(3, last.chips.length))) : last ? [] : defaults;

  return (
    <div className="flex h-full min-h-0 flex-col" data-screen="ask">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-wash px-4 py-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bluewash text-primary" aria-hidden="true"><AppIcon name="spark" size={18} strokeWidth={1.8} /></span>
            <div className="space-y-2">
              <p className="rounded-[16px] rounded-tl-[4px] border border-cardline bg-white px-3.5 py-3 text-[14px] leading-[1.7] text-body">{t('chat.greeting')}</p>
              <Notice tone="info">{t('chat.scope')}</Notice>
            </div>
          </div>
        )}
        {messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} />))}
        {chips.length > 0 && !running && <Chips chips={chips} />}
        <div ref={endRef} />
      </div>
      <Composer />
    </div>
  );
}
