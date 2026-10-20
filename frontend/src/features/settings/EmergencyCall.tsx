import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, Notice } from '@/components/ui';
import { L } from '@/engine/l';
import { useAgentStore } from '@/agentStore';
import { incidentFor } from '@/mock/incidents';
import { INSURERS } from '@/mock/insurers';
import { cityById } from '@/mock/cities';
import { useTx } from '@/i18n/useTx';
import { useLocationStore } from '../location/locationStore';

type Phase = 'connecting' | 'live' | 'ended';
const LINE_MS = 3600;

/** Real phone lines, configured at build time (see docs/EMERGENCY_CALL.md). Empty = not configured. */
const AI_HOTLINE = (import.meta.env.VITE_AI_HOTLINE ?? '').trim();
const AI_CALLBACK_URL = (import.meta.env.VITE_AI_CALLBACK_URL ?? '').trim();
const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} className={`w-1.5 rounded-full bg-primary/70 ${active ? 'animate-pulse' : ''}`} style={{ height: active ? 12 + ((i * 7) % 5) * 8 : 6, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

/** A number that really dials. Emergency services ask for a second tap so a demo can't call them by accident. */
function DialRow({ label, number, confirm }: { label: string; number: string; confirm?: boolean }) {
  const { tx } = useTx();
  const [arm, setArm] = useState(false);
  return (
    <li className="rounded-input border border-cardline bg-white">
      <div className="flex min-h-touch items-center gap-3 px-3 py-2">
        <span className="min-w-0 flex-1 text-[14px] text-ink">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{number}</span>
        {confirm
          ? <button type="button" className="btn-secondary btn-compact" aria-expanded={arm} onClick={() => setArm(!arm)}><AppIcon name="bell" size={16} />{tx(L('Call', '拨打'))}</button>
          : <a className="btn-secondary btn-compact" href={tel(number)}><AppIcon name="bell" size={16} />{tx(L('Call', '拨打'))}</a>}
      </div>
      {arm && (
        <div className="flex animate-fade-in items-center gap-2 border-t border-cardline bg-[var(--wb-danger-bg)] px-3 py-2">
          <p className="min-w-0 flex-1 text-[13px] text-danger">{tx(L(`This calls ${number} for real. Only for a real emergency.`, `将真实拨打 ${number}，仅限真实紧急情况。`))}</p>
          <a className="btn-compact inline-flex min-h-[38px] items-center rounded-control bg-danger px-3 text-[13px] font-semibold text-white" href={tel(number)} onClick={() => setArm(false)}>{tx(L('Call now', '立即拨打'))}</a>
          <button type="button" className="min-h-[38px] px-2 text-[13px] font-medium text-muted" onClick={() => setArm(false)}>{tx(L('Cancel', '取消'))}</button>
        </div>
      )}
    </li>
  );
}

/** Default backend endpoint (backend/app/voice_callback.py, Vapi). VITE_AI_CALLBACK_URL can point elsewhere. */
const CALLBACK_URL = AI_CALLBACK_URL || '/api/voice-callback';

/** Ask the AI voice line (Vapi) to ring the user's phone. The key stays on the backend. */
function CallMeBack({ city }: { city: string }) {
  const { tx, lang } = useTx();
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const send = async () => {
    setState('sending'); setMessage('');
    try {
      const r = await fetch(CALLBACK_URL, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, lang, city, consent }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) { setState('ok'); setMessage(data.to ?? ''); } else { setState('error'); setMessage(typeof data.detail === 'string' ? data.detail : ''); }
    } catch { setState('error'); }
  };
  if (state === 'ok') return <p className="flex items-center gap-2 text-[13px] text-ok" data-testid="callback-ok"><AppIcon name="check" size={16} />{tx(L(`Calling ${message} now. Answer to talk to the WeWise assistant.`, `正在拨打 ${message}，请接听与微晓助手通话。`))}</p>;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted" htmlFor="cb-phone">{tx(L('Your phone number (with country code, e.g. +65)', '您的手机号（含国家区号，如 +65）'))}</label>
      <div className="flex gap-2">
        <input id="cb-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+65 9123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-[44px] min-w-0 flex-1 rounded-input border border-line px-3 text-[15px] text-ink" />
        <button type="button" className="btn-primary btn-compact shrink-0" disabled={phone.replace(/\D/g, '').length < 8 || !consent || state === 'sending'} onClick={() => void send()} data-testid="call-me">{state === 'sending' ? '…' : tx(L('Call me', '给我回电'))}</button>
      </div>
      <label className="flex items-start gap-2 text-[13px] text-body">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--wb-primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {tx(L('I agree to receive an AI call from WeWise. The call is handled by Vapi and may be transcribed.', '我同意接听微晓的 AI 来电。通话由 Vapi 处理，可能被转写。'))}
      </label>
      {state === 'error' && <p className="text-[13px] text-danger">{message || tx(L('Couldn\'t reach the call service. Use the numbers below.', '无法连接呼叫服务，请使用下方电话。'))}</p>}
      <p className="text-xs text-muted">{tx(L('If anyone is hurt, call local emergency services first. Do not wait for the AI call.', '如有人受伤，请先拨打当地急救电话，不要等待 AI 来电。'))}</p>
    </div>
  );
}

/** Whether the backend has Vapi configured (GET /api/voice-callback). */
function useCallbackReady() {
  const [ready, setReady] = useState(!!AI_CALLBACK_URL);
  useEffect(() => {
    if (AI_CALLBACK_URL) return;
    fetch('/api/voice-callback').then((r) => r.json()).then((d) => setReady(!!d.configured)).catch(() => setReady(false));
  }, []);
  return ready;
}

/**
 * C7 emergency help, in the app's light theme.
 * Real calls: local emergency numbers (by location), the insurers' 24-hour hotlines, and optionally a real AI voice line.
 * The in-app AI calm-down conversation is a frontend simulation.
 */
export function EmergencyCall() {
  const { t } = useTranslation();
  const { tx, lang } = useTx();
  const navigate = useNavigate();
  const { cityId } = useLocationStore();
  const callbackReady = useCallbackReady();
  const script = t('emergency.script', { returnObjects: true }) as string[];
  const city = cityId ? cityById(cityId) : null;
  const inc = incidentFor(city?.country ?? 'CN');
  // Unreviewed countries have no numbers (upstream rule): never guess another country's number.
  const ambulance = inc.numbers.find((n) => /ambulance|emergency/i.test(n.label.en)) ?? inc.numbers[0];

  const [phase, setPhase] = useState<Phase>('connecting');
  const [line, setLine] = useState(0);
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speak, setSpeak] = useState(false);
  const spoken = useRef(-1);

  useEffect(() => { const id = setTimeout(() => setPhase('live'), 1800); return () => clearTimeout(id); }, []);
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
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const go = (to: string, send?: string) => { navigate(to); if (send) void useAgentStore.getState().send(send); };
  const ctl = 'min-h-[44px] rounded-full border px-4 text-[13px] font-medium';

  return (
    <div className="space-y-4" data-screen="emergency">
      <section className="rounded-card border border-[#F6CBC6] bg-[var(--wb-danger-bg)] p-4">
        <p className="text-[15px] font-semibold text-ink">{tx(L('Is anyone hurt?', '有人受伤吗？'))}</p>
        {ambulance ? (
          <>
            <p className="mt-0.5 text-[13px] text-body">{tx(L(`Call ${tx(ambulance.label)} first. WeWise can help with the insurance afterwards.`, `请先拨打${tx(ambulance.label)}，保险的事之后微晓帮您处理。`))}</p>
            <ul className="mt-3"><DialRow label={`${inc.flag} ${tx(ambulance.label)}`} number={ambulance.number} confirm /></ul>
          </>
        ) : <p className="mt-0.5 text-[13px] text-body">{tx(L('No reviewed emergency number for this location. Use official local emergency information now; don\'t wait for insurance or AI.', '此地暂无已核验的紧急电话。请立即查找官方当地紧急服务，不要等待保险或 AI。'))}</p>}
      </section>

      <CardShell title={t('emergency.title')} icon="spark" right={<Badge tone="warn" icon="info">{t('emergency.demo')}</Badge>}>
        {phase !== 'ended' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bluewash text-primary"><AppIcon name="spark" size={30} strokeWidth={1.4} /></span>
            <p className="text-[13px] text-muted" aria-live="polite">{phase === 'connecting' ? t('emergency.connecting') : `${t('emergency.live')} · ${mmss}`}</p>
            <Waveform active={phase === 'live' && !muted} />
            <ul className="min-h-[96px] space-y-1.5 text-[15px] leading-relaxed" aria-live="polite">
              {phase === 'live' && script.slice(0, line + 1).map((s, i) => <li key={i} className={i === line ? 'text-ink' : 'text-muted'}>{s}</li>)}
            </ul>
            <div className="flex justify-center gap-2">
              <button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)} className={`${ctl} ${muted ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`}>{muted ? t('emergency.unmute') : t('emergency.mute')}</button>
              <button type="button" aria-pressed={speak} onClick={() => setSpeak(!speak)} className={`${ctl} ${speak ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`}>{t('emergency.speaker')}</button>
              <button type="button" onClick={() => setPhase('ended')} className={`${ctl} border-danger bg-white text-danger`}>{t('emergency.end')}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[17px] font-semibold text-ink">{t('emergency.summary')}</p>
            <p className="text-[13px] text-muted">{t('emergency.duration', { time: mmss })}</p>
            <ul className="space-y-1.5 text-[14px] text-body">{(t('emergency.next', { returnObjects: true }) as string[]).map((s, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-ok"><AppIcon name="check" size={14} strokeWidth={2} /></span>{s}</li>)}</ul>
            <button type="button" className="btn-primary w-full" onClick={() => go('/ask', t('emergency.incidentSend'))}>{t('emergency.guide')}</button>
            <button type="button" className="btn-secondary w-full" onClick={() => go('/capture')}>{t('emergency.capture')}</button>
          </div>
        )}
      </CardShell>

      <CardShell title={tx(L('Talk to the AI on a real phone call', '用真实电话与 AI 通话'))} icon="bell">
        {AI_HOTLINE || callbackReady ? (
          <div className="space-y-3">
            {AI_HOTLINE && <a href={tel(AI_HOTLINE)} className="btn-primary w-full" data-testid="ai-hotline"><AppIcon name="bell" size={18} />{tx(L('Call the WeWise AI line', '拨打微晓 AI 热线'))} · {AI_HOTLINE}</a>}
            {callbackReady && <CallMeBack city={city?.id ?? ''} />}
          </div>
        ) : (
          <Notice tone="info">{tx(L('The real AI phone line isn\'t connected in this build. Start the backend with VAPI_API_KEY, VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID in .env, or set VITE_AI_HOTLINE.', '本版本未接入真实 AI 电话。请在 .env 中配置 VAPI_API_KEY、VAPI_ASSISTANT_ID、VAPI_PHONE_NUMBER_ID 并启动后端，或设置 VITE_AI_HOTLINE。'))}</Notice>
        )}
      </CardShell>

      <CardShell title={`${t('emergency.contacts')} · ${inc.flag} ${tx(inc.name)}`} icon="info">
        {inc.numbers.length ? <ul className="space-y-2">{inc.numbers.map((n, i) => <DialRow key={i} label={tx(n.label)} number={n.number} confirm />)}</ul> : <Notice tone="warn">{tx(L('No reviewed numbers for this location yet.', '此地暂无已核验的电话。'))}</Notice>}
        <p className="mt-2 text-xs text-muted">{city ? tx(L(`Based on your location (${city.name.en}).`, `根据您的位置（${city.name.zh}）。`)) : tx(L('Allow location on Home to show the numbers for where you are.', '在首页允许定位，即可显示您所在地的电话。'))}</p>
      </CardShell>

      <CardShell title={tx(L('Insurer 24-hour hotlines', '保险公司 24 小时热线'))} icon="shield">
        <ul className="space-y-2">{INSURERS.filter((i) => ['harbour', 'sunrise', 'pinnacle', 'banyan'].includes(i.id)).map((i) => <DialRow key={i.id} label={lang === 'zh' ? i.zh : i.name} number={i.hotline} />)}</ul>
        <p className="mt-2 text-xs text-muted">{tx(L('These dial the insurers\' published service hotlines. From outside mainland China, use the overseas number on your policy card.', '以上为保险公司公布的客服热线。在中国大陆境外请拨打保单卡上的境外服务电话。'))}</p>
      </CardShell>
    </div>
  );
}
