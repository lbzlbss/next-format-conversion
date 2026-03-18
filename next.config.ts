import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "https://nextformat.aiblank.top",
    "http://localhost:3000",
  ],
  // Prevent webpack from bundling native binaries / CJS-only packages.
  // They are accessed at runtime from node_modules instead.
  serverExternalPackages: [
    'ffmpeg-static',
    'fluent-ffmpeg',
    'sharp',
    'protobufjs',
    'jszip',
  ],
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
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
