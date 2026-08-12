import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // 在生产构建时忽略类型错误（用于CI/CD）
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
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
    const shouldProxyApi =
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PROXY_API_TO_BACKEND === 'true';

    // Docker 镜像内没有外部 Nginx，由 Next.js 将 /api 代理到同容器后端。
    // 其他生产部署保持原行为，继续由外部反向代理负责。
    if (!shouldProxyApi) {
      return [];
    }
    
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8080/api/:path*',
      },
      {
        source: '/doc.html',
        destination: 'http://127.0.0.1:8080/doc.html',
      },
      {
        source: '/swagger-ui.html',
        destination: 'http://127.0.0.1:8080/swagger-ui.html',
      },
      {
        source: '/swagger-ui/:path*',
        destination: 'http://127.0.0.1:8080/swagger-ui/:path*',
      },
      {
        source: '/v3/api-docs/:path*',
        destination: 'http://127.0.0.1:8080/v3/api-docs/:path*',
      },
      {
        source: '/webjars/:path*',
        destination: 'http://127.0.0.1:8080/webjars/:path*',
      },
    ];
  },
};

export default nextConfig;
