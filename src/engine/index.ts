import type { AgentClient } from './AgentClient';
import { MockAgentClient } from './MockAgentClient';

/** The simulator runs entirely on the scripted mock client; there is no backend. */
export const mockClient = new MockAgentClient();
export const agentClient: AgentClient = mockClient;
