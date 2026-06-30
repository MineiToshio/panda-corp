/**
 * RED → GREEN tests for IF-10-flow-series (`weeklyFlow`), WO-10-014, AC-10-014.1 / .7.
 *
 * The pure derivation `deriveWeeklyFlow` is driven with REAL-shape inputs (the parsed
 * "verified at" stamps per wo-*.md + idea `created` dates) AND malformed/absent inputs,
 * so the reader fails loud (explicit absent) on git-unavailable, never a silent [].
 */

import { describe, expect, it } from "vitest";
import { deriveWeeklyFlow, isoWeekKey } from "../flowSeries";

// ---------------------------------------------------------------------------
// Real-shape derivation — happy path
// ---------------------------------------------------------------------------

describe("deriveWeeklyFlow — real shape", () => {
  it("buckets WO-verified by ISO week, ideas by ISO week, and exposes peak + excluded count", () => {
    // 91 WO-verified commits: W25=78, W26=8, W27=5. Use representative dates in those weeks.
    const w25 = "2026-06-18T10:00:00Z"; // ISO week 25 (2026)
    const w26 = "2026-06-25T10:00:00Z"; // ISO week 26
    const w27 = "2026-07-02T10:00:00Z"; // ISO week 27
    const verifiedAt: string[] = [
      ...Array.from({ length: 78 }, () => w25),
      ...Array.from({ length: 8 }, () => w26),
      ...Array.from({ length: 5 }, () => w27),
    ];

    // Ideas: W24=3, W26=15; plus 2 cards with no `created` (excluded).
    const w24 = "2026-06-11T08:00:00Z"; // ISO week 24
    const ideasCreated: (string | null)[] = [
      ...Array.from({ length: 3 }, () => w24),
      ...Array.from({ length: 15 }, () => w26),
      null,
      null,
    ];

    const result = deriveWeeklyFlow({ verifiedAt, ideasCreated });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const flow = result.value;

    const wo = Object.fromEntries(flow.woVerified.map((b) => [b.isoWeek, b.count]));
    expect(wo[isoWeekKey(new Date(w25))]).toBe(78);
    expect(wo[isoWeekKey(new Date(w26))]).toBe(8);
    expect(wo[isoWeekKey(new Date(w27))]).toBe(5);
    expect(flow.woVerified.reduce((s, b) => s + b.count, 0)).toBe(91);

    const ideas = Object.fromEntries(flow.ideasCaptured.map((b) => [b.isoWeek, b.count]));
    expect(ideas[isoWeekKey(new Date(w24))]).toBe(3);
    expect(ideas[isoWeekKey(new Date(w26))]).toBe(15);

    expect(flow.peakWeek).toBe(78);
    expect(flow.ideasWithoutCreated).toBe(2);
  });

  it("buckets are sorted ascending by ISO week and the series is NOT constrained only-grow (a week may drop)", () => {
    const verifiedAt = [
      ...Array.from({ length: 5 }, () => "2026-06-18T10:00:00Z"), // W25 = 5
      ...Array.from({ length: 1 }, () => "2026-06-25T10:00:00Z"), // W26 = 1 (a drop)
      ...Array.from({ length: 9 }, () => "2026-07-02T10:00:00Z"), // W27 = 9
    ];
    const result = deriveWeeklyFlow({ verifiedAt, ideasCreated: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counts = result.value.woVerified.map((b) => b.count);
    expect(counts).toEqual([5, 1, 9]); // week 26 drops below week 25 — allowed
    const keys = result.value.woVerified.map((b) => b.isoWeek);
    expect([...keys].sort()).toEqual(keys); // ascending
  });

  it("a wo never crossed to VERIFIED (null stamp) contributes no week", () => {
    const result = deriveWeeklyFlow({
      verifiedAt: ["2026-06-18T10:00:00Z", null, null] as unknown as string[],
      ideasCreated: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.woVerified.reduce((s, b) => s + b.count, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fail-loud — malformed / absent (AC-10-014.7)
// ---------------------------------------------------------------------------

describe("deriveWeeklyFlow — fail-loud (DR-078)", () => {
  it("returns an explicit absent result when the git source is unavailable (null input)", () => {
    const result = deriveWeeklyFlow(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("git-unavailable");
  });

  it("an empty REAL source is a legitimate zero (ok:true), NOT an absent error", () => {
    const result = deriveWeeklyFlow({ verifiedAt: [], ideasCreated: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.woVerified).toEqual([]);
    expect(result.value.peakWeek).toBe(0);
    expect(result.value.ideasWithoutCreated).toBe(0);
  });

  it("an unparseable date stamp makes the reader fail loud, never silently dropped to zero", () => {
    const result = deriveWeeklyFlow({
      verifiedAt: ["not-a-date"],
      ideasCreated: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unparseable");
  });
});
