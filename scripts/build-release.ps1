# Builds the full release locally, mirroring .github/workflows/publish-binaries.yml
# (prepare job: frontend pnpm build -> frontend/out; build job: frontend/out copied
#  into backend wwwroot, then dotnet publish -> single-file binary in <RepoRoot>/out).
#
# Usage:
#   .\build-release.ps1                 # frontend + backend self-contained win-x64
#   .\build-release.ps1 -Rid linux-x64  # cross-publish a specific runtime
#   .\build-release.ps1 -SkipFrontend   # reuse existing frontend/out

[CmdletBinding()]
param(
    [string]$Rid = "win-x64",
    [switch]$SkipFrontend,
    [switch]$Unified
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir  = Join-Path $RepoRoot "backend-dotnet\src\AsyaMun.Api"
$FrontendOut = Join-Path $FrontendDir "out"
$OutputDir   = Join-Path $RepoRoot "out"

if (-not $Unified) {
    Write-Host "==> Building ASYA release (RID=$Rid)" -ForegroundColor Cyan
}

# ---------- 1. Frontend (prepare job) ----------
if (-not $SkipFrontend) {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "pnpm not found on PATH"
    }
    Push-Location $FrontendDir
    try {
        Write-Host "==> pnpm install --frozen-lockfile" -ForegroundColor Cyan
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed (exit $LASTEXITCODE)" }

        Write-Host "==> pnpm build (NEXT_PUBLIC_API_BASE_URL='', SKIP_TYPE_CHECK=true)" -ForegroundColor Cyan
        $env:NEXT_PUBLIC_API_BASE_URL = ""
        $env:SKIP_TYPE_CHECK = "true"
        pnpm build
        $code = $LASTEXITCODE
        Remove-Item Env:NEXT_PUBLIC_API_BASE_URL, Env:SKIP_TYPE_CHECK -ErrorAction SilentlyContinue
        if ($code -ne 0) { throw "pnpm build failed (exit $code)" }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "==> Skipping frontend build, reusing $FrontendOut" -ForegroundColor Yellow
}

if (-not (Test-Path $FrontendOut)) {
    throw "frontend/out does not exist: $FrontendOut"
}

# ---------- 2/3. Backend: copy frontend out -> wwwroot, then publish ----------
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet not found on PATH"
}

Write-Host "==> Copying frontend/out into backend wwwroot" -ForegroundColor Cyan
$WwwRoot = Join-Path $BackendDir "wwwroot"
if (Test-Path $WwwRoot) { Remove-Item -Recurse -Force $WwwRoot }

# copy contents so the wwwroot directory itself is created by Copy-Item
New-Item -ItemType Directory -Path $WwwRoot -Force | Out-Null
Copy-Item -Path (Join-Path $FrontendOut "*") -Destination $WwwRoot -Recurse -Force

Write-Host "==> dotnet publish (single-file, $Rid)" -ForegroundColor Cyan
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
Push-Location $BackendDir
try {
    dotnet publish -c Release -r $Rid --self-contained true `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:IncludeAllContentForSelfExtract=true `
        -p:DebugType=None `
        -p:DebugSymbols=false `
        -o $OutputDir
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Build complete." -ForegroundColor Green
Write-Host "    Frontend out : $FrontendOut"
Write-Host "    Publish dir  : $OutputDir"
Write-Host "    Run with     : $OutputDir\AsyaMun.Api.exe   (default http://localhost:5000)"