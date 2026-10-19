$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Create .venv and install backend/requirements.txt first. See IMPLEMENTATION.md.' }
Push-Location $projectRoot
try { & $pythonPath -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8017 --env-file .env } finally { Pop-Location }
