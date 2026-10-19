import { useEffect, useMemo, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useTranslation } from 'react-i18next';
import { AppIcon, type IconName } from '@/components/AppIcon';
import { buildTurns, trafficLight } from '@/engine/inspect';
import type { TrafficLight } from '@/engine/types';
import { useAgentStore } from '@/agentStore';
import { useUiStore, type InspectorFilter, type InspectorTabId } from '@/store';
import { useBreakpoint } from '@/layout/useBreakpoint';
import { useTx } from '@/i18n/useTx';
import { EventRow } from './EventRow';
import { EvidenceTab } from './EvidenceTab';
import { OverviewTab } from './OverviewTab';
import { PipelineTab } from './PipelineTab';
import { SafetyTab } from './SafetyTab';
import { ToolsTab } from './ToolsTab';

const TAB_IDS: InspectorTabId[] = ['pipeline', 'tools', 'safety', 'evidence', 'overview'];
const LIGHT: Record<TrafficLight, { icon: IconName; cls: string }> = {
  idle: { icon: 'clock', cls: 'bg-wash text-muted' },
  ok: { icon: 'check', cls: 'bg-[var(--wb-success-bg)] text-ok' },
  confirm: { icon: 'info', cls: 'bg-[var(--wb-warning-bg)] text-warn' },
  blocked: { icon: 'lock', cls: 'bg-[var(--wb-danger-bg)] text-danger' },
};

/** Shared by the column (showcase), drawer (tablet) and bottom sheet (phone). A pure view over the TraceEvent stream. */
export function InspectorContent() {
  const { t } = useTranslation();
  const { lang } = useTx();
  const mode = useBreakpoint();
  const { inspectorTab, setInspectorTab, inspectorFilter, setInspectorFilter, record } = useUiStore();
  const { events, actionStates, pinnedTurnId, pinTurn, clearEvents, emitSample, running } = useAgentStore();
  const turns = useMemo(() => buildTurns(events), [events]);
  const latest = turns[turns.length - 1];
  const turn = (pinnedTurnId && turns.find((x) => x.turnId === pinnedTurnId)) || latest;
  const pending = Object.entries(actionStates).filter(([, v]) => v === 'pending').map(([k]) => k);
  const status = trafficLight(turn, pending);
  const light = LIGHT[status];
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnList = turn ? [turn] : [];
  const allTurns = pinnedTurnId ? turnList : turns; // Tools / Safety show the whole session unless a turn is pinned

  // Newest-first reading: Tools/Safety follow the stream; Pipeline keeps its stepper in view.
  useEffect(() => { const el = scrollRef.current; if (el && !pinnedTurnId && (inspectorTab === 'tools' || inspectorTab === 'safety')) el.scrollTop = el.scrollHeight; }, [events.length, inspectorTab, pinnedTurnId]);

  const copy = async () => { try { await navigator.clipboard.writeText(JSON.stringify(events, null, 2)); } catch { /* clipboard unavailable */ } };
  const filtered = events.filter((e) => (pinnedTurnId ? e.turnId === pinnedTurnId : true)).filter((e) => (inspectorFilter === 'tools' ? e.type.startsWith('tool.') : inspectorFilter === 'safety' ? e.type.startsWith('guard.') : true));
  const iconBtn = 'btn-secondary btn-compact';

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" data-testid="inspector">
      <div className="shrink-0 space-y-2.5 border-b border-cardline bg-white px-4 py-3">
        <div className={`flex items-center gap-2 rounded-control px-3 py-2 text-[13px] font-semibold ${light.cls}`} role="status" aria-live="polite" data-light={status}>
          <AppIcon name={light.icon} size={18} /><span>{t(`inspector.status.${status}`)}</span>
        </div>
        <dl className="flex gap-6 text-xs text-muted">
            <div><dt>{t('inspector.turn')}</dt><dd className="font-mono text-[13px] text-ink">{turn ? turn.turnId : t('inspector.noTurn')}</dd></div>
            <div><dt>{t('inspector.elapsed')}</dt><dd className="whitespace-nowrap text-[13px] tabular-nums text-ink">{turn ? `${turn.elapsed} ms` : '—'}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={iconBtn} aria-pressed={!!pinnedTurnId} disabled={!turn} onClick={() => pinTurn(pinnedTurnId ? null : turn!.turnId)}>{pinnedTurnId ? t('inspector.unpin') : t('inspector.pin')}</button>
            <button type="button" className={iconBtn} disabled={events.length === 0} onClick={copy}>{t('inspector.copy')}</button>
            {mode === 'showcase' && !record && <button type="button" className={iconBtn} disabled={!turn?.userText || running} onClick={() => void useAgentStore.getState().send(turn!.userText)}>{t('inspector.replay')}</button>}
          </div>
      </div>

      <Tabs.Root value={inspectorTab} onValueChange={(v) => setInspectorTab(v as InspectorTabId)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="flex shrink-0 gap-1 overflow-x-auto border-b border-cardline bg-white px-2" aria-label={t('inspector.title')}>
          {TAB_IDS.map((id) => (
            <Tabs.Trigger key={id} value={id} className="min-h-touch whitespace-nowrap border-b-2 border-transparent px-3 text-[13px] font-medium text-muted data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary">
              {t(`inspector.tabs.${id}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3" aria-live="polite">
          <Tabs.Content value="pipeline" className="outline-none">
            <PipelineTab turn={turn} />
            {events.length > 0 && (
              <section className="mt-5 border-t border-cardline pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('inspector.log')}</h3>
                  <div role="radiogroup" aria-label={t('inspector.filter')} className="inline-flex rounded-control border border-line bg-white p-0.5">
                    {(['all', 'tools', 'safety'] as InspectorFilter[]).map((f) => <button key={f} role="radio" aria-checked={inspectorFilter === f} type="button" onClick={() => setInspectorFilter(f)} className={`min-h-[32px] rounded-[7px] px-2.5 text-xs font-medium ${inspectorFilter === f ? 'bg-primary text-white' : 'text-ink'}`}>{t(`inspector.filters.${f}`)}</button>)}
                  </div>
                </div>
                <ul className="space-y-1.5">{filtered.slice(-60).map((e, i) => <EventRow key={i} event={e} lang={lang} />)}</ul>
                {filtered.length === 0 && <p className="text-xs text-muted">{t('inspector.noMatch')}</p>}
              </section>
            )}
          </Tabs.Content>
          <Tabs.Content value="tools" className="outline-none"><ToolsTab turns={allTurns} /></Tabs.Content>
          <Tabs.Content value="safety" className="outline-none"><SafetyTab turns={allTurns} /></Tabs.Content>
          <Tabs.Content value="evidence" className="outline-none"><EvidenceTab /></Tabs.Content>
          <Tabs.Content value="overview" className="outline-none"><OverviewTab /></Tabs.Content>
        </div>
      </Tabs.Root>

      {!record && (
        <div className="flex shrink-0 items-center gap-2 border-t border-cardline bg-white px-3 py-2.5">
          <button type="button" className="btn-secondary btn-compact" onClick={emitSample}>{t('inspector.emit')}</button>
          <button type="button" className="btn-secondary btn-compact" onClick={clearEvents}>{t('inspector.clear')}</button>
          <span className="ml-auto text-xs text-muted">{t('inspector.dev')}</span>
        </div>
      )}
    </div>
  );
}
