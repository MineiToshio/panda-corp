/**
 * FRD-04 gate — reviewer-authored adversarial suite for `formatChangeDate` (REQ-04-011, WO-04-008).
 *
 * Builder-blind (DR-080): written by the FRD gate, not the implementer. Anchored in the FRD's own
 * error clause ("an unparseable date SHALL be shown raw, never hidden") and DR-078 (a reader never
 * fabricates a value from an unrecognised shape), plus the same-day FRD-03 gate bug (`formatLastSync`):
 * `Date.parse` is not a validator — outside the ECMAScript date-time format V8 falls back to heuristics
 * that turn prose into a date (`"N/A 3"` → 2001-03-01) and roll impossible days over (`"2026-02-30"` →
 * 2026-03-02). Any of those must surface as the explicit `{ ok: false }` result, never a fabricated age.
 *
 * It also pins the viewer-calendar semantics of "hoy"/"ayer": a change card's `date` is a calendar day
 * (`YYYY-MM-DD`, written in the owner's local day), so "hoy" means the viewer's LOCAL today — a card
 * filed today must not read "ayer" in the evening of a UTC-5 owner (the owner runs America/Lima).
 *
 * Traceability:
 *   AC-04-011.1  bucket boundaries + singular/plural grammar (edge-case / limit)
 *   AC-04-011.2  fail-loud on unparseable input, incl. V8-lenient garbage (error)
 *   REQ-04-011   relative label measured against the viewer's local calendar day (requirement)
 *   WO-04-008    scope exclusion: no import from FRD-03's `src/lib/portfolio/**` (exclusion)
 */

import fs from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { formatChangeDate } from "../formatChangeDate";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_LABEL =
  /^(hoy|ayer|hace ([2-9]|[12]\d) días|hace 1 mes|hace ([2-9]|1[0-2]) meses|hace 1 año|hace ([2-9]|[1-9]\d+) años)$/;

/** ISO date-only string `days` calendar days before NOW (UTC calendar; the file pins TZ=UTC). */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/** Unit weight so days < months < years when ranking a label by the age it claims. */
const UNIT_WEIGHT: Readonly<Record<string, number>> = {
  días: 1,
  mes: 100,
  meses: 100,
  año: 1000,
  años: 1000,
};

function ageRank(label: string): number {
  if (label === "hoy") return 0;
  if (label === "ayer") return 1;
  const match = label.match(/^hace (\d+) (días|mes|meses|año|años)$/);
  if (!match) throw new Error(`unexpected label ${label}`);
  return (UNIT_WEIGHT[match[2] ?? ""] ?? Number.NaN) + Number(match[1]);
}

/**
 * Pin the process time zone for the whole file: UTC by default (so the bucket sweep is independent of
 * the machine running it), and a named zone inside the local-calendar block. Restored afterwards.
 */
let previousTz: string | undefined;

beforeAll(() => {
  previousTz = process.env.TZ;
  process.env.TZ = "UTC";
});

afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

function labelOf(date: string, now: Date = NOW): string {
  const result = formatChangeDate(date, now);
  if (!result.ok) throw new Error(`expected ok for ${date}, got error: ${result.error}`);
  return result.label;
}

describe("formatChangeDate — bucket boundaries (AC-04-011.1, edge-case/limit)", () => {
  it("day 1 is 'ayer' and day 2 is the first 'hace N días' (never 'hace 1 días')", () => {
    expect(labelOf(daysAgo(0))).toBe("hoy");
    expect(labelOf(daysAgo(1))).toBe("ayer");
    expect(labelOf(daysAgo(2))).toBe("hace 2 días");
  });

  it("29 → 'hace 29 días', 30 → 'hace 1 mes' (the days/months edge)", () => {
    expect(labelOf(daysAgo(29))).toBe("hace 29 días");
    expect(labelOf(daysAgo(30))).toBe("hace 1 mes");
  });

  it("365 → 'hace 1 año' (singular) and 730 → 'hace 2 años' (the months/years edge)", () => {
    expect(labelOf(daysAgo(365))).toBe("hace 1 año");
    expect(labelOf(daysAgo(730))).toBe("hace 2 años");
  });

  it("every day across ~6 years yields a grammatical label and the claimed age never goes backwards", () => {
    let previous = -1;
    for (let d = 0; d <= 2200; d++) {
      const label = labelOf(daysAgo(d));
      expect(label, `day ${d}`).toMatch(VALID_LABEL);
      const rank = ageRank(label);
      expect(rank, `day ${d} (${label})`).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it("a future date (clock skew between machines) never renders a negative or invalid age", () => {
    const label = labelOf("2026-10-30");
    expect(label).toMatch(VALID_LABEL);
    expect(label).not.toMatch(/-/);
  });

  it("accepts every ISO-8601 shape a producer may stamp (date-only, Z, fraction, offset, leap day)", () => {
    expect(labelOf("2026-09-23")).toBe("ayer");
    expect(labelOf("2026-09-23T10:00:00Z")).toBe("ayer");
    expect(labelOf("2026-09-23T10:00:00.123Z")).toBe("ayer");
    expect(labelOf("2026-09-23T10:00:00+00:00")).toBe("ayer");
    expect(labelOf("  2026-09-23  ")).toBe("ayer");
    expect(labelOf("2024-02-29", new Date("2024-03-01T12:00:00.000Z"))).toBe("ayer");
  });
});

describe("formatChangeDate — fail-loud on unparseable input (AC-04-011.2, REQ-04-011 error clause, DR-078)", () => {
  it.each([
    ["N/A 3"],
    ["pendiente 2"],
    ["TBD 1"],
    ["hace poco 2"],
    ["sep 24"],
    ["septiembre 2026"],
    ["07/09/2026"],
  ])("prose / non-ISO %j is an explicit error, never a fabricated age", (raw) => {
    const result = formatChangeDate(raw, NOW);
    expect(result, `formatChangeDate(${JSON.stringify(raw)})`).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it.each([
    ["2026-02-30"],
    ["2026-02-31"],
    ["2026-04-31"],
    ["2025-02-29"],
  ])("impossible calendar day %j is an explicit error (Date.parse would roll it over)", (raw) => {
    expect(formatChangeDate(raw, NOW), raw).toMatchObject({ ok: false });
  });

  it("whitespace-only input is an explicit error, never an empty label", () => {
    const result = formatChangeDate("   ", NOW);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("formatChangeDate — 'hoy'/'ayer' follow the viewer's LOCAL calendar day (REQ-04-011)", () => {
  afterEach(() => {
    process.env.TZ = "UTC";
  });

  it("UTC-5 owner (America/Lima) at 21:00 local: a change dated today is 'hoy', yesterday's is 'ayer'", () => {
    process.env.TZ = "America/Lima";
    const evening = new Date("2026-09-25T02:00:00.000Z"); // 2026-09-24 21:00 in Lima
    expect(evening.getDate()).toBe(24);
    expect(labelOf("2026-09-24", evening)).toBe("hoy");
    expect(labelOf("2026-09-23", evening)).toBe("ayer");
    expect(labelOf("2026-09-24T23:30:00-05:00", evening)).toBe("hoy");
  });

  it("UTC-5 owner in the morning agrees with the evening (the label does not flip at 19:00 local)", () => {
    process.env.TZ = "America/Lima";
    const morning = new Date("2026-09-24T12:00:00.000Z"); // 2026-09-24 07:00 in Lima
    expect(labelOf("2026-09-24", morning)).toBe("hoy");
    expect(labelOf("2026-09-23", morning)).toBe("ayer");
  });

  it("UTC+9 owner (Asia/Tokyo) at 08:30 local: yesterday's change is 'ayer', not 'hoy'", () => {
    process.env.TZ = "Asia/Tokyo";
    const morning = new Date("2026-09-23T23:30:00.000Z"); // 2026-09-24 08:30 in Tokyo
    expect(morning.getDate()).toBe(24);
    expect(labelOf("2026-09-24", morning)).toBe("hoy");
    expect(labelOf("2026-09-23", morning)).toBe("ayer");
  });
});

describe("formatChangeDate — scope exclusion (WO-04-008)", () => {
  it("stays disjoint from FRD-03's portfolio formatter (no import from src/lib/portfolio/**)", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/changes/formatChangeDate.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(
      /from ["'](@\/lib\/portfolio\/|\.\.\/portfolio\/|\.\.\/\.\.\/portfolio\/)/,
    );
  });
});
