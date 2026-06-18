/**
 * WO-12-001 — `topN` ADVERSARIAL tests (reviewer / DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT by the implementer. These probe
 * edges the existing topn.test.ts did not cover, derived from AC-12-004.1 and
 * the B1'/I3/FREEZE-ON-RED regression anchors in progress.md:
 *   - float n truncation (Math.trunc semantics, both directions)
 *   - -Infinity (distinct from finite-negative)
 *   - negative zero
 *   - very-near-zero positive float (0.9 → 0, NOT 1)
 *   - aliasing of object references is shallow (no deep clone surprise)
 *   - mutation-killing: result must be a DISTINCT array even when nothing is cut
 *
 * Mutation targets (DR-016): if a mutant flips `slice(0, cap)` to `slice(cap)`,
 * or drops Math.trunc, or returns `items` directly, at least one of these fails.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_TOPN, topN } from "./topn";

describe("frd-12 adversarial: topN — float n is truncated, not rounded", () => {
  it("WHEN n=2.9 THEN returns 2 items (trunc toward zero, NOT round to 3)", () => {
    expect(topN([1, 2, 3, 4, 5], 2.9)).toEqual([1, 2]);
  });

  it("WHEN n=0.9 THEN returns [] (trunc to 0, NOT 1)", () => {
    expect(topN([1, 2, 3], 0.9)).toEqual([]);
  });

  it("WHEN n=4.0001 THEN returns 4 items", () => {
    expect(topN([1, 2, 3, 4, 5, 6], 4.0001)).toHaveLength(4);
  });
});

describe("frd-12 adversarial: topN — non-finite negatives and signed zero", () => {
  it("WHEN n=-Infinity THEN returns [] (clamp to 0, no throw)", () => {
    expect(() => topN([1, 2, 3], Number.NEGATIVE_INFINITY)).not.toThrow();
    expect(topN([1, 2, 3], Number.NEGATIVE_INFINITY)).toEqual([]);
  });

  it("WHEN n=-0 THEN returns [] (negative zero is zero)", () => {
    expect(topN([1, 2, 3, 4, 5], -0)).toEqual([]);
  });

  it("WHEN n is a large negative float THEN returns [] (clamped)", () => {
    expect(topN([1, 2, 3], -3.7)).toEqual([]);
  });
});

describe("frd-12 adversarial: topN — DEFAULT_TOPN export is the contract value", () => {
  it("DEFAULT_TOPN is exactly 5 (IF-12-topn contract, docs/api.md)", () => {
    expect(DEFAULT_TOPN).toBe(5);
  });

  it("WHEN n=NaN THEN the fallback length equals DEFAULT_TOPN exactly", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(topN(items, Number.NaN)).toHaveLength(DEFAULT_TOPN);
  });
});

describe("frd-12 adversarial: topN — returns a distinct array even when nothing is cut", () => {
  it("WHEN n >= items.length THEN result is a NEW array, not the same reference", () => {
    const items = [1, 2, 3];
    const result = topN(items, 10);
    expect(result).toEqual(items);
    // Mutation guard: a mutant returning `items` directly would alias.
    expect(result).not.toBe(items);
    result.push(999);
    expect(items).toHaveLength(3);
  });

  it("WHEN object items are kept THEN references are preserved (shallow, no deep clone)", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const result = topN([a, b], 5);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });
});
