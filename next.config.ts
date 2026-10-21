import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.6"],
  ...(process.env.AUTOKAS_MOBILE_BUILD === "true"
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        ...(process.env.AUTOKAS_TURBOPACK_ROOT
          ? { turbopack: { root: process.env.AUTOKAS_TURBOPACK_ROOT } }
          : {}),
      }
    : {}),
};

export default nextConfig;
