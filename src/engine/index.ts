import type { AgentClient } from './AgentClient';
import { HttpAgentClient } from './HttpAgentClient';
import { MockAgentClient } from './MockAgentClient';

/** Scripted scenarios always use the mock; free-text chat uses the live backend when it is reachable. */
export const mockClient = new MockAgentClient();
export const agentClient: AgentClient = mockClient;
/** Live client for the FastAPI backend; the UI falls back to the scripted mock whenever the backend is offline. */
export const httpClient = new HttpAgentClient();
