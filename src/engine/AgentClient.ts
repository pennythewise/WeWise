import type { Claim, ClaimSummary, FileRef, Locale, MockFile, Portfolio, TraceEvent } from './types';

/** Same surface the real backend client will implement (PRD §4). Switch via VITE_AGENT_BACKEND=mock|http. */
export interface AgentClient {
  startSession(opts: { userId: string; locale: Locale; country: string }): Promise<{ sessionId: string }>;
  sendMessage(input: { sessionId: string; text: string; attachments?: FileRef[] }): AsyncIterable<TraceEvent>;
  resolveAction(input: { actionId: string; decision: 'confirm' | 'reject' }): AsyncIterable<TraceEvent>;
  uploadFile(file: File | MockFile): Promise<FileRef>;
  getPortfolio(): Promise<Portfolio>;
  listClaims(): Promise<ClaimSummary[]>;
  getClaim(id: string): Promise<Claim>;
  advanceSim?(days: number): AsyncIterable<TraceEvent>;
}
