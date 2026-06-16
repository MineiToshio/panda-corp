import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mission Control is a local, read-only tool. No image optimization service,
  // no telemetry-sensitive features needed. Keep it minimal.
  reactStrictMode: true,
  // The factory repo lives one level up; Server Components read it from disk.
  // No special config required — `lib/config.ts` resolves the paths.
};

export default nextConfig;
