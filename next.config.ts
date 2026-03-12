import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 允许从生产/内网访问 dev 时的跨域请求，避免控制台警告
  allowedDevOrigins: [
    "https://nextformat.aiblank.top",
    "http://localhost:3000",
  ],
};

export default nextConfig;
