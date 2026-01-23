/**
 * API 使用示例
 * 
 * 这个文件展示了如何使用自动生成的 API hooks
 */

'use client';

import { useEffect } from 'react';
import { useHelloWorld, getHelloWorldUrl } from '@/lib/api/endpoints/hello-world-controller/hello-world-controller';

export function ApiExample() {
  // 使用自动生成的 hook，它基于 React Query
  const { data, isLoading, error } = useHelloWorld();

  // 调试信息
  useEffect(() => {
    const url = getHelloWorldUrl();
    console.log('📍 实际请求地址:', `${typeof window !== 'undefined' ? window.location.origin : ''}/api${url}`);
    console.log('🔄 API 调用状态:', { 
      isLoading, 
      hasError: !!error,
      hasData: !!data 
    });
    if (data) {
      console.log('✅ 返回值:', data);
      console.log('📦 返回数据类型:', {
        dataType: typeof data.data,
        statusCode: data.status,
        hasHeaders: !!data.headers
      });
    }
    if (error) {
      console.error('❌ 错误信息:', error);
    }
  }, [data, error, isLoading]);

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <div className="space-y-2">
          <p className="font-semibold">错误: {error instanceof Error ? error.message : '未知错误'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h3 className="font-semibold text-lg">API 调用示例</h3>
      <div className="bg-muted p-3 rounded-md">
        <p className="text-sm text-muted-foreground">
          状态: {data?.status === 200 ? '✅ 连接成功' : '连接失败'}
        </p>
        {data?.data && (
          <p className="text-sm mt-2">
            响应: {typeof data.data === 'object' ? JSON.stringify(data.data, null, 2) : String(data.data)}
          </p>
        )}
      </div>
    </div>
  );
}
