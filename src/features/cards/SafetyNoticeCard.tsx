import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Txt } from '@/engine/types';
import { Badge, CardShell, Notice } from '@/components/ui';
import { AppIcon } from '@/components/AppIcon';
import { useTx } from '@/i18n/useTx';
import { useUiStore } from '@/store';
import { useBreakpoint } from '@/layout/useBreakpoint';

const mask = (s: string) => s.replace(/\d(?=[\d-]*\d{4})/g, '•');

interface Props { tone: 'info' | 'blocked'; title: Txt; body: Txt; reasonCode: string; snippet?: string; page?: number; next?: Txt }

export function SafetyNoticeCard({ tone, title, body, reasonCode, snippet, page, next }: Props) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const [show, setShow] = useState(false);
  const mode = useBreakpoint();
  const blocked = tone === 'blocked';
  const openSafety = () => {
    const ui = useUiStore.getState();
    ui.setInspectorTab('safety');
    if (mode !== 'showcase') ui.setInspectorOpen(true);
  };
  return (
    <CardShell tone={blocked ? 'danger' : undefined}>
      <div className="flex gap-3" role={blocked ? 'alert' : 'status'}>
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${blocked ? 'bg-[var(--wb-danger-bg)] text-danger' : 'bg-bluewash text-brand'}`}><AppIcon name={blocked ? 'lock' : 'shield'} size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{tx(title)}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-body">{tx(body)}</p>
          <p className="mt-2"><Badge tone={blocked ? 'danger' : 'info'} icon={false}><span className="font-mono">{reasonCode}</span></Badge></p>
        </div>
      </div>
      {snippet && (
        <div className="mt-3">
          <button type="button" className="min-h-touch text-[13px] font-semibold text-primary" aria-expanded={show} onClick={() => setShow(!show)}>{t('cards.safety.view')}</button>
          {show && (
            <div className="rounded-input border border-line bg-surface p-3">
              <p className="mb-1 text-xs text-muted">{t('cards.safety.snippet', { page })}</p>
              <code className="block break-words font-mono text-xs text-ink">{mask(snippet)}</code>
            </div>
          )}
        </div>
      )}
      {next && <div className="mt-3"><Notice tone="info">{tx(next)}</Notice></div>}
      <button type="button" className="mt-2 min-h-touch text-[13px] font-semibold text-primary" onClick={openSafety}>{t('cards.safety.why')}</button>
    </CardShell>
  );
}
