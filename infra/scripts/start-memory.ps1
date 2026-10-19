$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
$coreRoot = Join-Path $projectRoot 'backend/vendor/tencent-agent-memory/MemoryCore'
if (-not (Test-Path -LiteralPath $coreRoot)) { throw 'Run infra/scripts/setup-memory.ps1 first.' }
$env:TDAI_GATEWAY_CONFIG = Join-Path $projectRoot 'backend/tencent-memory.yaml'
$env:TDAI_DATA_DIR = Join-Path $projectRoot 'backend/.data/tencent'
$env:V3_STRICT_ISOLATION = 'true'
# Read only the generated sidecar credential, never print it.
$env:TDAI_GATEWAY_API_KEY = & $pythonPath -c "from dotenv import dotenv_values; import sys; print(dotenv_values(sys.argv[1]).get('TDAI_GATEWAY_API_KEY',''))" (Join-Path $projectRoot '.env')
if (-not $env:TDAI_GATEWAY_API_KEY) { throw 'Configure a random TDAI_GATEWAY_API_KEY in .env first.' }
Push-Location $coreRoot
try { node --import tsx src/gateway/server.ts } finally { Pop-Location }
