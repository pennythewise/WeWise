$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$vendorRoot = Join-Path $projectRoot 'backend/vendor/tencent-agent-memory'
if (-not (Test-Path -LiteralPath $vendorRoot)) {
    git clone --filter=blob:none https://github.com/TencentCloud/TencentDB-Agent-Memory.git $vendorRoot
    if ($LASTEXITCODE -ne 0) { throw 'Tencent source clone failed.' }
}
git -C $vendorRoot checkout e9a82935b52741e0c798c75326e90b7144eb4d5f
if ($LASTEXITCODE -ne 0) { throw 'Pinned Tencent commit is unavailable.' }
Push-Location (Join-Path $vendorRoot 'MemoryCore')
try {
    # Upstream postinstall modifies coding-agent integrations. This app does not
    # install those integrations; use the standalone server only.
    npm.cmd install --ignore-scripts --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Tencent runtime install failed.' }
} finally { Pop-Location }
Write-Host 'Tencent standalone runtime installed. Start with infra/scripts/start-memory.ps1.'
