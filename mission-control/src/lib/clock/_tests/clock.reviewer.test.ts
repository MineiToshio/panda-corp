import { afterEach, expect, it, vi } from "vitest";
import { ClockConfigError, now } from "../clock";

/** Reviewer-authored (DR-080): REQ-01-008 clock boundaries the builder's suite does not reach. */
afterEach(() => vi.unstubAllEnvs());

it.each([
  ["2024-02-29T12:00:00Z", "2024-02-29T12:00:00.000Z"],
  ["2026-12-31T23:59:59.999Z", "2026-12-31T23:59:59.999Z"],
  ["2026-10-20T19:20:00-05:00", "2026-10-21T00:20:00.000Z"],
  ["2026-10-21T05:50:00+05:30", "2026-10-21T00:20:00.000Z"],
])("honours the valid instant %s", (value, expected) => {
  vi.stubEnv("MC_CLOCK", value);
  expect(now().toISOString()).toBe(expected);
});

it.each([
  "2026-02-29T00:00:00Z",
  "2026-13-01T00:00:00Z",
  "2026-00-10T00:00:00Z",
  "2026-10-00T00:00:00Z",
  "2026-04-31T00:00:00Z",
  "2026-10-21T25:00:00Z",
  "2026-10-21T00:60:00Z",
  "2026-10-21T00:20:00",
  " 2026-10-21T00:20:00Z",
  "1761006000",
  "now",
])("fails loud on %s instead of falling back to wall time", (value) => {
  vi.stubEnv("MC_CLOCK", value);
  expect(now).toThrow(ClockConfigError);
});

it("a caller mutating the returned Date cannot move the next read", () => {
  vi.stubEnv("MC_CLOCK", "2026-10-21T00:20:00.000Z");
  now().setUTCFullYear(1999);
  expect(now().toISOString()).toBe("2026-10-21T00:20:00.000Z");
});

it("the error names the variable and never echoes its value", () => {
  vi.stubEnv("MC_CLOCK", "owner-private-value");
  expect(now).toThrow(/^MC_CLOCK/);
  expect(now).not.toThrow(/owner-private-value/);
});
