<p align="center">
  <img src="./docs/images/asya-logo.png" alt="ASYA Logo" width="220" />
</p>

# ASYA: 非对称联动自动化系统

**非对称联动自动化系统**（**ASYA System**，Asymmetric SYnergy Automation System）是一款模拟联合国联动体系一站式解决方案。

项目期望以信息化的手段，逐渐改善传统模拟联合国联动会场中，由于代表与学团之间信息交互渠道不足而导致的参会体验问题。

![ASYA 首页](./docs/images/login.png)

![ASYA 会议页面](./docs/images/progress.png)

## 部署指南

ASYA 以**自包含单文件可执行程序**发布（无需安装 .NET 运行时，也无需 Docker）。从 [GitHub Releases](https://github.com/anomalyco/asya-mun/releases) 下载对应平台的 `asya-mun-server-*.zip`：

- `asya-mun-server-linux-x64.zip` / `asya-mun-server-linux-arm64.zip` — Linux
- `asya-mun-server-win-x64.zip` — Windows
- `asya-mun-server-osx-x64.zip` / `asya-mun-server-osx-arm64.zip` — macOS（x64 / Apple Silicon）

以上为**自包含版**（无需安装 .NET，解压即用）。若服务器已经装好 .NET（ASP.NET Core 运行时 10.x），每个平台还可选 `-fd` 后缀的**轻量版**（仅几 MB，升级只需重新下载它，不必反复拉取运行时）。

解压后直接运行 `AsyaMun.Api`（Linux/macOS）或 `AsyaMun.Api.exe`（Windows）。前端页面、REST API 与 WebSocket 由**同一个服务进程**同源提供（`/api`、`/ws`），不需要 nginx 或其他静态文件服务器。

运行前通过环境变量配置：

- `ConnectionStrings__DefaultConnection`：Postgres 连接串，例如 `Host=localhost;Port=5432;Database=asya;Username=asya;Password=<pwd>`；
- `JWT_SECRET`：JWT 签名密钥（至少 32 字符）；
- `ASPNETCORE_URLS`（可选）：监听地址，例如 `http://+:8080`（默认 `http://localhost:5000`）；
- `ASYA_WEBROOT`（可选）：前端静态目录覆盖，默认取可执行文件同目录的 `wwwroot`。

## 反向代理配置说明

ASYA 本身就是单进程服务，直接对外暴露监听端口即可访问全部功能，**这步不是必选项**。

只有当你想通过域名访问 ASYA（例如 https://mun.example.com ），或需要在最外层再加一层反向代理（TLS、负载均衡、多服务共用入口）时，把请求转发到 ASYA 服务实际监听的端口即可。

以 Caddy 为例（Caddyfile）：

```Caddyfile
mun.example.com {
    # 转发到 ASYA 实际监听端口；需先让服务监听对应端口，例如：
    #   ASPNETCORE_URLS=http://+:3000 ./AsyaMun.Api
    reverse_proxy 127.0.0.1:3000
}
```

## 许可证

本项目基于 **PolyForm Shield License 1.0.0** 授权。

你可以在 PolyForm Shield 的条款下使用本软件。具体条款请查看 [LICENSE](./LICENSE) 文件。

在 PolyForm Shield 下，开发者授予你如下几项版权许可：

- 将本软件用于个人、学习、研究等非竞争性目的；
- 阅读和学习源代码；
- 修改本软件；
- 在非竞争性目的下，再分发原始版本或修改后的版本（需遵守许可证条款）。

需要注意的是，你不得使用本软件提供与 ASYA 或其开发者的任何产品**相竞争的产品或服务**。具体竞争定义请参阅许可证全文。

如果你的使用场景涉及提供竞争性产品，如其他模拟联合国会议软件，请书面联系[开发者](mailto:acc_stanley@foxmail.com)获取额外授权。

### 商标与品牌

本项目的名称、Logo、视觉标识、域名以及其他品牌资产，除非另有明确说明，不随许可证一并授权。

未经许可，不得使用 ASYA 的名称或品牌元素来暗示官方认可、合作关系或授权关系。

## 官方服务免责声明与使用条款

访问或使用由开发者提供的 [ASYA 官方在线服务](https://mun.bearingwall.top) 前，你应当知悉并遵守 [ASYA 官方在线服务免责声明与使用条款](./docs/official-eula.md) 所载的所有条款。
