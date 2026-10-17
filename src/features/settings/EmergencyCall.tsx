import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { useAgentStore } from '@/agentStore';
import { useUiStore } from '@/store';
import { incidentFor } from '@/mock/incidents';
import { useTx } from '@/i18n/useTx';

type Phase = 'connecting' | 'live' | 'ended';
const LINE_MS = 3600;

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-14 items-end gap-1" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} className={`w-1.5 rounded-full bg-[#8CA3EF] ${active ? 'animate-pulse' : ''}`} style={{ height: active ? 14 + ((i * 7) % 5) * 9 : 8, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/** C7 emergency calm-down call (frontend mock): connecting → live call with a calming script → summary and next steps. */
export function EmergencyCall() {
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const navigate = useNavigate();
  const { emergencyOpen, setEmergencyOpen } = useUiStore();
  const script = t('emergency.script', { returnObjects: true }) as string[];
  const inc = incidentFor('TH');

  const [phase, setPhase] = useState<Phase>('connecting');
  const [line, setLine] = useState(0);
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const spoken = useRef(-1);

  useEffect(() => { // reset whenever the call is (re)opened
    if (!emergencyOpen) return;
    setPhase('connecting'); setLine(0); setSecs(0); setMuted(false); spoken.current = -1;
    const id = setTimeout(() => setPhase('live'), 1800);
    return () => clearTimeout(id);
  }, [emergencyOpen]);

  useEffect(() => {
    if (phase !== 'live') return;
    const tick = setInterval(() => setSecs((s) => s + 1), 1000);
    const lines = setInterval(() => setLine((l) => Math.min(l + 1, script.length - 1)), LINE_MS);
    return () => { clearInterval(tick); clearInterval(lines); };
  }, [phase, script.length]);

  useEffect(() => { // optional text-to-speech of the script (browser voices; off by default)
    if (phase !== 'live' || !speak || muted || spoken.current === line || !('speechSynthesis' in window)) return;
    spoken.current = line;
    try { const u = new SpeechSynthesisUtterance(script[line]); u.lang = lang === 'zh' ? 'zh-CN' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* TTS unavailable */ }
  }, [phase, speak, muted, line, lang, script]);
  useEffect(() => { if (!emergencyOpen && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, [emergencyOpen]);

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const copy = async (n: string) => { try { await navigator.clipboard.writeText(n); } catch { /* ignore */ } setCopied(n); setTimeout(() => setCopied(null), 1400); };
  const close = () => setEmergencyOpen(false);
  const go = (to: string, send?: string) => { close(); navigate(to); if (send) void useAgentStore.getState().send(send); };
  const ctl = 'flex min-h-[52px] min-w-[52px] flex-col items-center justify-center gap-1 rounded-full px-4 text-xs font-medium';

  return (
    <Dialog.Root open={emergencyOpen} onOpenChange={setEmergencyOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60 data-[state=open]:animate-fade-in" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-1/2 z-50 flex w-[min(100vw,var(--app-max-width))] -translate-x-1/2 flex-col bg-ink text-white outline-none data-[state=open]:animate-fade-in">
          <div className="flex items-center justify-between px-4 pt-4">
            <Badge tone="warn" icon="info">{t('emergency.demo')}</Badge>
            <Dialog.Close className="icon-btn text-white hover:bg-white/10" aria-label={t('nav.close')}><AppIcon name="close" /></Dialog.Close>
          </div>

          {phase !== 'ended' ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-[#8CA3EF]"><AppIcon name="spark" size={38} strokeWidth={1.3} /></span>
                <Dialog.Title className="text-[22px] font-semibold">{t('emergency.title')}</Dialog.Title>
                <p className="text-[13px] text-white/70" aria-live="polite">{phase === 'connecting' ? t('emergency.connecting') : `${t('emergency.live')} · ${mmss}`}</p>
                <Waveform active={phase === 'live' && !muted} />
                <ul className="min-h-[120px] space-y-2 text-[15px] leading-relaxed" aria-live="polite">
                  {phase === 'live' && script.slice(0, line + 1).map((s, i) => <li key={i} className={i === line ? 'text-white' : 'text-white/50'}>{s}</li>)}
                </ul>
              </div>
              <div className="space-y-3 px-4 pb-6">
                <div className="flex justify-center gap-3">
                  <button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)} className={`${ctl} ${muted ? 'bg-white text-ink' : 'bg-white/10'}`}>{muted ? t('emergency.unmute') : t('emergency.mute')}</button>
                  <button type="button" aria-pressed={speak} onClick={() => setSpeak(!speak)} className={`${ctl} ${speak ? 'bg-white text-ink' : 'bg-white/10'}`}>{t('emergency.speaker')}</button>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">{t('emergency.contacts')} · {inc.flag} {tx(inc.name)}</h3>
                {inc.numbers.map((n, i) => (
                  <button key={i} type="button" onClick={() => void copy(n.number)} className="flex min-h-touch w-full items-center justify-between rounded-control bg-white/10 px-4 text-left" aria-label={`${tx(n.label)} ${n.number}, ${t('cards.incident.copy')}`}>
                    <span>{tx(n.label)}</span><span className="font-semibold tabular-nums">{n.number} <span className="ml-1 text-xs font-medium text-[#8CA3EF]">{copied === n.number ? t('cards.incident.copied') : t('cards.incident.copy')}</span></span>
                  </button>
                ))}
                <button type="button" className="min-h-control w-full rounded-control bg-danger px-5 font-semibold text-white" onClick={() => setPhase('ended')}>{t('emergency.end')}</button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-4 px-6">
              <Dialog.Title className="text-[22px] font-semibold">{t('emergency.summary')}</Dialog.Title>
              <p className="text-[13px] text-white/70">{t('emergency.duration', { time: mmss })}</p>
              <ul className="space-y-2 text-[14px] text-white/90">{(t('emergency.next', { returnObjects: true }) as string[]).map((s, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-[#4ADE80]"><AppIcon name="check" size={14} strokeWidth={2} /></span>{s}</li>)}</ul>
              <button type="button" className="btn-primary" onClick={() => go('/ask', t('emergency.incidentSend'))}>{t('emergency.guide')}</button>
              <button type="button" className="min-h-control rounded-control border border-white/40 px-5 font-semibold text-white" onClick={() => go('/capture')}>{t('emergency.capture')}</button>
              <button type="button" className="min-h-touch text-[13px] text-white/70" onClick={close}>{t('nav.close')}</button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
