# 后端程序集与依赖

生产代码包含三个程序集，保持单进程服务与现有 API 路径：

| 程序集 | 职责 |
| --- | --- |
| `AsyaMun.Api` | 启动装配、Controller、HTTP 参数解析、认证与审计中间件、SignalR Hub、前端和插件资源托管 |
| `AsyaMun.Application` | 业务用例、业务权限检查、流程编排；按身份、会议、消息、指令、代表属性、通知和平台能力组织 |
| `AsyaMun.Core` | 实体、枚举、错误、分页和上传契约、通知发送接口、插件声明协议、JWT 工具、DbContext、映射与迁移 |

依赖方向为 `Api → Application → Core`，Api 在装配时也直接引用 Core。Core 在本项目中承担业务和数据基础，不要求其作为纯领域程序集。

Application 和 Core 不引用 Api 或 ASP.NET Core。分页查询参数由 Api 的 `PageInputParser` 转成 Core 中的普通分页对象；上传接口由 Api 把 `IFormFile` 转成由调用方管理生命周期的 `UploadFile` 流。Application 的通知用例通过 `INotificationSender` 调用 Api 中的 SignalR 适配器。

`Application/Features/` 按业务组织服务与请求、响应数据类型。Core 保留单个 `AppDbContext`；此次迁移不调整表结构或拆分数据库事务，也不引入通用仓储层。未来插件对外契约集中于 `Core/Extensions`，后端插件的装载与独立数据管理尚未实现。

## 数据库迁移

DbContext 和迁移已迁到 Core，迁移 ID `20260822154119_InitialCreate` 保持不变。Api 启动仍执行原有的数据库初始化与 Flyway 兼容逻辑。

新增迁移时，指定 Core 为目标项目、Api 为启动项目：

```bash
dotnet ef migrations add MigrationName --project backend-dotnet/src/AsyaMun.Core --startup-project backend-dotnet/src/AsyaMun.Api
```

## 验证

```bash
dotnet build backend-dotnet/asya-mun-dotnet.sln
dotnet run --project backend-dotnet/tests/AsyaMun.SmokeTests --no-launch-profile
```

SmokeTests 是独立的测试用控制台项目，不属于生产解决方案，也不需要运行 PostgreSQL。它检查程序集依赖、服务装配、分页兼容、迁移 ID 和模型快照，并启动临时 HTTP 服务验证插件接口鉴权及资源禁用行为。
