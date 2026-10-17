# Private retrieval services in the teammate preview

The named Vercel Sandbox keeps its data under `/vercel/wewise-data`. Only port
8017 is published. Tencent MemoryCore binds to **127.0.0.1:8420** and is never
exposed as a public route. `ensure_backend.py` calls `ensure_memory.py` on resume;
neither helper installs packages, fetches source, nor downloads models on a user
request. The operator installs these assets before deploying the matching app.

## Pinned assets

- TencentCloud/TencentDB-Agent-Memory source commit
  `e9a82935b52741e0c798c75326e90b7144eb4d5f`, installed separately at
  `/vercel/wewise-runtime/tencent-agent-memory`. Install MemoryCore with
  `npm install --ignore-scripts --omit=dev --no-audit --no-fund` so upstream agent
  integration installers do not run. This pins upstream source; the upstream
  package manifest remains the dependency authority for the runtime installation.
- Local embedding model: `Xenova/multilingual-e5-small`, revision
  `761b726dd34fb83930e26aab4e9ac3899aa1fa78`.
- `onnx/model_quantized.onnx`, installed as `model_quantized.onnx`, SHA256
  `f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193`.
- `tokenizer.json`, SHA256
  `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`.
- Install both model files under
  `/vercel/wewise-data/models/multilingual-e5-small`. The semantic runtime checks
  their hashes before use. Queries and document text stay in this CPU process;
  a request never calls a remote embedding service.

## Memory boundary

The helper creates a random gateway credential on the VM in
`/vercel/wewise-data/tencent-gateway.key` with mode 0600. It does not print it or
write it into Git, build output, browser configuration or a command argument.
The daemon loads `backend/tencent-memory.yaml`: capture, extraction, LLM,
embedding and skill generation are disabled; the unusable loopback LLM endpoint
is an additional barrier. Both team and agent namespaces are assigned privately
per app customer. Only explicitly approved preference projections are mirrored;
the SQLite approval ledger remains authoritative and stale mirrors are rejected.
The daemon's stdout/stderr are discarded to avoid retaining upstream data logs.

Projection writes and deletes are not claims of upstream historical erasure or
snapshot deletion. The prototype remains synthetic-data-only. A deployment
operator verifies healthy/authenticated read/write and isolation separately from
application integration, then checks `/api/health` after restarting the matching
backend. Installing assets alone does not change the existing running process.

## Activation and persistence

Preserve the data directory when checking out the exact reviewed app commit.
Install `backend/requirements.lock.txt` in the existing virtual environment.
The current Sandbox uses a uv-managed environment; from `/vercel/WeWise` run
`uv pip install --python .venv/bin/python -r backend/requirements.lock.txt`.
After stopping only that app's own uvicorn process, run its fixed
`deploy/ensure_backend.py`. The helper resumes MemoryCore first, enables the
pinned local embedding directory, and starts the backend with external models
disabled. A healthy existing backend is left running. Its public health response
must report the actual semantic and Tencent state before claiming activation.
Filesystem state survives a named Sandbox snapshot/resume; process memory does
not, which is why both services have explicit resume helpers.
