/**
 * FRD-03 gate — reviewer-authored adversarial suite for `formatLastSync` (REQ-03-007,
 * AC-03-007.1 / AC-03-007.2). Builder-blind (DR-080, constitution §22).
 *
 * What the builder's suite never exercised:
 *   - the PRODUCTION cell shape: the factory portfolio's `Última sync` column holds a date-only
 *     calendar date ("2026-09-25"), stamped with the owner's local date;
 *   - the owner's real wall clock: Mission Control runs on the owner's machine (America/Lima,
 *     UTC-5) and the owner works evenings — between 19:00 and 24:00 local the UTC date has
 *     already rolled over, so a UTC-day diff says "ayer" for a sync stamped today;
 *   - calendar-invalid dates that V8's lenient `Date.parse` silently rolls over
 *     ("2026-02-30" → 2 March) instead of failing loud;
 *   - a whole-range sweep pinning the label grammar and bucket monotonicity.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatLastSync } from "@/lib/portfolio/formatLastSync";

const OWNER_TZ = "America/Lima";
const ORIGINAL_TZ = process.env.TZ;
const MS_PER_DAY = 86_400_000;

beforeAll(() => {
  process.env.TZ = OWNER_TZ;
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) Reflect.deleteProperty(process.env, "TZ");
  else process.env.TZ = ORIGINAL_TZ;
});

/** Date-only calendar string `n` days before 2026-09-25 (pure calendar arithmetic). */
function dateOnlyDaysBefore(n: number): string {
  return new Date(Date.UTC(2026, 8, 25) - n * MS_PER_DAY).toISOString().slice(0, 10);
}

function labelOf(date: string, now: Date): string {
  const result = formatLastSync(date, now);
  if (!result.ok) throw new Error(`expected ok for ${date}, got: ${result.reason}`);
  return result.label;
}

describe("premise — the owner timezone is in effect for this suite", () => {
  it("resolves 23:26 local on 2026-09-25 to calendar day 25 at UTC-5", () => {
    const eveningLocal = new Date("2026-09-25T23:26:00-05:00");
    expect(eveningLocal.getDate()).toBe(25);
    expect(eveningLocal.getTimezoneOffset()).toBe(300);
    expect(eveningLocal.getUTCDate()).toBe(26);
  });
});

describe("AC-03-007.1 — 'hoy'/'ayer' follow the owner's calendar day for the production date-only cell", () => {
  it("a sync stamped today reads 'hoy' at 23:26 local (UTC date already rolled over)", () => {
    expect(formatLastSync("2026-09-25", new Date("2026-09-25T23:26:00-05:00"))).toEqual({
      ok: true,
      label: "hoy",
    });
  });

  it("a sync stamped yesterday reads 'ayer' at 21:00 local, not 'hace 2 días'", () => {
    expect(formatLastSync("2026-09-24", new Date("2026-09-25T21:00:00-05:00"))).toEqual({
      ok: true,
      label: "ayer",
    });
  });

  it("a sync stamped today reads 'hoy' just after local midnight", () => {
    expect(labelOf("2026-09-25", new Date("2026-09-25T00:30:00-05:00"))).toBe("hoy");
  });

  it("a sync stamped yesterday reads 'ayer' just after local midnight", () => {
    expect(labelOf("2026-09-24", new Date("2026-09-25T00:05:00-05:00"))).toBe("ayer");
  });

  it("a sync stamped today still reads 'hoy' at 23:59 local", () => {
    expect(labelOf("2026-09-25", new Date("2026-09-25T23:59:00-05:00"))).toBe("hoy");
  });

  it("a full timestamp is judged by the owner's calendar day: 22:00 last night reads 'ayer' next morning", () => {
    expect(labelOf("2026-09-24T22:00:00-05:00", new Date("2026-09-25T10:00:00-05:00"))).toBe(
      "ayer",
    );
  });

  it("a full timestamp from earlier this evening reads 'hoy'", () => {
    expect(labelOf("2026-09-25T20:00:00-05:00", new Date("2026-09-25T23:30:00-05:00"))).toBe("hoy");
  });

  it("the day buckets stay stable across the evening window (2 days reads 'hace 2 días' at 22:00)", () => {
    expect(labelOf("2026-09-23", new Date("2026-09-25T22:00:00-05:00"))).toBe("hace 2 días");
  });
});

describe("AC-03-007.1 — bucket boundaries on date-only cells (midday local)", () => {
  const NOON = new Date("2026-09-25T12:00:00-05:00");

  it.each([
    [0, "hoy"],
    [1, "ayer"],
    [2, "hace 2 días"],
    [29, "hace 29 días"],
    [30, "hace 1 mes"],
    [45, "hace 1 mes"],
    [75, "hace 2 meses"],
    [400, "hace 1 año"],
    [700, "hace 1 año"],
    [800, "hace 2 años"],
  ])("%i days ago → %s", (days, expected) => {
    expect(labelOf(dateOnlyDaysBefore(days), NOON)).toBe(expected);
  });
});

describe("AC-03-007.1 — label grammar + monotonic buckets over a 4-year sweep", () => {
  const NOON = new Date("2026-09-25T12:00:00-05:00");
  const GRAMMAR =
    /^(hoy|ayer|hace ([2-9]|1\d|2\d) días|hace 1 mes|hace ([2-9]|1[01]) meses|hace 1 año|hace ([2-9]|[1-9]\d+) años)$/;

  function rank(label: string): number {
    if (label === "hoy") return 0;
    if (label === "ayer") return 1;
    const [, n, unit] = /^hace (\d+) (\S+)$/.exec(label) ?? [];
    const unitWeight: Record<string, number> = {
      días: 10,
      mes: 1_000,
      meses: 1_000,
      año: 100_000,
      años: 100_000,
    };
    return (unitWeight[unit ?? ""] ?? Number.NaN) * Number(n);
  }

  it("every elapsed day 0..1460 yields a grammatical label that never goes backwards", () => {
    let previous = -1;
    for (let days = 0; days <= 1460; days += 1) {
      const label = labelOf(dateOnlyDaysBefore(days), NOON);
      expect(label, `day ${days}`).toMatch(GRAMMAR);
      const current = rank(label);
      expect(current, `day ${days} (${label})`).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("never says 'hace 12 meses' — twelve months or more is expressed in years", () => {
    for (let days = 300; days <= 420; days += 1) {
      expect(labelOf(dateOnlyDaysBefore(days), NOON)).not.toBe("hace 12 meses");
    }
  });
});

describe("AC-03-007.2 / REQ-03-007 — unparseable or calendar-invalid dates fail loud, never hidden", () => {
  const NOW = new Date("2026-09-25T12:00:00-05:00");

  it.each([
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "25/09/2026",
    "pendiente",
    "n/a",
  ])("'%s' → explicit { ok: false, reason } with a non-empty reason", (raw) => {
    const result = formatLastSync(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.trim().length).toBeGreaterThan(0);
  });

  it("a valid leap day is NOT rejected (2024-02-29)", () => {
    expect(formatLastSync("2024-02-29", NOW).ok).toBe(true);
  });
});
