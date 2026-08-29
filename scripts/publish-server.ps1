<#
.SYNOPSIS
    构建并发布 AsyaMun 服务器（单进程：ASP.NET API + WebSocket + 前端静态产物）。

.DESCRIPTION
    生成自包含单文件可执行程序 + 内嵌前端静态资源，并打成 zip 压缩包。
    产物运行时不依赖 Node / .NET 运行时，直接执行即可。
    需要本机安装 .NET SDK 10（目标框架 net10.0）。

.EXAMPLE
    .\scripts\publish-server.ps1
    .\scripts\publish-server.ps1 -Rid linux-x64
    .\scripts\publish-server.ps1 -SkipFrontendBuild
#>
[CmdletBinding()]
param(
    # 目标运行时标识（RID），默认使用当前机器的 RID
    [string]$Rid = [System.Runtime.InteropServices.RuntimeInformation]::RuntimeIdentifier,
    # 产物输出目录（默认仓库根目录下的 dist）
    [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) "dist"),
    # 已有 frontend/out 时跳过前端构建
    [switch]$SkipFrontendBuild,
    # 跳过轻量版（framework-dependent）发布，只出自包含版
    [switch]$SkipFrameworkDependent
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$frontendDir = Join-Path $repoRoot "frontend"
$outDir = Join-Path $frontendDir "out"
$apiDir = Join-Path $repoRoot "backend-dotnet\src\AsyaMun.Api"
$apiProject = Join-Path $apiDir "AsyaMun.Api.csproj"
$wwwrootDir = Join-Path $apiDir "wwwroot"
$publishDir = Join-Path $OutputDirectory "publish"
$zipPath = Join-Path $OutputDirectory "asya-mun-server-$Rid.zip"

if (-not (Test-Path $apiProject)) { throw "找不到后端项目: $apiProject" }

# 1) 构建前端（Next 静态导出）
$needFrontendBuild = -not (Test-Path (Join-Path $outDir "index.html"))
if (-not $SkipFrontendBuild) { $needFrontendBuild = $true }

if ($needFrontendBuild) {
    Write-Host "==> 构建前端..."
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "未找到 pnpm" }
    Push-Location $frontendDir
    try {
        if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
            pnpm install --frozen-lockfile
        }
        $env:NEXT_PUBLIC_API_BASE_URL = ""
        $env:SKIP_TYPE_CHECK = "true"
        pnpm build
        if ($LASTEXITCODE -ne 0) { throw "前端构建失败" }
    }
    finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $outDir "index.html"))) { throw "前端产物缺失: $outDir/index.html" }

# 2) 前端静态产物拷入 wwwroot，供 dotnet publish 内嵌
Write-Host "==> 同步前端产物到 wwwroot..."
Remove-Item -Recurse -Force $wwwrootDir -ErrorAction SilentlyContinue
Copy-Item $outDir $wwwrootDir -Recurse

# 3) 自包含单文件发布
Write-Host "==> dotnet publish ($Rid, self-contained, single-file)..."
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw "未找到 dotnet SDK" }

Remove-Item -Recurse -Force $publishDir -ErrorAction SilentlyContinue
dotnet publish $apiProject `
    -c Release `
    -r $Rid `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:IncludeAllContentForSelfExtract=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $publishDir

if ($LASTEXITCODE -ne 0) { throw "dotnet publish 失败" }

# 3b) 轻量版：framework-dependent 单文件（服务器已装 .NET 运行时后只需更新应用本身）
$fdZipPath = Join-Path $OutputDirectory "asya-mun-server-$Rid-fd.zip"
if (-not $SkipFrameworkDependent) {
    $fdPublishDir = Join-Path $OutputDirectory "publish-fd"
    Write-Host "==> dotnet publish ($Rid, framework-dependent, single-file)..."
    Remove-Item -Recurse -Force $fdPublishDir -ErrorAction SilentlyContinue
    dotnet publish $apiProject `
        -c Release `
        -r $Rid `
        --self-contained false `
        -p:PublishSingleFile=true `
        -p:IncludeAllContentForSelfExtract=true `
        -p:DebugType=None `
        -p:DebugSymbols=false `
        -o $fdPublishDir

    if ($LASTEXITCODE -ne 0) { throw "dotnet publish(framework-dependent) 失败" }
    if (Test-Path $fdZipPath) { Remove-Item -Force $fdZipPath }
    Compress-Archive -Path (Join-Path $fdPublishDir "*") -DestinationPath $fdZipPath
    Write-Host "发布完成: $fdZipPath" -ForegroundColor Green
}
Remove-Item -Recurse -Force $wwwrootDir -ErrorAction SilentlyContinue

# 4) 打 zip（内容置于压缩包根目录）
Write-Host "==> 打包..."
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $publishDir "*") -DestinationPath $zipPath

Write-Host ""
Write-Host "发布完成: $zipPath" -ForegroundColor Green
Write-Host "运行: 解压后直接执行 AsyaMun.Api.exe（Linux 上执行 ./AsyaMun.Api）；-fd 版需先安装 ASP.NET Core 运行时 10.x"
Write-Host "配置: 环境变量 ConnectionStrings__DefaultConnection（Postgres 连接串）, JWT_SECRET, ASYA_WEBROOT, ASPNETCORE_URLS"