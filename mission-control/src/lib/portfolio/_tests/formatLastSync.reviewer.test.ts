/**
 * FRD-03 gate — reviewer-authored adversarial suite for `formatLastSync` (REQ-03-007, WO-03-006).
 *
 * Builder-blind (DR-080): written by the FRD gate, not the implementer. Anchored in the FRD's own
 * error clause ("an unparseable date SHALL be shown as an explicit invalid-date chip, never hidden
 * silently") and DR-078 (a reader never fabricates a value from an unrecognised shape).
 *
 * The trap this suite pins (LESSON-0009 follow-through): "compare via Date.parse" is right for the
 * COMPARISON, but `Date.parse` is not a validator — outside the ECMAScript date-time string format
 * V8 falls back to implementation-specific heuristics that happily turn prose into a date
 * (`Date.parse("foo 1")` → 2001-01-01, `Date.parse("2026-02-30")` → 2026-03-02,
 * `Date.parse("07/09/2026")` → July 9 in US order). A portfolio cell like that must surface as the
 * explicit invalid-date result, never as a fabricated "hace 25 años".
 *
 * Traceability:
 *   AC-03-007.1  bucket boundaries (edge-case / limit) — 29/30 days, 359/360 days, year rollover,
 *                leap day, singular/plural grammar, no degenerate labels.
 *   AC-03-007.2  fail-loud on unparseable input (error) — incl. V8-lenient garbage.
 */

import { describe, expect, it } from "vitest";

import { formatLastSync } from "../formatLastSync";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_LABEL =
  /^(hoy|ayer|hace ([2-9]|[12]\d) días|hace 1 mes|hace ([2-9]|1[01]) meses|hace 1 año|hace ([2-9]|[1-9]\d+) años)$/;

/** ISO date-only string `days` calendar days before NOW (UTC calendar, NOW is mid-day UTC). */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/** Unit weight so days < months < years when ranking a label by age. */
const UNIT_WEIGHT: Readonly<Record<string, number>> = {
  días: 1,
  mes: 100,
  meses: 100,
  año: 1000,
  años: 1000,
};

/** Orders a label by the age it claims ("hoy" youngest), for the monotonicity sweep. */
function ageRank(label: string): number {
  if (label === "hoy") return 0;
  if (label === "ayer") return 1;
  const match = label.match(/^hace (\d+) (días|mes|meses|año|años)$/);
  if (!match) throw new Error(`unexpected label ${label}`);
  return (UNIT_WEIGHT[match[2] ?? ""] ?? Number.NaN) + Number(match[1]);
}

function labelOf(date: string, now: Date = NOW): string {
  const result = formatLastSync(date, now);
  if (!result.ok) throw new Error(`expected ok for ${date}, got reason: ${result.reason}`);
  return result.label;
}

describe("formatLastSync — bucket boundaries (AC-03-007.1, edge-case/limit)", () => {
  it("day 1 is 'ayer' and day 2 is the first 'hace N días' (never 'hace 1 días')", () => {
    expect(labelOf(daysAgo(1))).toBe("ayer");
    expect(labelOf(daysAgo(2))).toBe("hace 2 días");
  });

  it("29 → 'hace 29 días', 30 → 'hace 1 mes' (the days/months edge, date-only input)", () => {
    expect(labelOf(daysAgo(29))).toBe("hace 29 días");
    expect(labelOf(daysAgo(30))).toBe("hace 1 mes");
  });

  it("59 → still 'hace 1 mes' (singular holds across the whole first-month bucket)", () => {
    expect(labelOf(daysAgo(59))).toBe("hace 1 mes");
    expect(labelOf(daysAgo(60))).toBe("hace 2 meses");
  });

  it("never renders 'hace 12 meses' or 'hace 0 años' at the months/years edge", () => {
    for (let d = 330; d <= 400; d++) {
      const label = labelOf(daysAgo(d));
      expect(label).not.toBe("hace 12 meses");
      expect(label).not.toMatch(/hace 0 /);
    }
  });

  it("years count completed years, never rounded up (395 days → 1 año, 800 days → 2 años)", () => {
    expect(labelOf(daysAgo(395))).toBe("hace 1 año");
    expect(labelOf(daysAgo(800))).toBe("hace 2 años");
  });

  it("a year-rollover yesterday (Dec 31 → Jan 1) is 'ayer', not a months/years label", () => {
    expect(labelOf("2026-12-31", new Date("2027-01-01T10:00:00.000Z"))).toBe("ayer");
  });

  it("a leap day is a valid calendar date (2028-02-29 seen on 2028-03-01 is 'ayer')", () => {
    expect(labelOf("2028-02-29", new Date("2028-03-01T10:00:00.000Z"))).toBe("ayer");
  });

  it("every label over a 4-year sweep is a well-formed Spanish bucket (no degenerate grammar)", () => {
    for (let d = 0; d <= 4 * 366; d++) {
      expect(labelOf(daysAgo(d))).toMatch(VALID_LABEL);
    }
  });

  it("labels are monotone in age — an older sync never reads as more recent", () => {
    let previous = -1;
    for (let d = 0; d <= 3 * 366; d++) {
      const current = ageRank(labelOf(daysAgo(d)));
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("uses the real clock when `now` is omitted (the component's call path)", () => {
    const result = formatLastSync(new Date().toISOString());
    expect(result).toEqual({ ok: true, label: "hoy" });
  });
});

describe("formatLastSync — fail-loud on non-dates V8 would silently accept (AC-03-007.2, error)", () => {
  // Each of these is NOT a date. V8's legacy Date.parse fallback turns every one of them into a
  // real timestamp (2000/2001 for the prose ones) — a correct implementation must report ok:false
  // so the row shows the explicit invalid-date chip instead of a fabricated age.
  const NON_DATES = ["foo 1", "N/A 3", "sync 5", "pendiente 2", "1", "0", "12"];

  for (const raw of NON_DATES) {
    it(`reports ${JSON.stringify(raw)} as invalid, never a fabricated relative age`, () => {
      const result = formatLastSync(raw, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    });
  }

  it("reports an impossible calendar day (2026-02-30) as invalid, not silently rolled to March", () => {
    expect(formatLastSync("2026-02-30", NOW).ok).toBe(false);
  });

  it("reports an impossible calendar day (2026-04-31) as invalid, not silently rolled to May", () => {
    expect(formatLastSync("2026-04-31", NOW).ok).toBe(false);
  });

  it("reports a non-leap Feb 29 (2027-02-29) as invalid", () => {
    expect(formatLastSync("2027-02-29", NOW).ok).toBe(false);
  });

  it("reports out-of-range ISO fields (month 00/13, day 00, hour 25, minute 60) as invalid", () => {
    for (const raw of [
      "2026-00-10",
      "2026-13-01",
      "2026-09-00",
      "2026-09-07T25:00:00Z",
      "2026-09-07T12:60:00Z",
    ]) {
      expect(formatLastSync(raw, NOW).ok).toBe(false);
    }
  });

  it("never reads a Spanish dd/mm/yyyy cell in US month-first order", () => {
    // "07/09/2026" in the Spanish portfolio is 7 September. Either reject it explicitly or read it
    // as 7 Sep ("hace 17 días") — reading it as 9 July ("hace 2 meses") is a silent wrong answer.
    const result = formatLastSync("07/09/2026", NOW);
    if (result.ok) expect(result.label).toBe("hace 17 días");
  });

  it("still reports the real portfolio's prose-in-the-date-cell row as invalid (production shape)", () => {
    const prose =
      "**Re-check 2026-09-21 (rutina programada):** SIN VEREDICTO NUEVO — precondición no cumplida";
    const result = formatLastSync(prose, NOW);
    expect(result.ok).toBe(false);
  });

  it("an explicit-offset timestamp stays a valid date (the strictness must not over-reject ISO)", () => {
    expect(formatLastSync("2026-09-22T08:30:00-05:00", NOW)).toEqual({
      ok: true,
      label: "hace 2 días",
    });
    expect(formatLastSync("2026-09-22T13:30:00.123Z", NOW)).toEqual({
      ok: true,
      label: "hace 2 días",
    });
  });
});
