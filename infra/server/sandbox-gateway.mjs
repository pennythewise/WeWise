const SANDBOX_NAME = 'wewise-preview';
const BACKEND_PORT = 8017;
const MAX_BODY = 4 * 1024 * 1024;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function failure(status, detail) {
  return Response.json({ detail }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

function allowedHost(host, environment) {
  const configured = ['wewise-retrieval-preview.vercel.app', environment.VERCEL_URL, environment.VERCEL_PROJECT_PRODUCTION_URL];
  if (environment.PUBLIC_ORIGIN) {
    try { configured.push(new URL(environment.PUBLIC_ORIGIN).host); } catch { return false; }
  }
  return configured.some((value) => value && value.toLowerCase() === host.toLowerCase());
}

async function readBody(request) {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) throw new RangeError('body_limit');
  if (!request.body) return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > MAX_BODY) throw new RangeError('body_limit');
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks, size) : undefined;
}

export function createGateway({ getSandbox, fetchImpl = fetch, environment = process.env }) {
  // Coalesce simultaneous wake-ups in one Function instance. The Python helper
  // also locks across Function instances, so there is only one SQLite writer service.
  let readiness;
  async function backend() {
    if (!readiness) readiness = (async () => {
      const sandbox = await getSandbox({ name: SANDBOX_NAME, resume: true });
      const start = await sandbox.runCommand({
        cmd: '/vercel/WeWise/.venv/bin/python',
        args: ['infra/deploy/ensure_backend.py'],
        cwd: '/vercel/WeWise',
        timeoutMs: 45_000,
        env: { PUBLIC_ORIGIN: environment.PUBLIC_ORIGIN || 'https://wewise-retrieval-preview.vercel.app' },
      });
      if (start.exitCode !== 0) throw new Error('backend_setup_required');
      const domain = new URL(sandbox.domain(BACKEND_PORT));
      if (domain.protocol !== 'https:' || !domain.hostname.endsWith('.vercel.run')) throw new Error('unexpected_backend_domain');
      return domain.origin;
    })().finally(() => { readiness = undefined; });
    return readiness;
  }

  return async function gateway(request) {
    const incoming = new URL(request.url);
    if (incoming.protocol !== 'https:' || !allowedHost(incoming.host, environment)) return failure(403, 'Unsupported preview host.');
    const routeValues = incoming.searchParams.getAll('__wewise_path');
    if (routeValues.length > 1) return failure(400, 'Ambiguous API route.');
    const rewritten = routeValues[0];
    if (rewritten !== undefined) {
      incoming.searchParams.delete('__wewise_path');
      if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(rewritten) || rewritten.split('/').some((part) => !part)) return failure(400, 'Invalid API route.');
      incoming.pathname = `/api/${rewritten}`;
    }
    if (!incoming.pathname.startsWith('/api/') || incoming.pathname === '/api/gateway') return failure(404, 'API route not found.');
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(request.method)) return failure(405, 'Unsupported request method.');
    const origin = request.headers.get('origin');
    if (WRITE_METHODS.has(request.method) && ((origin && origin !== incoming.origin) || request.headers.get('sec-fetch-site') === 'cross-site')) {
      return failure(403, 'Cross-origin writes are blocked.');
    }
    let body;
    try { body = await readBody(request); }
    catch (error) { return failure(error instanceof RangeError ? 413 : 400, error instanceof RangeError ? 'Team preview uploads must be smaller than 4 MB including form data.' : 'Unable to read request body.'); }

    try {
      const base = await backend();
      const target = new URL(base);
      target.pathname = incoming.pathname;
      target.search = incoming.search;
      const headers = new Headers();
      // Pass only the app's required request metadata. In particular, do not
      // leak deployment OIDC, Vercel protection, or arbitrary proxy headers.
      for (const name of ['accept', 'accept-language', 'content-type', 'cookie', 'sec-fetch-site', 'if-none-match', 'range']) {
        const value = request.headers.get(name);
        if (value !== null) headers.set(name, value);
      }
      // Host remains the fixed Sandbox hostname for its edge router. Origin was
      // already checked above and is normalized to the app's configured origin.
      if (origin) headers.set('origin', environment.PUBLIC_ORIGIN || 'https://wewise-retrieval-preview.vercel.app');
      headers.set('x-forwarded-proto', 'https');
      headers.set('x-forwarded-host', incoming.host);
      const upstream = await fetchImpl(target, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(100_000) });
      const responseHeaders = new Headers();
      for (const [name, value] of upstream.headers) {
        if (!HOP_HEADERS.has(name) && !['set-cookie', 'content-encoding', 'content-length', 'access-control-allow-origin', 'access-control-allow-credentials'].includes(name)) responseHeaders.set(name, value);
      }
      for (const value of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', value);
      responseHeaders.set('cache-control', 'no-store');
      responseHeaders.set('x-content-type-options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
    } catch {
      // On a later request, re-resolve the named sandbox and restart its Python
      // service after a stop/snapshot/resume. Never create an empty replacement.
      readiness = undefined;
      return failure(503, 'The team preview is waking up. Please retry in a few seconds.');
    }
  };
}
