import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

/** 仅主机名，勿带 http:// 或端口（见 Next.js allowedDevOrigins 文档） */
const extraDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim().replace(/^https?:\/\//, "").split(":")[0])
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  // 开发环境关闭 React Compiler，减少无改动时的重复编译
  reactCompiler: !isDev,
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.30.80.39",
    "nextformat.aiblank.top",
    ...extraDevOrigins,
  ],
  serverExternalPackages: [
    "ffmpeg-static",
    "fluent-ffmpeg",
    "sharp",
    "protobufjs",
    "jszip",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "300mb",
    },
    proxyClientMaxBodySize: "300mb",
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Next 16 webpack schema：ignored 仅接受非空字符串 glob，勿合并默认 RegExp/空串
      const { ignored: _ignored, ...restWatch } = config.watchOptions ?? {};
      config.watchOptions = {
        ...restWatch,
        ignored: [
          "**/.next/**",
          "**/node_modules/**",
          "**/.git/**",
          "**/data/**",
          "**/.cursor/**",
        ],
        aggregateTimeout: 1000,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
