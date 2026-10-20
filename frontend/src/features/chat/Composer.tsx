import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { FIXTURES } from '@/mock/fixtures';
import { agentClient } from '@/engine';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';
import { useVoiceInput } from './useVoiceInput';

/** Text, attach (demo documents or a real file), mic (roadmap), send. Sticky bottom, respects safe-area. */
export function Composer() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const { draft, setDraft, pendingFiles, addPendingFile, running, send } = useAgentStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tray, setTray] = useState(false);
  const voice = useVoiceInput();
  const can = (draft.trim().length > 0 || pendingFiles.length > 0) && !running;

  const submit = () => { if (can) void send(draft.trim()); };
  const attach = async (f: File | { name: string; fixtureId: string }) => { setTray(false); addPendingFile(await agentClient.uploadFile(f)); };

  return (
    <div className="shrink-0 bg-wash px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
      {pendingFiles.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((f) => <li key={f.id} className="inline-flex items-center gap-1.5 rounded-input border border-secline bg-bluewash px-2.5 py-1 text-xs text-brand"><AppIcon name="file" size={14} />{f.name}</li>)}
        </ul>
      )}
      {voice.listening && (
        <div className="mb-2 flex items-center gap-3 rounded-input bg-[var(--wb-danger-bg)] px-3 py-2 text-[13px] text-danger" role="status" aria-live="polite">
          <span className="flex h-5 items-end gap-0.5" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="w-1 animate-pulse rounded-full bg-danger" style={{ height: 6 + ((i * 5) % 4) * 4, animationDelay: `${i * 110}ms` }} />)}</span>
          {t('chat.listening')}{!voice.real && <span className="text-xs text-muted"> · {t('chat.voiceDemo')}</span>}
        </div>
      )}
      {tray && (
        <div className="mb-2 animate-fade-in rounded-card border border-cardline bg-wash p-1.5" data-testid="attach-tray">
          <p className="px-2 py-1 text-xs font-semibold text-muted">{t('chat.demoDocs')}</p>
          {FIXTURES.map((f) => (
            <button type="button" key={f.id} className="flex min-h-touch w-full items-center gap-2 rounded-control px-2 text-left text-[13px] text-ink hover:bg-white" onClick={() => void attach({ name: f.name, fixtureId: f.id })}>
              <AppIcon name="scan" size={18} />{tx(f.label)}
            </button>
          ))}
          <button type="button" className="flex min-h-touch w-full items-center gap-2 rounded-control px-2 text-left text-[13px] text-ink hover:bg-white" onClick={() => { setTray(false); fileRef.current?.click(); }}>
            <AppIcon name="arrowUp" size={18} />{t('chat.fromDevice')}
          </button>
        </div>
      )}
      <div className="rounded-[22px] border border-line bg-white p-2 shadow-card focus-within:border-secline">
        <textarea
          rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          className="max-h-28 min-h-[40px] w-full resize-none bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
        <div className="flex items-center gap-1">
          <button type="button" className={`icon-btn shrink-0 ${tray ? 'bg-bluewash text-primary' : 'text-brand'}`} aria-label={t('chat.attach')} aria-expanded={tray} onClick={() => setTray(!tray)} data-testid="attach"><AppIcon name="file" /></button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ''; }} />
          <button type="button" onClick={voice.listening ? voice.stop : voice.start} aria-pressed={voice.listening} disabled={running} aria-label={voice.listening ? t('chat.micStop') : t('chat.mic')} title={t('chat.mic')}
            className={`icon-btn shrink-0 ${voice.listening ? 'bg-danger text-white hover:bg-danger' : 'text-brand'}`} data-testid="mic"><AppIcon name="mic" /></button>
          <button type="button" onClick={submit} disabled={!can} aria-label={t('chat.send')} className="ml-auto flex h-touch w-touch shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"><AppIcon name="arrowUp" /></button>
        </div>
      </div>
    </div>
  );
}
