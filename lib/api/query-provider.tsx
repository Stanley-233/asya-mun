'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 60 * 1000, // 1 小时 - 数据在1小时内不会被标记为过时
            gcTime: 60 * 60 * 1000, // 1 小时 - 未使用的缓存数据保留1小时
            refetchOnWindowFocus: true, // 窗口聚焦时自动重新请求
            refetchOnMount: true, // 组件挂载时自动重新请求（如果有缓存数据）
            refetchOnReconnect: true, // 网络重连时自动重新请求
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
