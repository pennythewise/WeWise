import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, Notice } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import { useClaimStore } from '../claims/claimStore';
import { queryFlags } from '@/lib';
import { MockCamera, mockShot } from './MockCamera';
import { READY_AFTER_MS, STEPS } from './captureSteps';
import { useCaptureStore } from './captureStore';

/** C8 AR-assisted evidence capture (frontend mock): guided shots over the device camera, or AI-generated stand-in photos when there is no camera or ?mockcam=1. */
export function CaptureEvidence() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const { shots, add, retake, attach, attached } = useCaptureStore();
  const okIds = shots.filter((s) => s.ok).map((s) => s.stepId);
  const stepIdx = Math.max(0, STEPS.findIndex((s) => !okIds.includes(s.id)));
  const done = okIds.length === STEPS.length;
  const step = STEPS[done ? STEPS.length - 1 : stepIdx];

  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  // "AR assist": the guide settles after a moment; shooting before that gives a blurry, rejected shot.
  useEffect(() => {
    setReady(false); setMsg(null);
    const id = setTimeout(() => setReady(true), READY_AFTER_MS);
    return () => clearTimeout(id);
  }, [step.id]);
  useEffect(() => { if (video.current && cam) video.current.srcObject = cam; }, [cam]);
  const fileInput = useRef<HTMLInputElement>(null);
  // Open the device camera as soon as the screen opens (unless ?mockcam=1); the stand-in photos are the fallback when it is denied or missing.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; if (!queryFlags.mockCam()) void useCamera(); return () => { alive.current = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cam?.getTracks().forEach((tr) => tr.stop()), [cam]);

  const shutter = () => {
    setFlash(true); setTimeout(() => setFlash(false), 140);
    const time = '14:3' + (2 + okIds.length);
    if (!ready) { add({ stepId: step.id, ok: false, time, reason: 'early', src: cam ? frame() : mockShot(step.id) }); setMsg(t('capture.blurry')); return; }
    add({ stepId: step.id, ok: true, time, src: cam ? frame() : mockShot(step.id) }); setMsg(null);
  };
  /** Snapshot of the live camera view, kept small for the thumbnail. */
  const frame = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return undefined;
    const c = document.createElement('canvas');
    c.width = 320; c.height = Math.round((320 * v.videoHeight) / v.videoWidth);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  };
  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    add({ stepId: step.id, ok: true, time: '14:3' + (2 + okIds.length), src: URL.createObjectURL(file) }); setMsg(null);
  };
  const useCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (alive.current) setCam(stream); else stream.getTracks().forEach((tr) => tr.stop()); // screen closed while the permission prompt was open
    } catch { /* no camera or permission denied: the stand-in photos are used */ }
  };
  const attachAll = () => { attach(); useClaimStore.getState().addEvidence(okIds.length); };

  return (
    <div className="space-y-4" data-screen="capture">
      <Notice tone="info">{t(cam ? 'capture.demoCamera' : 'capture.demo')}</Notice>

      <div className="flex items-center justify-between gap-2">
        <Badge tone={ready ? 'ok' : 'warn'} icon={ready ? 'check' : 'clock'}>{ready ? tx(step.ready) : t('capture.holdSteady')}</Badge>
        <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">{Math.min(okIds.length + 1, STEPS.length)} / {STEPS.length}</span>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-cardline bg-ink" data-testid="ar-viewport">
        {cam ? <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" /> : <MockCamera stepId={step.id} ready={ready} />}
        {/* AR overlay */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {['left-4 top-4 border-l-4 border-t-4', 'right-4 top-4 border-r-4 border-t-4', 'bottom-4 left-4 border-b-4 border-l-4', 'bottom-4 right-4 border-b-4 border-r-4'].map((c) => (
            <span key={c} className={`absolute h-10 w-10 rounded-sm ${c} ${ready ? 'border-[#4ADE80]' : 'border-white'} transition-colors`} />
          ))}
          {!ready && <span className="absolute inset-x-6 top-0 h-0.5 animate-scan bg-[#8CA3EF] shadow-[0_0_12px_#8CA3EF]" />}
          <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80" />
        </div>
        <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-full bg-black/55 px-4 py-2 text-center text-[13px] leading-snug text-white backdrop-blur" aria-hidden="true">{done ? t('capture.allDone') : tx(step.guide)}</p>
        {flash && <div className="absolute inset-0 bg-white" />}
      </div>

      <p className="rounded-input border border-secline bg-bluewash px-3 py-2 text-[13px] leading-snug text-ink" aria-live="polite"><strong>{done ? t('capture.allDone') : tx(step.title)}</strong>{!done && <span className="sr-only"> · {tx(step.guide)}</span>}</p>

      {msg && <Notice tone="warn">{msg}</Notice>}

      {!done ? (
        <div className="flex items-center justify-between rounded-card bg-ink px-6 py-4">
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={upload} aria-label={t('capture.upload')} />
          <button type="button" onClick={() => fileInput.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white" aria-label={t('capture.upload')}><AppIcon name="file" size={22} /></button>
          <button type="button" onClick={shutter} aria-label={t('capture.shoot')} className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white p-1 active:scale-95 transition-transform"><span className={`block h-full w-full rounded-full ${ready ? 'bg-white' : 'bg-white/60'}`} /></button>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-[13px] font-semibold tabular-nums text-white">{Math.min(okIds.length + 1, STEPS.length)}/{STEPS.length}</span>
        </div>
      ) : null}

      <CardShell title={t('capture.shots')} icon="file" right={<span className="text-[13px] font-semibold text-brand">{okIds.length} / {STEPS.length}</span>}>
        <ul className="grid grid-cols-2 gap-2.5">
          {STEPS.map((s) => {
            const shot = shots.find((x) => x.stepId === s.id);
            return (
              <li key={s.id} className="overflow-hidden rounded-input border border-cardline bg-white" data-shot={s.id} data-ok={shot?.ok ? '1' : shot ? '0' : ''}>
                <div className="relative h-20 overflow-hidden bg-wash">{shot ? <img src={shot.src ?? mockShot(s.id)} alt="" className={`h-full w-full object-cover ${shot.ok ? '' : 'blur-[3px]'}`} /> : <span className="absolute inset-0 flex items-center justify-center text-muted"><AppIcon name="scan" size={22} /></span>}
                  {shot && !shot.ok && <span className="absolute inset-0 bg-white/60 backdrop-blur-sm" />}</div>
                <div className="space-y-1 px-2.5 py-2">
                  <p className="text-xs font-semibold text-ink">{tx(s.title)}</p>
                  {shot ? (
                    <>
                      <Badge tone={shot.ok ? 'ok' : 'danger'} icon={shot.ok ? 'check' : 'close'}>{shot.ok ? t('capture.sharp') : t('capture.blurryShort')}</Badge>
                      <p className="text-[11px] text-muted">{shot.ok ? `${shot.time} · ${t('capture.meta')}` : t('capture.retake')}</p>
                      {(shot.ok || true) && <button type="button" className="min-h-[32px] text-xs font-semibold text-primary" onClick={() => retake(s.id)}>{t('capture.retakeBtn')}</button>}
                    </>
                  ) : <p className="text-xs text-muted">{t('capture.pending')}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </CardShell>

      {done && (
        <CardShell title={t('capture.packTitle')} icon="shield" tone={attached ? undefined : undefined}>
          <ul className="space-y-1 text-[13px] text-body">{['hash', 'time', 'place', 'plate'].map((k) => <li key={k} className="flex gap-2"><AppIcon name="check" size={14} className="mt-1 shrink-0 text-ok" />{t(`capture.pack.${k}`)}</li>)}</ul>
          {attached ? (
            <div className="mt-3 space-y-2"><Badge tone="ok">{t('capture.attached')}</Badge><Link to="/claims/clm_mei_001" className="btn-secondary w-full">{t('capture.openClaim')}</Link></div>
          ) : <button type="button" className="btn-primary mt-3 w-full" onClick={attachAll}>{t('capture.attach')}</button>}
        </CardShell>
      )}
    </div>
  );
}
