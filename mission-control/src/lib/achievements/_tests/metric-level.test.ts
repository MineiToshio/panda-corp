/**
 * metricLevel — unbounded per-metric level for the Estadísticas tab (FRD-09 phase 3).
 */

import { describe, expect, it } from "vitest";
import { metricLevel } from "../achievements";

describe("metricLevel", () => {
  it("is 0 when the value is 0 or the stat is unknown", () => {
    expect(metricLevel("workorders", 0)).toBe(0);
    expect(metricLevel("does-not-exist", 999)).toBe(0);
  });

  it("counts the defined thresholds crossed (workorders = [10,50,200,500,1000])", () => {
    expect(metricLevel("workorders", 9)).toBe(0);
    expect(metricLevel("workorders", 10)).toBe(1);
    expect(metricLevel("workorders", 79)).toBe(2); // 10,50 crossed; 200 not
    expect(metricLevel("workorders", 500)).toBe(4); // 10,50,200,500; 1000 not
    expect(metricLevel("workorders", 1000)).toBe(5); // all five defined tiers
  });

  it("keeps climbing past the last defined threshold (≈1.6× milestones), never capped at 5", () => {
    // Beyond 1000 the milestones extend: 1600, 2560, …
    expect(metricLevel("workorders", 1700)).toBeGreaterThan(5);
    const huge = metricLevel("workorders", 1_000_000);
    expect(huge).toBeGreaterThan(10); // unbounded — well past the old 5-tier cap
  });

  it("is monotonic non-decreasing as the value grows", () => {
    let prev = 0;
    for (const v of [0, 10, 50, 100, 500, 1000, 5000, 50_000]) {
      const lvl = metricLevel("workorders", v);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });
});
