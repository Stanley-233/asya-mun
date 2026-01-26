import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // 在生产构建时忽略类型错误（用于CI/CD）
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
