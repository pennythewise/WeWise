import type { AgentClient } from './AgentClient';
import { MockAgentClient } from './MockAgentClient';

// VITE_AGENT_BACKEND=http will select HttpAgentClient once the backend exists; today everything is the mock.
export const mockClient = new MockAgentClient();
export const agentClient: AgentClient = mockClient;
