/**
 * RED → GREEN tests for the verdict + next-actions rule functions, WO-10-014, AC-10-014.6.
 *
 * Pure deterministic functions over the wired aggregates — same inputs → same output.
 * `nextActions` items each carry their command. No fabricated sentence/suggestion.
 */

import { describe, expect, it } from "vitest";
import type { ReportMetrics } from "../verdict";
import { factoryVerdict, nextActions } from "../verdict";

const BASE: ReportMetrics = {
  launched: 0,
  wip: 0,
  conversionPct: 0,
  discardsWithoutReason: 0,
  lessonCaptured: 0,
  lessonDistilled: 0,
  peakWeek: 0,
};

describe("factoryVerdict — pure & deterministic", () => {
  it("returns the same verdict for the same input (determinism)", () => {
    const m: ReportMetrics = { ...BASE, launched: 1, wip: 1, conversionPct: 6 };
    expect(factoryVerdict(m)).toBe(factoryVerdict(m));
  });

  it("a different input yields a different (or same-by-rule) but deterministic verdict string", () => {
    const a = factoryVerdict({ ...BASE, launched: 0, wip: 0 });
    const b = factoryVerdict({ ...BASE, launched: 5, wip: 2 });
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });
});

describe("nextActions — pure & deterministic, each carries its command", () => {
  it("each action carries one of the known commands", () => {
    const actions = nextActions({
      ...BASE,
      lessonCaptured: 131,
      lessonDistilled: 2,
      launched: 1,
      wip: 1,
      discardsWithoutReason: 6,
    });
    expect(actions.length).toBeGreaterThan(0);
    const known = new Set(["/pandacorp:memory", "/pandacorp:release", "/pandacorp:recommend"]);
    for (const a of actions) {
      expect(typeof a.label).toBe("string");
      expect(a.label.length).toBeGreaterThan(0);
      expect(known.has(a.command)).toBe(true);
    }
  });

  it("is deterministic — same metrics produce the identical action list", () => {
    const m: ReportMetrics = { ...BASE, lessonCaptured: 131, lessonDistilled: 2, wip: 1 };
    expect(nextActions(m)).toEqual(nextActions(m));
  });

  it("a large capture backlog with few distilled suggests /pandacorp:memory", () => {
    const actions = nextActions({ ...BASE, lessonCaptured: 100, lessonDistilled: 1 });
    expect(actions.some((a) => a.command === "/pandacorp:memory")).toBe(true);
  });

  it("active WIP suggests /pandacorp:release", () => {
    const actions = nextActions({ ...BASE, wip: 1 });
    expect(actions.some((a) => a.command === "/pandacorp:release")).toBe(true);
  });
});
