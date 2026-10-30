import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { oracleEnv } from "../oracleEnv";

afterEach(() => vi.unstubAllEnvs());
it("REQ-01-008, REQ-01-011: isolates all paths from owner state and permits a diagnostic clock", () => {
  vi.stubEnv("MC_CLOCK", undefined);
  const env = oracleEnv("/checkout");
  expect(env.MC_CLOCK).toBe("2026-10-21T00:20:00.000Z");
  expect(env.NEXT_TELEMETRY_DISABLED).toBe("1");
  for (const [key, value] of Object.entries(env)) {
    if (["MC_CLOCK", "NEXT_TELEMETRY_DISABLED"].includes(key)) continue;
    expect(path.isAbsolute(value)).toBe(true);
    expect(
      value === "/checkout/docs/design/prototype/fixtures" ||
        value.startsWith("/checkout/docs/design/prototype/fixtures/"),
    ).toBe(true);
  }
  vi.stubEnv("MC_CLOCK", "2026-10-22T00:00:00Z");
  expect(oracleEnv(".").MC_CLOCK).toBe("2026-10-22T00:00:00Z");
});
