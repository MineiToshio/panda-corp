/**
 * Reviewer-authored adversarial suite for REQ-04-011 (FRD-04 gate, DR-015/DR-080).
 *
 * The relative label must be relative to the VIEWER's calendar day. Change cards are
 * stamped with the owner's LOCAL calendar date (e.g. the canario-d card was committed
 * 2026-09-24 21:48 -0500 with `date: 2026-09-24`), so "hoy"/"ayer" must hold at every
 * hour of the viewer's local day, in any timezone. The zone is pinned per describe so
 * the suite is deterministic on any runner.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatChangeDate } from "@/lib/changes/formatChangeDate";

const ORIGINAL_TZ = process.env.TZ;

function pinTimeZone(zone: string): void {
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });
}

function labelOf(date: string, now: Date): string {
  const result = formatChangeDate(date, now);
  if (!result.ok) throw new Error(`expected a label for ${date}, got error: ${result.error}`);
  return result.label;
}

describe("REQ-04-011 — day boundary follows the viewer's local calendar (America/Lima, UTC-5)", () => {
  pinTimeZone("America/Lima");

  it("a card stamped today reads 'hoy' in the evening (the canario-d card, 21:48 local)", () => {
    expect(labelOf("2026-09-24", new Date("2026-09-24T21:48:57-05:00"))).toBe("hoy");
  });

  it("a card stamped yesterday reads 'ayer' at 23:30 local, not 'hace 2 días'", () => {
    expect(labelOf("2026-09-23", new Date("2026-09-24T23:30:00-05:00"))).toBe("ayer");
  });

  it("holds at EVERY hour of the local day: today → hoy, yesterday → ayer, 7 days → hace 7 días", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const now = new Date(`2026-09-24T${String(hour).padStart(2, "0")}:30:00-05:00`);
      expect({ hour, label: labelOf("2026-09-24", now) }).toEqual({ hour, label: "hoy" });
      expect({ hour, label: labelOf("2026-09-23", now) }).toEqual({ hour, label: "ayer" });
      expect({ hour, label: labelOf("2026-09-17", now) }).toEqual({ hour, label: "hace 7 días" });
    }
  });

  it("a full ISO timestamp is bucketed by the viewer's local day of that instant", () => {
    // 2026-09-24T23:00Z is 18:00 local on the 24th; two hours later (20:00 local) it is 'hoy'.
    expect(labelOf("2026-09-24T23:00:00Z", new Date("2026-09-24T20:00:00-05:00"))).toBe("hoy");
  });
});

describe("REQ-04-011 — day boundary east of UTC (Europe/Madrid, incl. a DST change)", () => {
  pinTimeZone("Europe/Madrid");

  it("just after local midnight, the previous local day reads 'ayer', not 'hoy'", () => {
    expect(labelOf("2026-09-24", new Date("2026-09-25T00:30:00+02:00"))).toBe("ayer");
    expect(labelOf("2026-09-25", new Date("2026-09-25T00:30:00+02:00"))).toBe("hoy");
  });

  it("counts calendar days across the DST fall-back (2026-10-25)", () => {
    const now = new Date("2026-10-26T12:00:00+01:00");
    expect(labelOf("2026-10-25", now)).toBe("ayer");
    expect(labelOf("2026-10-24", now)).toBe("hace 2 días");
  });
});

describe("REQ-04-011 — bucket boundaries (limit)", () => {
  pinTimeZone("America/Lima");
  const NOW = new Date("2026-09-24T12:00:00-05:00");

  it("2 days is the first plural day label; 29 days is still days", () => {
    expect(labelOf("2026-09-22", NOW)).toBe("hace 2 días");
    expect(labelOf("2026-08-26", NOW)).toBe("hace 29 días");
  });

  it("30 days switches to months with the singular 'hace 1 mes'", () => {
    expect(labelOf("2026-08-25", NOW)).toBe("hace 1 mes");
  });

  it("never emits 'hace 0 meses' nor 'hace 1 días'/'hace 1 meses'/'hace 1 años'", () => {
    for (let back = 0; back < 900; back += 1) {
      const d = new Date(Date.UTC(2026, 8, 24 - back));
      const iso = d.toISOString().slice(0, 10);
      const label = labelOf(iso, NOW);
      expect(label).not.toMatch(/hace 0 /);
      expect(label).not.toMatch(/^hace 1 (días|meses|años)$/);
      expect(label).toMatch(/^(hoy|ayer|hace \d+ (días|mes|meses|año|años))$/);
      const n = Number(/^hace (\d+) /.exec(label)?.[1] ?? "NaN");
      if (/ (mes|año)$/.test(label)) expect({ label, n }).toEqual({ label, n: 1 });
      if (/ (meses|años)$/.test(label)) expect(n).toBeGreaterThan(1);
    }
  });

  it("plural agreement at clear multiples: 60 days → 'hace 2 meses', 730 days → 'hace 2 años'", () => {
    expect(labelOf("2026-07-26", NOW)).toBe("hace 2 meses");
    expect(labelOf("2024-09-24", NOW)).toBe("hace 2 años");
  });

  it("365 days reads 'hace 1 año'", () => {
    expect(labelOf("2025-09-24", NOW)).toBe("hace 1 año");
  });

  it("a future date (clock skew) never yields a negative age", () => {
    expect(labelOf("2026-09-30", NOW)).toBe("hoy");
  });

  it("ignores the ambient clock — only the injected now matters (pure)", () => {
    expect(labelOf("2026-09-23", NOW)).toBe("ayer");
    expect(labelOf("2026-09-23", new Date("2027-09-24T12:00:00-05:00"))).toBe("hace 1 año");
  });

  it("tolerates surrounding whitespace on a valid date", () => {
    expect(labelOf("  2026-09-23  ", NOW)).toBe("ayer");
  });
});

describe("REQ-04-011 — an unparseable date is an explicit error, never a fabricated age (DR-078)", () => {
  pinTimeZone("America/Lima");
  const NOW = new Date("2026-09-24T12:00:00-05:00");

  it.each([
    "N/A 3",
    "3",
    "2026-02-30",
    "2026-02-31",
    "2026-13-01",
    "TBD",
    "pronto",
  ])("%s → { ok: false } with a non-empty error", (raw) => {
    const result = formatChangeDate(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("whitespace-only is an error, not 'hoy'", () => {
    expect(formatChangeDate("   ", NOW).ok).toBe(false);
  });
});

describe("WO-04-008 exclusion — not shared with FRD-03's formatLastSync", () => {
  it("neither the formatter nor the card imports from src/lib/portfolio", () => {
    const sources = [
      "src/lib/changes/formatChangeDate.ts",
      "src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx",
    ].map((rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/from\s+["'][^"']*lib\/portfolio/);
      expect(source).not.toMatch(/formatLastSync/);
    }
  });
});
