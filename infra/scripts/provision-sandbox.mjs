// Provision the named Vercel Sandbox that serves /api for a preview deployment.
//
//   VERCEL_OIDC_TOKEN=... node infra/scripts/provision-sandbox.mjs [--chain-env .env] [--revision main]
//
// Installs the backend (lite mode: no memory sidecar or local embeddings, lexical retrieval), and, when
// --chain-env is given, copies only its CHAIN_* lines to /vercel/wewise-data/chain.env (mode 0600) on the VM.
// Values are never printed. The gateway (infra/server/sandbox-gateway.mjs) resumes this sandbox on demand.
import { readFileSync } from 'node:fs';
import { Sandbox } from '@vercel/sandbox';

const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const NAME = 'wewise-preview';
const REPO = 'https://github.com/pennythewise/WeWise.git';
const revision = arg('--revision', 'main');
const chainEnvPath = arg('--chain-env');

async function run(sandbox, label, script, { sudo = false } = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  const result = await sandbox.runCommand({ cmd: 'bash', args: ['-lc', script], sudo, stdout: process.stdout, stderr: process.stderr });
  if (result.exitCode !== 0) throw new Error(`${label} failed with exit code ${result.exitCode}`);
}

let sandbox;
try {
  sandbox = await Sandbox.get({ name: NAME, resume: true });
  console.log(`Reusing sandbox ${NAME}`);
} catch {
  sandbox = await Sandbox.create({ name: NAME, ports: [8017], persistent: true, resources: { vcpus: 2 }, timeout: 45 * 60 * 1000 });
  console.log(`Created sandbox ${NAME}`);
}

const who = await sandbox.runCommand({ cmd: 'id', args: ['-un'] });
const user = (await who.stdout()).trim();
if (!/^[a-z_][a-z0-9_-]*$/.test(user)) throw new Error(`Unexpected sandbox user: ${user}`);
await run(sandbox, `Directories (owned by ${user}) and system libraries`,
  `mkdir -p /vercel/WeWise /vercel/wewise-data && chown -R ${user} /vercel/WeWise /vercel/wewise-data; `
  + '(command -v dnf >/dev/null && dnf install -y -q git mesa-libGL glib2 >/dev/null) || (command -v apt-get >/dev/null && apt-get update -qq && apt-get install -y -qq git libgl1 libglib2.0-0 >/dev/null) || true',
  { sudo: true });
await run(sandbox, `Checkout ${revision}`,
  `git config --global --add safe.directory /vercel/WeWise; cd /vercel/WeWise && if [ -d .git ]; then git fetch -q --depth 1 origin ${revision} && git checkout -q -f FETCH_HEAD; else git clone -q --depth 1 --branch ${revision} ${REPO} . ; fi && git log --oneline -1`);
await run(sandbox, 'Python 3.11 environment and dependencies',
  'export PATH="$HOME/.local/bin:$PATH"; command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null; '
  + 'cd /vercel/WeWise && uv python install -q 3.11 && ([ -x .venv/bin/python ] || uv venv -q --python 3.11 .venv) && '
  + 'uv pip install -q --python .venv/bin/python -r backend/requirements.lock.txt -r backend/requirements-chain.txt && .venv/bin/python -V');

const files = [{ path: '/vercel/wewise-data/allow-lite', content: 'lite preview: lexical retrieval, no memory sidecar\n' }];
if (chainEnvPath) {
  const lines = readFileSync(chainEnvPath, 'utf8').split('\n').filter((l) => /^CHAIN_[A-Z_]+=/.test(l.trim()));
  files.push({ path: '/vercel/wewise-data/chain.env', content: lines.join('\n') + '\n', mode: 0o600 });
  console.log(`\n▶ Writing ${lines.length} CHAIN_* settings to chain.env (values not shown)`);
}
await sandbox.writeFiles(files);
await run(sandbox, 'Lock down chain.env', 'chmod 600 /vercel/wewise-data/chain.env 2>/dev/null; ls -l /vercel/wewise-data | sed -n 1,20p');

await run(sandbox, 'Restart backend', 'cd /vercel/WeWise && (pkill -f "uvicorn backend.app.main:app" || true); sleep 1; PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://wewise-demo.vercel.app}" .venv/bin/python infra/deploy/ensure_backend.py');
await run(sandbox, 'Health', 'curl -s http://127.0.0.1:8017/api/chain/status | head -c 400; echo');
console.log(`\nBackend URL: ${sandbox.domain(8017)}`);
