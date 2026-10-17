import { Sandbox } from '@vercel/sandbox';
import { createGateway } from '../server/sandbox-gateway.mjs';

// Credentials come from this deployment's Vercel OIDC context, never the browser.
export default { fetch: createGateway({ getSandbox: (options) => Sandbox.get(options) }) };
