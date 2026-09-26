import { describe, expect, it } from "vitest";
import { formatChangeDate } from "@/lib/changes/formatChangeDate";

/**
 * FRD-04 gate — reviewer-authored adversarial suite for REQ-04-011 / AC-04-011.1-2
 * (builder-blind, DR-080). Every `now` is built with the LOCAL-time Date
 * constructor, so each assertion states the owner's wall-clock calendar and holds
 * in ANY timezone: "hoy" means the same calendar day the owner is living, not the
 * same UTC day.
 */

function localNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("formatChangeDate — calendar day is the owner's local day (REQ-04-011)", () => {
  it("a change dated today still reads 'hoy' late in the owner's evening", () => {
    const lateEvening = new Date(2026, 8, 24, 23, 30, 0, 0);
    expect(formatChangeDate("2026-09-24", lateEvening)).toEqual({ ok: true, label: "hoy" });
    expect(formatChangeDate("2026-09-23", lateEvening)).toEqual({ ok: true, label: "ayer" });
  });

  it("a change dated yesterday reads 'ayer' just after the owner's midnight", () => {
    const justAfterMidnight = new Date(2026, 8, 25, 0, 30, 0, 0);
    expect(formatChangeDate("2026-09-25", justAfterMidnight)).toEqual({ ok: true, label: "hoy" });
    expect(formatChangeDate("2026-09-24", justAfterMidnight)).toEqual({
      ok: true,
      label: "ayer",
    });
  });

  it("the label for a given date is the same at every hour of the owner's day", () => {
    const labels = new Set<string>();
    for (let hour = 0; hour < 24; hour++) {
      const now = new Date(2026, 8, 24, hour, 15, 0, 0);
      const result = formatChangeDate("2026-09-20", now);
      labels.add(result.ok ? result.label : `error:${result.error}`);
    }
    expect([...labels]).toEqual(["hace 4 días"]);
  });
});

describe("formatChangeDate — unit boundaries and singulars (AC-04-011.1)", () => {
  const now = localNoon(2026, 8, 24);

  it("29 days is still counted in days", () => {
    expect(formatChangeDate("2026-08-26", now)).toEqual({ ok: true, label: "hace 29 días" });
  });

  it("2 days is 'hace 2 días' (the first plural day count, never 'hace 1 día')", () => {
    expect(formatChangeDate("2026-09-22", now)).toEqual({ ok: true, label: "hace 2 días" });
  });

  it("30 days is the singular 'hace 1 mes'", () => {
    expect(formatChangeDate("2026-08-25", now)).toEqual({ ok: true, label: "hace 1 mes" });
  });

  it("exactly one calendar year is the singular 'hace 1 año'", () => {
    expect(formatChangeDate("2025-09-24", now)).toEqual({ ok: true, label: "hace 1 año" });
  });

  it("two calendar years is the plural 'hace 2 años'", () => {
    expect(formatChangeDate("2024-09-24", now)).toEqual({ ok: true, label: "hace 2 años" });
  });

  it("never renders a negative age for a future-dated card (clock skew)", () => {
    const result = formatChangeDate("2026-09-27", now);
    if (result.ok) {
      expect(result.label).not.toMatch(/-/);
      expect(result.label.length).toBeGreaterThan(0);
    } else {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate the injected clock", () => {
    const clock = localNoon(2026, 8, 24);
    const before = clock.getTime();
    formatChangeDate("2026-01-01", clock);
    expect(clock.getTime()).toBe(before);
  });
});

describe("formatChangeDate — a non-date is unparseable, never a fabricated age (AC-04-011.2, DR-078)", () => {
  const now = localNoon(2026, 8, 24);

  // V8's legacy Date.parse fallback turns each of these into a real timestamp
  // (e.g. "pendiente 1" -> 2001-01-01), so a helper that trusts Date.parse alone
  // labels them "hace 25 años" and hides the raw value the owner actually wrote.
  it.each([
    "pendiente 1",
    "TBD 2",
    "1",
    "2026-02-30",
  ])("%j yields an explicit error result, not a relative label", (junk) => {
    const result = formatChangeDate(junk, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("whitespace-only input is an explicit error, never an empty label", () => {
    const result = formatChangeDate("   ", now);
    expect(result.ok).toBe(false);
  });
});
