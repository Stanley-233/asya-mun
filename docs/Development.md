# Dev

## 环境要求

- .NET SDK 10（目标框架 `net10.0`）
- Node.js 24 + pnpm（前端）
- PostgreSQL

## 后端（ASP.NET）

```bash
# 1. 本机 PostgreSQL 准备一个库（和 appsettings.json 里的默认连接串对应即可）
createdb asya

# 2. 配置连接串（默认 Host=localhost;Database=asya;Username=asya;Password=asya）
#    PowerShell:
#      $env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=asya;Username=asya;Password=你的密码"
#    bash:
#      export ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=asya;Username=asya;Password=你的密码"

# 3. 启动后端
cd backend-dotnet/src/AsyaMun.Api
dotnet run
# 默认 http://localhost:5151，接口文档在 /scalar
```

数据库表结构由 EF Core Migrations 管理：全新空库首启自动迁移；既有 Flyway 库会自动标记为首个迁移已应用，避免重复建表。

## 前端

```bash
cd frontend
pnpm install
pnpm dev
# 开发调试走 Next dev（http://localhost:3000），/api、/scalar、/openapi 由 Next 重写到 5151
```

## 单进程模式（后端直接托管前端）

不跑 `next dev`、让后端把静态产物和 API/WebSocket 一起托管时：

```bash
# 1. 先构建静态前端
cd frontend
NEXT_PUBLIC_API_BASE_URL= pnpm build   # 生成 frontend/out

# 2. 再启动后端（Program.cs 会自动识别仓库内 frontend/out 作为静态目录）
cd backend-dotnet/src/AsyaMun.Api
dotnet run
# http://localhost:5151 直接提供整站（前端页面 + API + WebSocket 同源）
```

## 发布单文件（zip）

```powershell
.\scripts\publish-server.ps1          # 默认当前平台 RID
.\scripts\publish-server.ps1 -Rid linux-x64
# 产物：dist\asya-mun-server-<RID>.zip（自包含单文件，含内嵌前端）
#        dist\asya-mun-server-<RID>-fd.zip（轻量版，需目标机已装 .NET 运行时）
```

## Release 发布

打 `vX.Y.Z` 标签（与 `VERSION` 文件一致）触发 `.github/workflows/publish-binaries.yml`，
自动交叉编译 `linux-x64 / linux-arm64 / win-x64 / osx-x64 / osx-arm64` 五个平台的服务端二进制，
每个平台同时产出**自包含版**与 **`-fd` 轻量版**（framework-dependent），连同 `SHA256SUMS.txt` 一起挂到 GitHub Release。

服务器装过一次 .NET 运行时后，后续只需更新 `-fd` 小包，无需重复下载运行时。