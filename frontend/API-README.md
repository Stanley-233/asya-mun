# API 自动化集成指南

## 已完成的配置

✅ 已安装并配置好以下工具：
- **orval**: OpenAPI 代码生成器
- **@tanstack/react-query**: 强大的数据获取和状态管理
- **axios**: HTTP 客户端

## 使用方法

### 1. 生成 API 代码

每当后端 API 更新时，运行：

```bash
pnpm generate:api
```

这会从 `http://127.0.0.1:8080/v3/api-docs.yaml` 获取最新的 OpenAPI 文档并自动生成：
- TypeScript 类型定义
- React Query hooks
- API 客户端代码

### 2. 在组件中使用

```tsx
'use client';

import { useHelloWorld } from '@/lib/api/endpoints/hello-world-controller/hello-world-controller';

export function MyComponent() {
  // GET 请求示例
  const { data, isLoading, error } = useHelloWorld();

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;
  
  return <div>{data}</div>;
}
```

### 3. Mutation 示例（POST/PUT/DELETE）

```tsx
'use client';

import { useCreateUser } from '@/lib/api/endpoints/用户管理/用户管理';

export function CreateUserForm() {
  const { mutate, isPending } = useCreateUser();

  const handleSubmit = (formData: FormData) => {
    mutate(
      {
        data: {
          name: formData.get('name') as string,
          email: formData.get('email') as string,
        },
      },
      {
        onSuccess: (data) => {
          console.log('创建成功', data);
        },
        onError: (error) => {
          console.error('创建失败', error);
        },
      }
    );
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## 目录结构

```
lib/
├── api/
│   ├── client.ts              # Axios 客户端配置
│   ├── query-provider.tsx     # React Query Provider
│   ├── example-usage.tsx      # 使用示例
│   └── endpoints/             # 自动生成的 API 代码（不要手动修改）
│       ├── asyaBackendAPI.schemas.ts
│       ├── hello-world-controller/
│       └── 用户管理/
```

## 配置文件

### orval.config.ts
- 配置 API 文档地址
- 配置生成代码的目标目录
- 配置客户端类型（react-query）

### lib/api/client.ts
- 配置 Axios 实例
- 添加请求/响应拦截器
- 处理认证 token
- 统一错误处理

## 环境变量

创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
```

生产环境时修改为实际的后端地址。

## 常见场景

### 1. 带查询参数的请求

```tsx
const { data } = useGetUsers({
  params: {
    page: 1,
    limit: 10,
    search: 'keyword',
  },
});
```

### 2. 带路径参数的请求

```tsx
const { data } = useGetUser({
  userId: '123',
});
```

### 3. 手动触发请求

```tsx
const { refetch } = useGetUser(
  { userId: '123' },
  { enabled: false } // 不自动执行
);

// 手动触发
<button onClick={() => refetch()}>刷新</button>
```

### 4. 依赖查询

```tsx
const { data: user } = useGetCurrentUser();
const { data: posts } = useGetUserPosts(
  { userId: user?.id },
  { enabled: !!user?.id } // 只有当 user.id 存在时才执行
);
```

## 开发流程

1. **后端更新 API** → 确保后端服务运行在 `http://127.0.0.1:8080`
2. **生成代码** → `pnpm generate:api`
3. **使用新的 hooks** → 在组件中导入并使用
4. **TypeScript 类型自动提示** → 享受完整的类型安全

## 注意事项

- ⚠️ 不要手动修改 `lib/api/endpoints/` 下的文件，每次生成会覆盖
- ⚠️ 自定义逻辑写在 `lib/api/client.ts` 中
- ⚠️ 确保后端服务在生成时可访问
- ✅ 已在 [.gitignore](.gitignore) 中添加生成文件的忽略规则（可根据团队需要调整）

## 高级功能

### 全局错误处理

在 [lib/api/client.ts](lib/api/client.ts#L21-L32) 中配置响应拦截器：

```ts
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 跳转登录
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 添加认证 Token

在 [lib/api/client.ts](lib/api/client.ts#L8-L19) 中配置请求拦截器：

```ts
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 相关资源

- [Orval 文档](https://orval.dev/)
- [React Query 文档](https://tanstack.com/query/latest)
- [Axios 文档](https://axios-http.com/)
