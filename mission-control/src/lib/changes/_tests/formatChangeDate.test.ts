import { describe, expect, it } from "vitest";
import { formatChangeDate } from "../formatChangeDate";

const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("formatChangeDate", () => {
  it("returns 'hoy' for today's date", () => {
    const result = formatChangeDate("2026-09-24", NOW);
    expect(result).toEqual({ ok: true, label: "hoy" });
  });

  it("returns 'ayer' for yesterday's date", () => {
    const result = formatChangeDate("2026-09-23", NOW);
    expect(result).toEqual({ ok: true, label: "ayer" });
  });

  it("returns 'hace N días' for a date a few days ago", () => {
    const result = formatChangeDate("2026-09-19", NOW);
    expect(result).toEqual({ ok: true, label: "hace 5 días" });
  });

  it("returns 'hace 1 mes' (singular) at the one-month boundary", () => {
    const result = formatChangeDate("2026-08-25", NOW);
    expect(result).toEqual({ ok: true, label: "hace 1 mes" });
  });

  it("returns 'hace N meses' (plural) for several months ago", () => {
    const result = formatChangeDate("2026-06-20", NOW);
    expect(result).toEqual({ ok: true, label: "hace 3 meses" });
  });

  it("returns 'hace 1 año' (singular) just past the one-year boundary", () => {
    const result = formatChangeDate("2025-09-19", NOW);
    expect(result).toEqual({ ok: true, label: "hace 1 año" });
  });

  it("returns 'hace N años' (plural) for several years ago", () => {
    const result = formatChangeDate("2023-09-01", NOW);
    expect(result).toEqual({ ok: true, label: "hace 3 años" });
  });

  it("fails loud (explicit error result) on an unparseable date, never null/empty", () => {
    const result = formatChangeDate("not-a-date", NOW);
    expect(result.ok).toBe(false);
    expect(result).not.toBeNull();
    if (result.ok) throw new Error("expected ok: false");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("fails loud on an empty date string", () => {
    const result = formatChangeDate("", NOW);
    expect(result.ok).toBe(false);
  });

  it("is pure: the same inputs always produce the same result", () => {
    const a = formatChangeDate("2026-09-01", NOW);
    const b = formatChangeDate("2026-09-01", NOW);
    expect(a).toEqual(b);
  });
});
