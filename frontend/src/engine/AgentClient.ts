import type { Claim, ClaimSummary, FileRef, Locale, MockFile, Portfolio, TraceEvent } from './types';

/** Agent surface the UI talks to (PRD §4). Implemented by the scripted MockAgentClient. */
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
