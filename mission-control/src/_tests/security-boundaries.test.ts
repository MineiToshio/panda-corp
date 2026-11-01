import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { config, proxy } from "../proxy";

it.each([
  "evil.test",
  "localhost.evil.test",
  "192.168.1.2.evil.test",
  "10.999.0.1",
  "127.0.0.1@evil.test",
])("blocks rebinding host %s", (host) => {
  expect(
    proxy(new NextRequest("http://localhost:4917/api/live", { headers: { host } })).status,
  ).toBe(421);
});
it.each([
  "localhost:4917",
  "127.0.0.1:4917",
  "macbook-pro-de-sergio.local:1987",
  "192.168.1.55:1987",
  "10.1.2.3:4917",
])("allows local host %s", (host) => {
  expect(
    proxy(new NextRequest("http://localhost:4917/api/live", { headers: { host } })).status,
  ).toBe(200);
});
it("protects API paths and configures passive security headers", async () => {
  expect(config.matcher).toContain("/api/:path*");
  expect(nextConfig.poweredByHeader).toBe(false);
  const rules = await nextConfig.headers?.();
  const headers = rules?.find((rule) => rule.source === "/:path*")?.headers;
  expect(headers).toEqual(
    expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "Content-Security-Policy-Report-Only",
        value: expect.stringContaining("frame-ancestors 'none'"),
      },
      { key: "Permissions-Policy", value: expect.any(String) },
    ]),
  );
});
