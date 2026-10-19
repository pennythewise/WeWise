import { create } from 'zustand';
import { httpClient, mockClient } from '@/engine';
import { queryFlags } from '@/lib';
import { useAgentStore } from './agentStore';

export type InspectorTabId = 'pipeline' | 'tools' | 'safety' | 'evidence' | 'overview';
export type InspectorFilter = 'all' | 'tools' | 'safety';

interface UiState {
  navSheetOpen: boolean;
  inspectorOpen: boolean; // drawer (tablet) / sheet (phone); the showcase pane is always open
  setNavSheetOpen: (v: boolean) => void;
  setInspectorOpen: (v: boolean) => void;

  inspectorTab: InspectorTabId;
  inspectorFilter: InspectorFilter;
  setInspectorTab: (t: InspectorTabId) => void;
  setInspectorFilter: (f: InspectorFilter) => void;

  record: boolean;
  scenario: number;
  playing: boolean;
  attack: boolean;
  speed: number;
  setScenario: (n: number) => void;
  setPlaying: (v: boolean) => void;
  setAttack: (v: boolean) => void;
  setSpeed: (n: number) => void;

  /** 'live' sends typed chat to the FastAPI backend; 'scripted' keeps everything on the preset mock. */
  source: 'live' | 'scripted';
  backend: 'checking' | 'online' | 'offline';
  setSource: (s: 'live' | 'scripted') => void;
}

export const useUiStore = create<UiState>((set) => ({
  navSheetOpen: false,
  inspectorOpen: false,
  setNavSheetOpen: (navSheetOpen) => set({ navSheetOpen }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),

  inspectorTab: 'pipeline',
  inspectorFilter: 'all',
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setInspectorFilter: (inspectorFilter) => set({ inspectorFilter }),

  record: queryFlags.record(),
  scenario: queryFlags.scenario() ?? 1,
  playing: false,
  attack: false,
  speed: 1,
  setScenario: (scenario) => set({ scenario }),
  setPlaying: (playing) => set({ playing }),
  setAttack: (attack) => { mockClient.setAttack(attack); set({ attack }); },
  setSpeed: (speed) => { mockClient.setSpeed(speed); set({ speed }); },

  source: 'live',
  backend: 'checking',
  setSource: (source) => set({ source }),
}));

/** Checks the API once at start-up and again on demand; scripted mode is used automatically while it is offline. */
export async function probeBackend() {
  useUiStore.setState({ backend: 'checking' });
  const online = await httpClient.available();
  useUiStore.setState({ backend: online ? 'online' : 'offline' });
}

/** Reset the whole stage: conversation, claim, inspector, flags. */
export function resetStage() {
  useAgentStore.getState().reset();
  useUiStore.setState({ playing: false, attack: false, inspectorTab: 'pipeline', inspectorFilter: 'all' });
}
