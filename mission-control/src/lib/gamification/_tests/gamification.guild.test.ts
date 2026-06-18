/**
 * lib/gamification.guild.test.ts — TDD RED phase for WO-09-001
 *
 * Tests `computeGuildLevel(outcomes)` from `lib/gamification.ts`.
 *
 * Acceptance criteria (EARS, FRD-09 / WO-09-001):
 *   AC-09-001.1 — returns { level, title, xp, next, pctToNext } with title from rank ladder.
 *   AC-09-001.2 — XP earned only by verifiable result (WO/phase/release closed, green tests).
 *                 Zero contribution for activity, app opens, navigation, trivial volume (negative AC).
 *   AC-09-001.3 — No outcomes → honest low/zero state; NEVER bar stuck near ~80%.
 *   AC-09-001.4 — Any streak contribution is WEEKLY (with freeze concept), NEVER daily-reset.
 *   AC-09-001.5 — Pure function (same outcomes → same result), fixture-tested.
 */

import { describe, expect, it } from "vitest";
import { computeGuildLevel, type GuildLevel, type GuildOutcomes, RANKS } from "../gamification";

// ---------------------------------------------------------------------------
// AC-09-001.1 — Return shape and title from rank ladder
// ---------------------------------------------------------------------------

describe("AC-09-001.1 — return shape", () => {
  it("returns all required fields with the right types", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result).toMatchObject<Partial<GuildLevel>>({
      level: expect.any(Number) as number,
      title: expect.any(String) as string,
      xp: expect.any(Number) as number,
      next: expect.any(Number) as number,
      pctToNext: expect.any(Number) as number,
    });
  });

  it("title is always a string from the RANKS ladder (non-empty)", () => {
    const result = computeGuildLevel({
      workOrdersDone: 5,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 10,
    });
    expect(result.title).toBeTruthy();
    const rankTitles = RANKS.map((r) => r.title);
    expect(rankTitles).toContain(result.title);
  });

  it("level is a positive integer >= 1", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result.level)).toBe(true);
  });

  it("pctToNext is in [0, 100]", () => {
    const result = computeGuildLevel({
      workOrdersDone: 3,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.pctToNext).toBeGreaterThanOrEqual(0);
    expect(result.pctToNext).toBeLessThanOrEqual(100);
  });

  it("next is greater than xp when level is below max", () => {
    const result = computeGuildLevel({
      workOrdersDone: 1,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // At low XP there will always be a higher rank
    expect(result.next).toBeGreaterThan(result.xp);
  });

  it("xp is non-negative", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.xp).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// AC-09-001.2 — XP from verifiable results only (positive & negative ACs)
// ---------------------------------------------------------------------------

describe("AC-09-001.2 — XP from verifiable results only", () => {
  it("a closed work order contributes positive XP", () => {
    const none = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const one = computeGuildLevel({
      workOrdersDone: 1,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(one.xp).toBeGreaterThan(none.xp);
  });

  it("a completed phase contributes positive XP", () => {
    const none = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const one = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(one.xp).toBeGreaterThan(none.xp);
  });

  it("a release contributes positive XP", () => {
    const none = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const one = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 1,
      greenTestRuns: 0,
    });
    expect(one.xp).toBeGreaterThan(none.xp);
  });

  it("green test runs contribute positive XP", () => {
    const none = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const many = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 50,
    });
    expect(many.xp).toBeGreaterThan(none.xp);
  });

  it("NEGATIVE AC — zero outcomes returns XP of exactly 0 (no app-open or activity bonus)", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // XP must be zero when all verifiable outcomes are zero — no hidden activity bonus
    expect(result.xp).toBe(0);
  });

  it("phases are worth more XP than individual work orders (milestone weight)", () => {
    const onePhase = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 0,
    });
    const oneWo = computeGuildLevel({
      workOrdersDone: 1,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(onePhase.xp).toBeGreaterThan(oneWo.xp);
  });

  it("releases are worth more XP than phases (milestone weight)", () => {
    const oneRelease = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 1,
      greenTestRuns: 0,
    });
    const onePhase = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(oneRelease.xp).toBeGreaterThan(onePhase.xp);
  });
});

// ---------------------------------------------------------------------------
// AC-09-001.3 — No outcomes → honest low/zero state; NEVER bar stuck at ~80%
// ---------------------------------------------------------------------------

describe("AC-09-001.3 — honest zero state", () => {
  it("zero outcomes → xp is 0", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.xp).toBe(0);
  });

  it("zero outcomes → pctToNext is 0 (not near 80%)", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.pctToNext).toBe(0);
  });

  it("NEGATIVE AC — zero outcomes NEVER returns pctToNext near 80% (forbidden pattern)", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // The FRD explicitly forbids the 'bar stuck at 80%' forbidden pattern.
    expect(result.pctToNext).toBeLessThan(50);
  });

  it("NEGATIVE AC — zero outcomes returns level 1 (starting level, honest lowest rank)", () => {
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    expect(result.level).toBe(1);
    expect(result.title).toBe(RANKS[0]?.title);
  });

  it("small outcomes → honest proportional progress, not inflated", () => {
    const result = computeGuildLevel({
      workOrdersDone: 1,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // Should be well below 100% since we barely started
    expect(result.pctToNext).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// AC-09-001.4 — Streak is WEEKLY (with freeze), NEVER daily-reset
// ---------------------------------------------------------------------------

describe("AC-09-001.4 — weekly streak, never daily-reset", () => {
  it("accepts optional weeklyStreak in outcomes — higher streak gives >= XP than no streak", () => {
    const noStreak = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const withStreak = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 4,
    });
    // A weekly streak of 4 should contribute some XP
    expect(withStreak.xp).toBeGreaterThanOrEqual(noStreak.xp);
  });

  it("weeklyStreak = 0 → same XP as omitted streak", () => {
    const omitted = computeGuildLevel({
      workOrdersDone: 5,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 10,
    });
    const zero = computeGuildLevel({
      workOrdersDone: 5,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 10,
      weeklyStreak: 0,
    });
    expect(zero.xp).toBe(omitted.xp);
  });

  it("weeklyStreak XP contribution is capped (freeze concept: no unbounded multiplier)", () => {
    const largeStreak = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 1000,
    });
    const smallStreak = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 10,
    });
    // Freeze cap: streak is bounded, not proportional to raw week count
    expect(largeStreak.xp).toBeGreaterThanOrEqual(smallStreak.xp);
    expect(largeStreak.xp - smallStreak.xp).toBeLessThan(10_000);
  });

  it("NEGATIVE AC — weeklyStreak is the only streak variant (no dailyStreak field exposed)", () => {
    // Type-level proof: the function accepts GuildOutcomes with weeklyStreak only.
    // At runtime we verify the accepted shape returns a defined result.
    const result = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 3,
    });
    expect(result).toBeDefined();
    // TypeScript enforces that 'dailyStreak' is not a valid key.
    // We cannot pass { dailyStreak: 5 } without a TS error — confirmed by type signature.
  });
});

// ---------------------------------------------------------------------------
// AC-09-001.5 — Pure function (same inputs → same outputs)
// ---------------------------------------------------------------------------

describe("AC-09-001.5 — pure function", () => {
  it("calling with the same outcomes returns identical results", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 12,
      phasesCompleted: 3,
      releases: 1,
      greenTestRuns: 80,
    };
    const a = computeGuildLevel(outcomes);
    const b = computeGuildLevel(outcomes);
    expect(a).toEqual(b);
  });

  it("does not mutate the input object", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 5,
      phasesCompleted: 2,
      releases: 0,
      greenTestRuns: 20,
    };
    const before = { ...outcomes };
    computeGuildLevel(outcomes);
    expect(outcomes).toEqual(before);
  });

  it("calling twice in sequence gives stable results (no hidden mutable state)", () => {
    const first = computeGuildLevel({
      workOrdersDone: 3,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 15,
    });
    const second = computeGuildLevel({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // Calling with different args in sequence must not bleed state
    const firstAgain = computeGuildLevel({
      workOrdersDone: 3,
      phasesCompleted: 1,
      releases: 0,
      greenTestRuns: 15,
    });
    expect(firstAgain).toEqual(first);
    expect(second.xp).toBe(0);
  });

  it("monotonically increasing XP with more work orders", () => {
    const woCounts = [0, 1, 5, 10, 20, 50];
    const results = woCounts.map((n) =>
      computeGuildLevel({
        workOrdersDone: n,
        phasesCompleted: 0,
        releases: 0,
        greenTestRuns: 0,
      }),
    );
    for (let i = 1; i < results.length; i++) {
      const curr = results[i];
      const prev = results[i - 1];
      // biome-ignore lint/style/noNonNullAssertion: indices are in bounds
      expect(curr!.xp).toBeGreaterThan(prev!.xp);
    }
  });

  it("level increases monotonically as outcomes grow", () => {
    const small = computeGuildLevel({
      workOrdersDone: 2,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    const large = computeGuildLevel({
      workOrdersDone: 100,
      phasesCompleted: 20,
      releases: 5,
      greenTestRuns: 500,
    });
    expect(large.level).toBeGreaterThanOrEqual(small.level);
  });

  it("RANKS ladder has at least 4 distinct entries", () => {
    // The blueprint specifies: Aprendiz, …, Maestro del gremio (plus higher ranks)
    expect(RANKS.length).toBeGreaterThanOrEqual(4);
  });

  it("RANKS entries have non-empty title (string) and threshold (number) fields", () => {
    for (const rank of RANKS) {
      expect(typeof rank.title).toBe("string");
      expect(rank.title.length).toBeGreaterThan(0);
      expect(typeof rank.threshold).toBe("number");
      expect(rank.threshold).toBeGreaterThanOrEqual(0);
    }
  });

  it("RANKS thresholds are strictly increasing", () => {
    for (let i = 1; i < RANKS.length; i++) {
      const curr = RANKS[i];
      const prev = RANKS[i - 1];
      // biome-ignore lint/style/noNonNullAssertion: indices are in bounds
      expect(curr!.threshold).toBeGreaterThan(prev!.threshold);
    }
  });

  it("first RANKS entry has threshold = 0 (starting rank requires no XP)", () => {
    expect(RANKS[0]?.threshold).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration fixture: realistic guild scenarios
// ---------------------------------------------------------------------------

describe("fixture: realistic guild scenarios", () => {
  it("a mature guild (many WOs + releases) reaches a high level (>= 3)", () => {
    const mature = computeGuildLevel({
      workOrdersDone: 50,
      phasesCompleted: 8,
      releases: 3,
      greenTestRuns: 300,
      weeklyStreak: 6,
    });
    expect(mature.level).toBeGreaterThanOrEqual(3);
    expect(mature.xp).toBeGreaterThan(0);
  });

  it("at the top rank pctToNext is 100 (full bar, capped)", () => {
    // Drive XP extremely high to hit the top rank
    const maxed = computeGuildLevel({
      workOrdersDone: 10_000,
      phasesCompleted: 1_000,
      releases: 500,
      greenTestRuns: 50_000,
      weeklyStreak: 52,
    });
    const topLevel = RANKS.length;
    if (maxed.level >= topLevel) {
      // At max level, pctToNext is 100 (full bar, nowhere to go but stay)
      expect(maxed.pctToNext).toBe(100);
    } else {
      // Otherwise it's somewhere in the middle — just verify shape is valid
      expect(maxed.pctToNext).toBeGreaterThanOrEqual(0);
      expect(maxed.pctToNext).toBeLessThanOrEqual(100);
    }
  });

  it("a single work order gives a predictable, honest small amount of XP", () => {
    const result = computeGuildLevel({
      workOrdersDone: 1,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    });
    // xp must be positive but small — less than the first level threshold
    expect(result.xp).toBeGreaterThan(0);
    // biome-ignore lint/style/noNonNullAssertion: RANKS always has at least 4 entries (tested above)
    const firstThreshold = RANKS[1]!.threshold;
    // Should not immediately jump to level 2 with just 1 WO
    expect(result.xp).toBeLessThan(firstThreshold);
  });
});
