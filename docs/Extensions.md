# 插件开发与管理

ASYA 的前端扩展通过固定的 `/extensions?id={插件id}` 入口加载。内置与外置扩展使用同一份声明和运行协议；内置源码保存在本仓库，外置扩展安装其独立 Repo 发布的预构建目录。

当前支持纯前端工具插件。后端联合插件的装载、数据库迁移和按会议启用留待后续实现。带 `backend` 声明的插件会被当前安装器拒绝，宿主也不会公布它们。

## 源码与构建产物

```text
extension/
  asya.dice/
    extension.json
    frontend/
      index.tsx
      tool.tsx
  asya.medieval-strategy/
    extension.json
    frontend/...
packages/extension-sdk/           # 公开协议、React 挂载助手与基础 UI
frontend/
  components/extensions/         # 登录检查、错误提示、iframe 宿主
  public/extension/{id}/         # 插件独立构建产物（不入库）
```

`pnpm dev`、`pnpm build` 在启动前自动构建内置插件。也可以在 `frontend/` 中单独执行：

```bash
pnpm build:extensions
pnpm test:extensions
pnpm exec tsc --project tsconfig.extensions.json
```

默认构建所有内置插件。构建时可用逗号分隔的 `ASYA_EXTENSIONS` 选择插件，例如 PowerShell：

```powershell
$env:ASYA_EXTENSIONS = 'asya.dice'
pnpm build
Remove-Item Env:ASYA_EXTENSIONS
```

显式设置为空字符串时不预装内置插件；未设置时全部预装。未知 ID 会导致构建失败。构建脚本只替换 `frontend/public/extension/` 生成目录，不操作源码或另行部署的插件。

## 插件声明

```json
{
  "schemaVersion": 1,
  "hostApiVersion": 1,
  "id": "author.example",
  "name": "示例工具",
  "version": "1.0.0",
  "author": "Author",
  "description": "工具说明",
  "frontend": { "entry": "index.html", "icon": "puzzle" },
  "permissions": []
}
```

ID 由作者声明，作为源码目录名、部署目录名和持久化命名空间。允许小写字母、数字及单个分隔的 `.`、`_`、`-`，长度最多 80；禁止路径分隔符、连续分隔符和 Windows 保留设备名。建议使用作者命名空间，避免冲突。已安装 ID 冲突时拒绝覆盖。

`frontend.entry` 必须是插件目录中的相对 HTML 路径。v1 的图标支持 `dices`、`swords`，其他名称使用通用插件图标。`permissions` 当前仅用于能力声明，不构成权限沙箱。

内置插件约定以 `frontend/index.tsx` 为构建入口，可在 `frontend/public/` 放置自有资源。构建工具禁止插件导入主站私有的 `@/` 路径。React 工具通过 `@asya-mun/extension-sdk` 和 `@asya-mun/extension-sdk/ui` 使用公开接口；SDK 当前是本仓库中的源码包，尚未发布到公共包注册表。

外部 Repo 可以使用自己的技术栈和构建工具。安装目录只需要包含声明、HTML 入口和其使用的静态文件，不要求安装时存在 React、Next.js、Node.js 开发依赖。

## 部署后安装、启停与卸载

单文件发行包将插件保留为独立磁盘文件，默认目录为 **服务器可执行文件旁的 `wwwroot/extension/`**。核心静态页面与插件资源一起托管，不需要额外启动前端进程。

安装工具需要 Node.js，服务正常运行不依赖 Node.js。指定明确的部署插件目录：

```bash
node scripts/manage-extensions.mjs install /path/to/prebuilt-plugin --target /path/to/server/wwwroot/extension
node scripts/manage-extensions.mjs disable author.example --target /path/to/server/wwwroot/extension
node scripts/manage-extensions.mjs enable author.example --target /path/to/server/wwwroot/extension
node scripts/manage-extensions.mjs uninstall author.example --target /path/to/server/wwwroot/extension
```

安装的是已构建目录，不接受 Repo 源码地址。安装器检查协议版本、ID、入口文件及符号链接，并通过暂存目录完成安装。更新插件时先卸载旧版，再安装新版和显式启用。

禁用状态记录在部署目录的 `.settings.json` 中；卸载也保留禁用记录，避免默认发行包在升级覆盖时重新启用插件。重新安装后执行 `enable` 即可恢复。升级时应保留这份设置文件。

卸载只删除部署中的插件目录，不删除 MonoRepo 源码，也不删除浏览器保存的数据。骰娘会兼容读取旧版历史，新记录保存在 `asya.extension.asya.dice.history` 中。

宿主在请求时发现安装与禁用变化，无需重启。导航和已打开的宿主页面每 30 秒刷新目录；重新打开或刷新页面也会立即查询。禁用插件后，其静态资源立即返回 404，已加载的界面在下一次目录刷新时卸载。

可通过 `Extensions__Path` 覆盖部署插件目录。若设置 `ASYA_WEBROOT`，默认使用它下面的 `extension/`。本地 `Development` 环境在没有部署插件目录时自动读取仓库的 `frontend/public/extension/`；这是生成目录，开发时重新构建会重置其中的本地安装与设置。

## 宿主协议与信任边界

工具在独立 iframe 中运行，SDK 使用 `asya.extension.v1` 消息协议同步启动、尺寸、提示信息及当前用户和会议上下文。双方校验消息来源窗口、同源地址和插件 ID。业务 API 仍由后端鉴权；协议不传递 JWT。

iframe 卸载时结束该工具的运行，SDK 提供的 disposer 会清理自身订阅和观察器。插件自行创建的其他资源也应遵循其生命周期。

当前插件与宿主同源运行，仅安装可信插件。同源 iframe 用于隔开页面样式与运行环境，插件代码仍能访问同源能力；它不是安全沙箱。运行不可信插件需要后续引入独立来源与受限能力桥接。
