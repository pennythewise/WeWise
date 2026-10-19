import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../server/sandbox-gateway.mjs';

const ORIGIN = 'https://wewise-retrieval-preview.vercel.app';
const BACKEND = 'https://sb-preview.vercel.run';

function fixture(overrides = {}) {
  const calls = { sandbox: [], command: [], fetch: [] };
  const sandbox = {
    runCommand: async (options) => { calls.command.push(options); return { exitCode: 0 }; },
    domain: (port) => { assert.equal(port, 8017); return BACKEND; },
  };
  const handler = createGateway({
    environment: { PUBLIC_ORIGIN: ORIGIN },
    getSandbox: async (options) => { calls.sandbox.push(options); return sandbox; },
    fetchImpl: async (url, options) => { calls.fetch.push({ url, options }); return Response.json({ status: 'ok' }); },
    ...overrides,
  });
  return { handler, calls, sandbox };
}

test('retrieves only the provisioned sandbox and invokes the fixed backend helper', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request(`${ORIGIN}/api/health`));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.sandbox, [{ name: 'wewise-preview', resume: true }]);
  assert.equal(calls.command[0].cmd, '/vercel/WeWise/.venv/bin/python');
  assert.deepEqual(calls.command[0].args, ['deploy/ensure_backend.py']);
  assert.equal(calls.fetch[0].url.href, `${BACKEND}/api/health`);
});

test('preserves JSON bytes, session cookie and query while excluding platform credentials', async () => {
  const { handler, calls } = fixture();
  const raw = '{ "text" : "保单", "amount" : 1.00 }';
  const response = await handler(new Request(`${ORIGIN}/api/chat?q=word%20two`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: 'wewise_session=opaque', 'x-vercel-oidc-token': 'must-not-forward', authorization: 'must-not-forward' }, body: raw,
  }));
  assert.equal(response.status, 200);
  assert.equal(calls.fetch[0].options.body.toString(), raw);
  assert.equal(calls.fetch[0].options.headers.get('cookie'), 'wewise_session=opaque');
  assert.equal(calls.fetch[0].options.headers.get('x-vercel-oidc-token'), null);
  assert.equal(calls.fetch[0].options.headers.get('authorization'), null);
  assert.equal(calls.fetch[0].options.headers.get('host'), null);
  assert.equal(calls.fetch[0].url.search, '?q=word%20two');
});

test('preserves binary multipart bytes and content type', async () => {
  const { handler, calls } = fixture();
  const raw = Buffer.from([13, 10, 0, 255, 128, 1]);
  await handler(new Request(`${ORIGIN}/api/documents`, { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=wewise' }, body: raw }));
  assert.deepEqual(calls.fetch[0].options.body, raw);
  assert.equal(calls.fetch[0].options.headers.get('content-type'), 'multipart/form-data; boundary=wewise');
});

test('blocks cross-origin writes before any sandbox access', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request(`${ORIGIN}/api/auth/demo`, { method: 'POST', headers: { origin: 'https://other.vercel.app' } }));
  assert.equal(response.status, 403);
  assert.equal(calls.sandbox.length, 0);
});

test('blocks cross-site write metadata even without Origin', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request(`${ORIGIN}/api/auth/demo`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }));
  assert.equal(response.status, 403);
  assert.equal(calls.sandbox.length, 0);
});

test('rejects arbitrary hosts and direct gateway routes', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(new Request('https://evil.vercel.app/api/health'))).status, 403);
  assert.equal((await handler(new Request(`${ORIGIN}/api/gateway`))).status, 404);
  assert.equal(calls.sandbox.length, 0);
});

test('rejects oversized streamed multipart bodies before waking the sandbox', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request(`${ORIGIN}/api/documents`, { method: 'POST', body: Buffer.alloc(4 * 1024 * 1024 + 1) }));
  assert.equal(response.status, 413);
  assert.equal(calls.sandbox.length, 0);
});

test('preserves status, multiple cookies and download stream', async () => {
  const fixtureResponse = new Response(Buffer.from('%PDF-test'), { status: 201, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="claim.pdf"', 'access-control-allow-origin': '*' } });
  fixtureResponse.headers.append('set-cookie', 'first=a; HttpOnly; Secure; SameSite=Strict; Path=/');
  fixtureResponse.headers.append('set-cookie', 'second=b; HttpOnly; Secure; SameSite=Strict; Path=/');
  const { handler } = fixture({ fetchImpl: async () => fixtureResponse });
  const response = await handler(new Request(`${ORIGIN}/api/claims/example/export`));
  assert.equal(response.status, 201);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="claim.pdf"');
  assert.equal(await response.text(), '%PDF-test');
});

test('reports unavailable provisioned backend without leaking SDK errors or creating one', async () => {
  const { handler } = fixture({ getSandbox: async () => { throw new Error('private SDK credential detail'); } });
  const response = await handler(new Request(`${ORIGIN}/api/health`));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /credential|private SDK/);
});

test('re-resolves sandbox on subsequent requests so stopped sessions can resume', async () => {
  const { handler, calls } = fixture();
  await handler(new Request(`${ORIGIN}/api/health`));
  await handler(new Request(`${ORIGIN}/api/policies`));
  assert.equal(calls.sandbox.length, 2);
});

test('supports rewritten function URLs and strips the internal routing parameter', async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request(`${ORIGIN}/api/gateway?__wewise_path=claims/case_123/export&lang=zh`));
  assert.equal(response.status, 200);
  assert.equal(calls.fetch[0].url.href, `${BACKEND}/api/claims/case_123/export?lang=zh`);
});

test('rejects ambiguous routing parameters and traversal values before sandbox access', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(new Request(`${ORIGIN}/api/gateway?__wewise_path=health&__wewise_path=auth/login`))).status, 400);
  assert.equal((await handler(new Request(`${ORIGIN}/api/gateway?__wewise_path=..%2Fsecret`))).status, 400);
  assert.equal(calls.sandbox.length, 0);
});
