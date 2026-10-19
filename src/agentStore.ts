import { create } from 'zustand';
import i18n from 'i18next';
import type { Card, Chip, FileRef, PlanStep, TraceEvent, Txt, Verdict } from '@/engine/types';
import { httpClient, mockClient } from '@/engine';
import { useClaimStore } from '@/features/claims/claimStore';
import { SAMPLE_EVENTS } from '@/engine/inspect';
import { useExtractionStore } from '@/features/cards/extractionStore';
import { useUiStore } from '@/store';
import { useCaptureStore } from '@/features/capture/captureStore';
import { useMemoryStore } from '@/features/settings/memoryStore';
import { useLocationStore } from '@/features/location/locationStore';
import type { Locale } from '@/engine/l';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: Txt;
  attachments?: FileRef[];
  turnId?: string;
  cards: Card[];
  chips: Chip[];
  citations: string[];
  verdict?: Verdict;
  bullets?: Txt[];
  status: 'streaming' | 'done';
  plan: PlanStep[];
  progress?: { label: Txt; n: number; total: number };
  stoppedAt?: boolean;
}

export type ActionState = 'pending' | 'confirmed' | 'rejected';
export interface Toast { id: string; title: Txt; body: Txt }

interface AgentState {
  messages: ChatMessage[];
  events: TraceEvent[];
  running: boolean;
  actionStates: Record<string, ActionState>;
  toasts: Toast[];
  draft: string;
  pendingFiles: FileRef[];
  selectedMessageId: string | null;
  pinnedTurnId: string | null;
  seq: number;

  setDraft: (v: string) => void;
  addPendingFile: (f: FileRef) => void;
  clearPendingFiles: () => void;
  selectMessage: (id: string | null) => void;
  pinTurn: (id: string | null) => void;
  dismissToast: (id: string) => void;
  send: (text: string, files?: FileRef[]) => Promise<void>;
  runTurn: (turnId: string, hint?: string, userText?: Txt) => Promise<void>;
  resolve: (actionId: string, decision: 'confirm' | 'reject') => Promise<void>;
  advance: () => Promise<void>;
  waitIdle: () => Promise<void>;
  emitSample: () => void;
  clearEvents: () => void;
  reset: () => void;
}

const newAssistant = (id: string, turnId: string): ChatMessage => ({ id, role: 'assistant', turnId, cards: [], chips: [], citations: [], status: 'streaming', plan: [] });

function applyEvent(messages: ChatMessage[], e: TraceEvent): ChatMessage[] {
  const idx = messages.findIndex((m) => m.role === 'assistant' && m.turnId === e.turnId);
  if (e.type === 'turn.started') return idx >= 0 ? messages : [...messages, newAssistant(`a_${e.turnId}`, e.turnId)];
  if (idx < 0) return messages;
  const m = { ...messages[idx] };
  switch (e.type) {
    case 'plan.created': m.plan = e.steps; m.progress = undefined; break;
    case 'plan.replanned': m.plan = e.steps; break;
    case 'plan.step.started': {
      const n = m.plan.findIndex((s) => s.id === e.stepId);
      if (n >= 0) m.progress = { label: m.plan[n].label, n: n + 1, total: m.plan.length };
      break;
    }
    case 'ui.card': m.cards = [...m.cards, e.card]; break;
    case 'message.final': m.text = e.text; m.chips = e.chips ?? []; m.citations = e.citations ?? []; m.verdict = e.verdict; m.bullets = e.bullets; break;
    case 'turn.completed': m.status = 'done'; m.progress = undefined; break;
    default: return messages;
  }
  const next = [...messages];
  next[idx] = m;
  return next;
}

const initial = { messages: [] as ChatMessage[], events: [] as TraceEvent[], running: false, actionStates: {} as Record<string, ActionState>, toasts: [] as Toast[], draft: '', pendingFiles: [] as FileRef[], selectedMessageId: null as string | null, pinnedTurnId: null as string | null, seq: 0 };

export const useAgentStore = create<AgentState>((set, get) => {
  async function consume(stream: AsyncIterable<TraceEvent>) {
    set({ running: true });
    try {
      for await (const e of stream) {
        set((s) => ({
          events: [...s.events, e],
          messages: applyEvent(s.messages, e),
          actionStates: e.type === 'guard.confirm_required' ? { ...s.actionStates, [e.actionId]: 'pending' } : s.actionStates,
          toasts: e.type === 'notify.push' ? [...s.toasts, { id: `toast_${s.toasts.length}_${e.t}`, title: e.title, body: e.body }] : s.toasts,
          selectedMessageId: e.type === 'message.final' ? `a_${e.turnId}` : s.selectedMessageId,
        }));
      }
    } finally {
      set({ running: false });
    }
  }
  const userMsg = (text: Txt | undefined, files?: FileRef[]): ChatMessage => ({ id: `u_${get().seq + 1}`, role: 'user', text, attachments: files, cards: [], chips: [], citations: [], status: 'done', plan: [] });

  return {
    ...initial,
    setDraft: (draft) => set({ draft }),
    addPendingFile: (f) => set((s) => ({ pendingFiles: [...s.pendingFiles, f] })),
    clearPendingFiles: () => set({ pendingFiles: [] }),
    selectMessage: (selectedMessageId) => set({ selectedMessageId }),
    pinTurn: (pinnedTurnId) => set({ pinnedTurnId }),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    send: async (text, files) => {
      const f = files ?? get().pendingFiles;
      const ui = useUiStore.getState();
      if (ui.attack) { useUiStore.setState({ attack: false }); ui.setInspectorTab('safety'); } // Attack toggle: swap this turn for the adversarial variant, show Safety
      set((s) => ({ seq: s.seq + 1, draft: '', pendingFiles: [], messages: [...s.messages, userMsg(text, f)] }));
      const live = ui.source === 'live' && ui.backend === 'online' && !ui.attack && f.every((x) => !x.fixtureId);
      await consume(live ? httpClient.sendMessage({ sessionId: 'sess_backend', text, attachments: f }) : mockClient.sendMessage({ sessionId: 'sess_mock_001', text, attachments: f }));
    },
    runTurn: async (turnId, hint, userText) => {
      if (userText) set((s) => ({ seq: s.seq + 1, messages: [...s.messages, userMsg(userText)] }));
      await consume(mockClient.runTurn(turnId, hint));
    },
    resolve: async (actionId, decision) => {
      set((s) => ({ actionStates: { ...s.actionStates, [actionId]: decision === 'confirm' ? 'confirmed' : 'rejected' } }));
      if (actionId === 'act_claim_submit' && decision === 'confirm') useClaimStore.getState().markSubmitted();
      if (actionId === 'act_followup_send' && decision === 'confirm') useClaimStore.getState().replySent();
      await consume(httpClient.owns(actionId) ? httpClient.resolveAction({ actionId, decision }) : mockClient.resolveAction({ actionId, decision }));
    },
    advance: async () => {
      useClaimStore.getState().advanceDays(3);
      await consume(mockClient.advanceSim());
    },
    waitIdle: async () => {
      while (get().running) await new Promise((r) => setTimeout(r, 30));
    },
    emitSample: () => {
      SAMPLE_EVENTS.forEach((e, i) => setTimeout(() => set((s) => ({ events: [...s.events.filter((x) => i > 0 || x.turnId !== 'turn_demo'), e] })), i * 220));
    },
    clearEvents: () => set({ events: [] }),
    reset: () => {
      mockClient.reset();
      void httpClient.startSession().catch(() => undefined); // fresh private workspace for a clean replay
      useClaimStore.getState().reset();
      useExtractionStore.getState().reset();
      useCaptureStore.getState().reset();
      useMemoryStore.getState().reset();
      useLocationStore.getState().reset();
      set({ ...initial });
    },
  };
});

export const setClientLocale = (l: Locale) => { mockClient.setLocale(l); httpClient.setLocale(l); };
setClientLocale(i18n.language === 'zh' ? 'zh' : 'en');
i18n.on('languageChanged', (lng) => setClientLocale(lng === 'zh' ? 'zh' : 'en'));
