import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mission Control is a local, read-only tool. No image optimization service,
  // no telemetry-sensitive features needed. Keep it minimal.
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
  // The factory repo lives one level up; Server Components read it from disk.
  // No special config required — `lib/config.ts` resolves the paths.
};

export default nextConfig;
