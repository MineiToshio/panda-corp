/**
 * WO-03-006 — `formatLastSync` acceptance tests (RED phase).
 *
 * Traceability:
 *   AC-03-007.1  Relative Spanish label per elapsed-day bucket, correct singulars.
 *   AC-03-007.2  Unparseable input fails loud (explicit error result, never null/"").
 *
 * Stack: Vitest. Pure function — `now` injected for determinism (LESSON-0009: compare
 * via Date.parse, never lexicographic ISO string comparison).
 */

import { describe, expect, it } from "vitest";

import { formatLastSync } from "../formatLastSync";

const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("formatLastSync — relative labels (AC-03-007.1)", () => {
  it("returns 'hoy' for the same calendar day", () => {
    const result = formatLastSync("2026-09-24T03:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hoy" });
  });

  it("returns 'ayer' for the previous calendar day", () => {
    const result = formatLastSync("2026-09-23T23:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "ayer" });
  });

  it("returns 'hace N días' for 2 days", () => {
    const result = formatLastSync("2026-09-22T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 2 días" });
  });

  it("returns 'hace N días' for 29 days (upper bound of the days bucket)", () => {
    const result = formatLastSync("2026-08-26T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 29 días" });
  });

  it("returns 'hace 1 mes' (singular) at the 30-day boundary", () => {
    const result = formatLastSync("2026-08-25T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 1 mes" });
  });

  it("returns 'hace N meses' (plural) for 90 days", () => {
    const result = formatLastSync("2026-06-26T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 3 meses" });
  });

  it("returns 'hace N meses' just under the 12-month boundary", () => {
    const result = formatLastSync("2025-10-26T12:00:00.000Z", NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.label).toMatch(/^hace 11 meses$/);
  });

  it("returns 'hace 1 año' (singular) at the 12-month boundary", () => {
    const result = formatLastSync("2025-09-25T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 1 año" });
  });

  it("returns 'hace N años' (plural) beyond a year", () => {
    const result = formatLastSync("2023-09-24T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hace 3 años" });
  });

  it("treats a future date (clock skew) as 'hoy' rather than a negative/invalid label", () => {
    const result = formatLastSync("2026-09-25T12:00:00.000Z", NOW);
    expect(result).toEqual({ ok: true, label: "hoy" });
  });

  it("compares via Date.parse, not lexicographic string order — mixed offset/precision", () => {
    // Same instant as NOW, expressed with an explicit offset instead of Z + fractional seconds.
    // A lexicographic comparison of these two strings would NOT agree they are the same day.
    const result = formatLastSync("2026-09-24T14:00:00+02:00", NOW);
    expect(result).toEqual({ ok: true, label: "hoy" });
  });
});

describe("formatLastSync — fail-loud on unparseable input (AC-03-007.2)", () => {
  it("returns an explicit error result for garbage input, never null", () => {
    const result = formatLastSync("not-a-date", NOW);
    expect(result.ok).toBe(false);
    expect(result.ok || typeof result.reason).toBe("string");
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns an explicit error result for an empty string, never ''", () => {
    const result = formatLastSync("", NOW);
    expect(result).not.toBe(null);
    expect(result.ok).toBe(false);
  });

  it("the error result is never a bare null or empty string (type-level: always an object)", () => {
    const result = formatLastSync("also garbage: 99/99/9999", NOW);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });
});
