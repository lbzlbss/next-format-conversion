import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "https://nextformat.aiblank.top",
    "http://localhost:3000",
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
