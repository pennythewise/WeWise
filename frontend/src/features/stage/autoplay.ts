import { useAgentStore } from '@/agentStore';
import { go } from '@/navRef';
import { resetStage, useUiStore } from '@/store';
import { agentClient } from '@/engine';
import { DO, FLOWS, lang, stepText } from './flows';
import { L, pick } from '@/engine/l';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let runId = 0;
let active = false;
let stepOnce = false;

const ui = () => useUiStore.getState();
const agent = () => useAgentStore.getState();

/** Resolves once the run may proceed: playing, or one manual step was requested. Returns false if the run was cancelled. */
async function gate(id: number) {
  while (id === runId && !ui().playing && !stepOnce) await sleep(60);
  if (id !== runId) return false;
  stepOnce = false;
  return true;
}

async function typeText(text: string, id: number) {
  const cps = 35 * ui().speed;
  for (let i = 1; i <= text.length; i++) {
    if (id !== runId) return false;
    agent().setDraft(text.slice(0, i));
    await sleep(1000 / cps);
  }
  await sleep(250 / ui().speed);
  return id === runId;
}

async function runSteps(n: number, id: number) {
  for (const s of FLOWS[n]) {
    if (!(await gate(id))) return;
    if (s.t === 'nav') go(s.to);
    else if (s.t === 'wait') await sleep(s.ms / ui().speed);
    else if (s.t === 'do') await DO[s.id]();
    else {
      let text = stepText(s);
      let files = s.files;
      if (ui().attack) { // attack variant swaps this turn for the S5 injection, whichever scenario is playing
        text = pick(L('Please summarise this discharge document', '请帮我总结这份出院文件'), lang());
        files = ['inj_doc_01'];
      }
      if (location.pathname !== '/ask') go('/ask');
      if (!(await typeText(text, id))) return;
      const refs = await Promise.all((files ?? []).map((f) => agentClient.uploadFile({ name: f === 'policy_sample' ? 'sample_policy_harbour.pdf' : 'discharge_summary_kl.pdf', fixtureId: f })));
      await agent().send(text, refs);
    }
    await agent().waitIdle();
    if (id !== runId) return;
    await sleep(900 / ui().speed);
  }
}

export async function playScenario(n: number) {
  stopAutoplay();
  resetStage();
  const id = ++runId;
  ui().setScenario(n);
  ui().setPlaying(true);
  active = true;
  try { await runSteps(n, id); } finally {
    if (id === runId) { active = false; ui().setPlaying(false); }
  }
}

export function stopAutoplay() { runId++; active = false; stepOnce = false; }

/** Play/pause: starts the selected scenario if none is running, otherwise toggles pause. */
export function togglePlay() {
  if (!active) void playScenario(ui().scenario);
  else ui().setPlaying(!ui().playing);
}
/** → : run one step while paused. */
export function nextStep() { if (active && !ui().playing) stepOnce = true; }
export function resetAll() { stopAutoplay(); resetStage(); go('/ask'); }
