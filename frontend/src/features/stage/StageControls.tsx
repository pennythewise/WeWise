import { toPng } from 'html-to-image';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@/agentStore';
import { probeBackend, useUiStore } from '@/store';
import { AttackToggle } from './AttackToggle';
import { ScenarioPicker } from './ScenarioPicker';
import { nextStep, resetAll, togglePlay } from './autoplay';

const btn = 'min-h-[36px] rounded-control border border-line bg-white px-3 text-[13px] font-medium text-ink disabled:opacity-50';

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href; a.download = name; a.click();
}

/** Stage controls (PRD §2.4 rule 4, §12): scenario picker, play/pause/step, reset, speed, Attack, advance, exports. Hidden by ?record=1. */
export function StageControls({ className = '', hidePicker = false }: { className?: string; hidePicker?: boolean }) {
  const { t } = useTranslation();
  const { playing, speed, setSpeed, source, setSource, backend } = useUiStore();
  const live = source === 'live' && backend === 'online';
  const status = backend === 'online' ? t('stage.backendOnline') : backend === 'offline' ? t('stage.backendOffline') : t('stage.backendChecking');
  const { running, events } = useAgentStore();
  const exportJson = () => download(URL.createObjectURL(new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })), 'wewise-trace.json');
  const snapshot = async () => { try { download(await toPng(document.body, { pixelRatio: 2, cacheBust: true }), 'wewise-snapshot.png'); } catch { /* snapshot is best-effort */ } };

  return (
    <div role="group" aria-label={t('stage.label')} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {!hidePicker && <ScenarioPicker />}
      <button type="button" className={btn} aria-pressed={playing} onClick={togglePlay}>{playing ? t('stage.pause') : t('stage.play')}</button>
      <button type="button" className={btn} onClick={nextStep} disabled={playing} title={t('stage.nextHint')}>{t('stage.next')}</button>
      <button type="button" className={btn} onClick={resetAll}>{t('stage.reset')}</button>
      <button type="button" className={btn} aria-pressed={live} title={status}
        onClick={() => { if (backend === 'offline') void probeBackend(); setSource(source === 'live' ? 'scripted' : 'live'); }}>
        <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${backend === 'online' ? 'bg-ok' : backend === 'offline' ? 'bg-danger' : 'bg-muted'}`} />
        {live ? t('stage.live') : t('stage.scripted')}
      </button>
      <AttackToggle />
      <label className="inline-flex items-center gap-1.5 text-xs text-muted">{t('stage.speed')}
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="min-h-[36px] rounded-control border border-line bg-white px-2 text-[13px] text-ink">
          {[1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
      <button type="button" className={btn} disabled={running} onClick={() => void useAgentStore.getState().advance()}>{t('stage.advance')}</button>
      <button type="button" className={btn} disabled={events.length === 0} onClick={exportJson}>JSON</button>
      <button type="button" className={btn} onClick={snapshot}>PNG</button>
    </div>
  );
}
