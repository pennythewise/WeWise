import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';

/** Simulated push notification (PRD §6.8 step 4), shown at the top of the app column. */
export function ToastHost() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const navigate = useNavigate();
  const toasts = useAgentStore((s) => s.toasts);
  const dismiss = useAgentStore((s) => s.dismissToast);
  useEffect(() => {
    const timers = toasts.map((x) => setTimeout(() => dismiss(x.id), 7000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 space-y-2" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} role="status" className="pointer-events-auto animate-in-bottom rounded-card border border-secline bg-white p-3 shadow-card [animation-duration:240ms]">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-primary"><AppIcon name="bell" size={20} /></span>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { dismiss(x.id); navigate('/claims/clm_mei_001'); }}>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{t('chat.push')}</span>
              <span className="block text-[14px] font-semibold text-ink">{tx(x.title)}</span>
              <span className="block text-[13px] text-body">{tx(x.body)}</span>
            </button>
            <button type="button" className="icon-btn -mr-2 -mt-2" aria-label={t('nav.close')} onClick={() => dismiss(x.id)}><AppIcon name="close" size={18} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
