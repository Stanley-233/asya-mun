# API 集成说明

## 当前模式

- `orval` 只负责根据 OpenAPI 生成类型定义，输出到 `lib/api/generated/`
- 请求函数、query 参数拼装、React Query hooks 全部手写，位于：
  - `lib/api/core/`
  - `lib/api/apis/`
  - `lib/api/hooks/`
- 业务代码不要再依赖 `lib/api/endpoints/`

## 目录结构

```text
lib/api/
├── apis/                 # 手写 API 方法
├── client.ts             # Axios 实例 + requester 单例
├── core/                 # transport / requester / query / result / errors
├── generated/            # OpenAPI 生成的类型定义
├── hooks/                # 手写 React Query hooks / query keys
├── query-provider.tsx    # React Query Provider
└── types.ts              # generated 类型导出
```

## 生成类型

后端 OpenAPI 更新后执行：

```bash
pnpm generate:api
```

当前配置会：

- 只生成 `lib/api/generated/` 下的 schema/types
- 不会再生成 `lib/api/endpoints/`
- 不会生成请求函数或 React Query hooks
- 生成过程中会临时写入 `.orval/`，脚本结束后自动删除

## 使用方式

### 1. 直接调用手写 API

```tsx
import { login } from '@/lib/api/hooks/user'

const result = await login({
  name: 'demo',
  password: 'secret',
  role: 'DM',
})
```

### 2. 使用手写 Query Hook

```tsx
import { useGetRegistrationSwitch } from '@/lib/api/hooks/user'

const { data, isLoading } = useGetRegistrationSwitch({
  query: {
    retry: false,
  },
})
```

### 3. 使用显式 Query Key

```tsx
import { userKeys } from '@/lib/api/hooks/user'

queryClient.invalidateQueries({
  queryKey: userKeys.registrationSwitch(),
})
```

### 4. 分页接口

- 分页查询必须手写 query 拼装
- `pageable.page` / `pageable.size` / `pageable.sort` 由 `lib/api/core/query.ts` 展平为 URL 参数
- 不要再依赖生成器默认序列化分页对象

## 约定

- 类型从 `@/lib/api/generated` 或 `@/lib/api/types` 导入
- hooks 从 `@/lib/api/hooks/*` 导入
- 原始 API 方法从 `@/lib/api/apis/*` 导入
- `multipart/form-data`、blob 下载等特殊请求统一收口到对应 API 模块，不在页面内直接拼 URL

## 注意事项

- 不要手改 `lib/api/generated/`
- 手写请求逻辑只放在 `lib/api/apis/`、`lib/api/hooks/`、`lib/api/core/`
- 401 跳转、token 注入、响应解包统一在 `lib/api/client.ts` 和 `lib/api/core/result.ts`
