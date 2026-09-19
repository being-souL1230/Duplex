import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // The download route reads the extension/ folder from disk at request time;
  // include it in serverless output so the zip works on Vercel too.
  outputFileTracingIncludes: {
    "/api/extension/download": ["./extension/**/*"],
  },
};

export default nextConfig;
