import { useTranslation } from 'react-i18next';
import { useTx } from '@/i18n/useTx';
import type { Txt } from '@/engine/types';

export function TypingIndicator({ progress }: { progress?: { label: Txt; n: number; total: number } }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted" role="status" aria-live="polite">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />)}
      </span>
      {progress ? `${tx(progress.label)}… ${progress.n}/${progress.total}` : t('chat.thinking')}
    </div>
  );
}
