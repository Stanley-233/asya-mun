import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // 静态导出不提供运行时图片优化，本地静态资源原样输出
    unoptimized: true,
  },
  typescript: {
    // 在生产构建时忽略类型错误（用于CI/CD）
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  // headers/rewrites 依赖 Node 服务端运行，静态导出（output: export）不支持，
  // 仅保留在本地开发（next dev）中生效；生产由 ASP.NET 静态托管负责转发与缓存控制。
  ...(process.env.NODE_ENV === 'development'
    ? {
        async headers() {
          return [
            {
              // API 接口绝对不能缓存（即使源站没返回 Cache-Control）
              source: '/api/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'no-store, must-revalidate',
                },
              ],
            },
            {
              // 页面 HTML 禁止长期 CDN 缓存，避免部署后用户拿到旧 HTML 引用旧 JS chunk
              // 正则排除 /_next/*（带 hash 的静态资源由 Next.js 自己控制 long cache）和 /api/*
              source: '/:path((?!_next|api).*)?',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=0, must-revalidate',
                },
              ],
            },
          ];
        },
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://127.0.0.1:5151/api/:path*',
            },
            {
              source: '/scalar/:path*',
              destination: 'http://127.0.0.1:5151/scalar/:path*',
            },
            {
              source: '/openapi/:path*',
              destination: 'http://127.0.0.1:5151/openapi/:path*',
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;