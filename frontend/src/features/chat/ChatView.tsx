import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import type { Chip } from '@/engine/types';
import { useAgentStore } from '@/agentStore';
import { AssistantBubble, UserBubble } from './MessageBubble';
import { Chips } from './Chips';
import { Composer } from './Composer';
import { Notice } from '@/components/ui';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { useTypingStore } from './typingStore';

const useDefaultChips = (): Chip[] => {
  const { t } = useTranslation();
  return [
    { label: t('chat.chips.policy'), send: t('chat.chips.policySend') },
    { label: t('chat.chips.claim'), send: t('chat.chips.claimSend') },
    { label: t('chat.chips.compare'), send: t('chat.chips.compareSend') },
    { label: L('Cover for where I live', '适合我所在地的保障'), send: L('Suggest insurance based on my location', '根据我的位置推荐保险') },
    { label: L('Accident abroad', '国外出事故'), send: L('I had an accident abroad', '我在国外出了事故') },
    { label: L('Am I paying twice?', '有没有重复投保？'), send: L('Am I paying twice for anything?', '我有没有重复投保？') },
    { label: L('Told to switch policy', '被劝退保换新'), send: L('An agent told my dad to cancel his policy and buy a new one', '有人让我爸退掉旧保单换新的') },
  ];
};

export function ChatView() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const messages = useAgentStore((s) => s.messages);
  const running = useAgentStore((s) => s.running);
  const defaults = useDefaultChips();
  const typing = useTypingStore((s) => s.typingId !== null);
  const endRef = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' }); }, [messages, reduce]);

  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  const chips = last && last.status === 'done' ? (last.chips.length >= 3 ? last.chips : [...last.chips, ...defaults].slice(0, Math.max(3, last.chips.length))) : last ? [] : defaults;

  return (
    <div className="flex h-full min-h-0 flex-col" data-screen="ask">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-wash px-4 py-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="space-y-4">
            <h2 className="pt-2 text-[26px] font-semibold leading-tight text-ink">{tx(L('How can I help with your cover today?', '今天想了解哪方面的保障？'))}</h2>
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bluewash text-primary" aria-hidden="true"><AppIcon name="spark" size={18} strokeWidth={1.8} /></span>
            <div className="space-y-2">
              <p className="rounded-[16px] rounded-tl-[4px] border border-cardline bg-white px-3.5 py-3 text-[14px] leading-[1.7] text-body">{t('chat.greeting')}</p>
              <Notice tone="info">{t('chat.scope')}</Notice>
            </div>
          </div>
          </div>
        )}
        {messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} />))}
        {chips.length > 0 && !running && !typing && <Chips chips={chips} />}
        <div ref={endRef} />
      </div>
      <Composer />
    </div>
  );
}
