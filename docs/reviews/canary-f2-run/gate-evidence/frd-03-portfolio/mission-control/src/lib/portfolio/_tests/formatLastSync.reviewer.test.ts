/**
 * FRD-03 gate (reviewer-authored, DR-080) — adversarial boundaries + fail-loud for
 * `formatLastSync` (REQ-03-007 limits and its invalid-date error clause).
 *
 * The bucket boundaries are computed from an injected `now` so every case sits on an exact
 * calendar-day distance. The fail-loud block covers strings V8's lenient `Date.parse` silently
 * turns into a real instant ("N/A 3" → 2001-03-01, "2026-02-30" → 2026-03-02): REQ-03-007 wants
 * an explicit invalid-date chip there, never a fabricated age (DR-078).
 */

import { describe, expect, it } from "vitest";
import { formatLastSync } from "@/lib/portfolio/formatLastSync";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-24T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * MS_PER_DAY).toISOString();
}

describe("formatLastSync — bucket boundaries (REQ-03-007 limit)", () => {
  it.each([
    [0, "hoy"],
    [1, "ayer"],
    [2, "hace 2 días"],
    [29, "hace 29 días"],
    [30, "hace 1 mes"],
    [59, "hace 1 mes"],
    [60, "hace 2 meses"],
    [359, "hace 11 meses"],
    [360, "hace 1 año"],
    [719, "hace 1 año"],
    [720, "hace 2 años"],
  ])("%i elapsed days → %s", (days, label) => {
    expect(formatLastSync(daysAgo(days), NOW)).toEqual({ ok: true, label });
  });

  it("buckets by calendar day, not by 24h: one ms across midnight is already 'ayer'", () => {
    const justAfterMidnight = new Date("2026-09-24T00:00:00.001Z");
    expect(formatLastSync("2026-09-23T23:59:59.999Z", justAfterMidnight)).toEqual({
      ok: true,
      label: "ayer",
    });
  });

  it("the very start of today is still 'hoy' at the very end of today", () => {
    const endOfDay = new Date("2026-09-24T23:59:59.999Z");
    expect(formatLastSync("2026-09-24T00:00:00.000Z", endOfDay)).toEqual({
      ok: true,
      label: "hoy",
    });
  });

  it("never emits the ungrammatical 'hace 1 días' / 'hace 1 meses' / 'hace 1 años'", () => {
    for (let d = 0; d <= 800; d += 1) {
      const result = formatLastSync(daysAgo(d), NOW);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.label).not.toMatch(/^hace 1 (días|meses|años)$/);
    }
  });
});

describe("formatLastSync — accepts the date shapes the portfolio actually carries", () => {
  it.each([
    ["2026-09-07", "hace 17 días"],
    ["2026-09-22 10:00", "hace 2 días"],
    ["2026-09-24T14:00:00+02:00", "hoy"],
    ["2026-09-24T03:00:00Z", "hoy"],
    ["2026-09-24T03:00:00.000Z", "hoy"],
  ])("%s → %s", (input, label) => {
    expect(formatLastSync(input, NOW)).toEqual({ ok: true, label });
  });
});

describe("formatLastSync — fails loud instead of fabricating an age (REQ-03-007 error clause)", () => {
  it.each([
    ["N/A 3"],
    ["3"],
    ["2026-02-30"],
  ])("%s is not a real sync date → explicit error result", (input) => {
    const result = formatLastSync(input, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it.each([
    ["not-a-date"],
    [""],
    ["   "],
    ["2026-13-01"],
    ["pendiente"],
  ])("%j → explicit error result", (input) => {
    expect(formatLastSync(input, NOW).ok).toBe(false);
  });
});
