import { afterEach, expect, it, vi } from "vitest";
import { ClockConfigError, now } from "../clock";

afterEach(() => vi.unstubAllEnvs());
it("REQ-01-008: reads the clock at call time and returns independent dates", () => {
  vi.stubEnv("MC_CLOCK", undefined);
  const before = Date.now();
  expect(now().getTime()).toBeGreaterThanOrEqual(before);
  vi.stubEnv("MC_CLOCK", "2026-10-21T00:20:00.000Z");
  expect(now().toISOString()).toBe("2026-10-21T00:20:00.000Z");
  expect(now()).not.toBe(now());
  for (const value of ["", "bad", "2026-02-30T00:00:00Z", "2026-10-21"]) {
    vi.stubEnv("MC_CLOCK", value);
    expect(now).toThrow(ClockConfigError);
  }
});
