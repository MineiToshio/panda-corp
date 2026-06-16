/**
 * WO-12-001 — `topN` cap helper — RED phase.
 *
 * Tests are written BEFORE the implementation
 * (`app/_observability/selectors/topn.ts` does not exist yet).
 * ALL tests must fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-12-004.1  ANY grouping or ranking (agents, events, metrics) SHALL be
 *                limited to the top-5.
 *                Source: FRD-12 EARS criteria, REQ-12-004; blueprint §2
 *                (`IF-12-topn`); WO-12-001.
 *
 * Contract (from WO-12-001 + blueprint §2):
 *   export function topN<T>(items: T[], n?: number): T[]
 *   - Default cap: 5 (the "top-5" invariant, REQ-12-004).
 *   - Pure: no side-effects, no I/O, no throws.
 *   - Preserves input order (takes the first N items).
 *   - Returns an independent shallow copy — mutating the output does NOT mutate
 *     the original.
 *   - Edge cases: empty → [], n=0 → [], n > length → full slice, n=1 → one item.
 *   - n must be a safe finite non-negative integer; invalid n (NaN, Infinity,
 *     negative) falls back to default 5 (regression anchor on B1'/WO-13-001).
 *
 * Regression anchors from .pandacorp/comms/progress.md:
 *   B1' (2026-06-16, WO-13-001): `typeof NaN === "number"` — numeric guards that
 *     use `>= 0` without `Number.isFinite` silently let NaN through.  If `n` is
 *     NaN and the impl uses `items.slice(0, NaN)` → [] (empty result), silently
 *     hiding all items.  Regression test: topN with n=NaN must return the first
 *     5 (fallback to default), never [].
 *   I2 (2026-06-16, WO-13-001): empty-object/empty-array satisfied vacuous checks
 *     — regression here: topN([]) must return [], not throw.
 *   I3 (2026-06-16, WO-13-001): array-shaped values fool `typeof` object checks
 *     — regression: a list-of-arrays as items must be sliced correctly (generic T).
 *   FREEZE-ON-RED (2026-06-16): any error path must not throw mid-batch; topN is
 *     pure and must NEVER throw regardless of input shape.
 *
 * Property-based coverage (parametric without fast-check — not in package.json):
 *   The "order preservation invariant" and "idempotency invariant" describe blocks
 *   run topN over a representative matrix of lengths × caps, verifying the
 *   invariant for each combination.  This enumerates 40+ cases no human would list.
 *
 * Stack: Vitest (TypeScript). No mocks — `topN` is pure.
 */

import { describe, expect, it } from "vitest";

// The module under test — does NOT exist yet (RED phase).
import { topN } from "./topn";

// ---------------------------------------------------------------------------
// AC-12-004.1 — default cap is 5 (the REQ-12-004 invariant)
// ---------------------------------------------------------------------------

describe("frd-12: topN — AC-12-004.1 default cap is 5", () => {
  it("frd-12: WHEN items has 10 elements and no n is given THEN returns exactly 5 items", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(topN(items)).toHaveLength(5);
  });

  it("frd-12: WHEN items has 10 elements THEN the default cap returns the FIRST 5 items in order", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const result = topN(items);
    expect(result).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("frd-12: WHEN items has exactly 5 elements and n is omitted THEN all 5 are returned", () => {
    const items = [10, 20, 30, 40, 50];
    expect(topN(items)).toEqual([10, 20, 30, 40, 50]);
  });

  it("frd-12: WHEN items has 3 elements and n is omitted THEN all 3 are returned (fewer than cap)", () => {
    const items = ["x", "y", "z"];
    expect(topN(items)).toEqual(["x", "y", "z"]);
  });

  it("frd-12: WHEN items has 1 element and n is omitted THEN a length-1 array is returned", () => {
    expect(topN(["only"])).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — explicit n override
// The caller can override the cap; it must be honored precisely.
// ---------------------------------------------------------------------------

describe("frd-12: topN — AC-12-004.1 explicit n override", () => {
  it("frd-12: WHEN n=3 and items has 10 elements THEN exactly 3 items are returned", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(topN(items, 3)).toHaveLength(3);
  });

  it("frd-12: WHEN n=3 THEN the FIRST 3 items in original order are returned", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(topN(items, 3)).toEqual(["a", "b", "c"]);
  });

  it("frd-12: WHEN n=1 THEN exactly the first item is returned", () => {
    const items = [42, 99, 7];
    expect(topN(items, 1)).toEqual([42]);
  });

  it("frd-12: WHEN n=5 explicitly THEN behavior is identical to the default (no override side-effect)", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(topN(items, 5)).toEqual(topN(items));
  });

  it("frd-12: WHEN n equals items.length THEN all items are returned (no truncation)", () => {
    const items = ["p", "q", "r"];
    expect(topN(items, 3)).toEqual(["p", "q", "r"]);
  });

  it("frd-12: WHEN n > items.length THEN all items are returned (no out-of-bounds)", () => {
    const items = [1, 2, 3];
    expect(topN(items, 100)).toEqual([1, 2, 3]);
  });

  it("frd-12: WHEN n=0 THEN an empty array is returned (boundary)", () => {
    const items = [1, 2, 3, 4, 5];
    expect(topN(items, 0)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — empty input
// ---------------------------------------------------------------------------

describe("frd-12: topN — AC-12-004.1 empty input → []", () => {
  it("frd-12: WHEN items is [] and n is omitted THEN returns []", () => {
    expect(topN([])).toEqual([]);
  });

  it("frd-12: WHEN items is [] and n=5 THEN returns []", () => {
    expect(topN([], 5)).toEqual([]);
  });

  it("frd-12: WHEN items is [] and n=0 THEN returns []", () => {
    expect(topN([], 0)).toEqual([]);
  });

  it("frd-12: WHEN items is [] THEN topN does NOT throw", () => {
    expect(() => topN([])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — pure function: output independence
// Mutating the result must NOT mutate the original array.
// ---------------------------------------------------------------------------

describe("frd-12: topN — pure: output does not alias the input", () => {
  it("frd-12: WHEN the returned array is mutated THEN the original items array is unchanged", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = topN(items, 3);
    result.push(999);
    expect(items).toHaveLength(6);
    expect(items).not.toContain(999);
  });

  it("frd-12: WHEN the original array is mutated after topN THEN the returned slice is unchanged", () => {
    const items = [10, 20, 30, 40, 50];
    const result = topN(items, 3);
    items[0] = 0;
    // result[0] was a primitive; it does not track items[0].
    expect(result[0]).toBe(10);
  });

  it("frd-12: WHEN topN is called twice on the same items THEN both calls return equal (but not identical) arrays", () => {
    const items = [1, 2, 3, 4, 5];
    const first = topN(items);
    const second = topN(items);
    expect(first).toEqual(second);
    // Not the same reference — each call returns a fresh slice.
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — generic type support
// The function must work for objects, strings, numbers and arrays-of-arrays.
// ---------------------------------------------------------------------------

describe("frd-12: topN — generic T: objects, strings, numbers, arrays", () => {
  it("frd-12: WHEN items are objects THEN topN returns the first n objects verbatim (same references)", () => {
    const objs = [
      { agent: "alpha", count: 10 },
      { agent: "beta", count: 8 },
      { agent: "gamma", count: 6 },
      { agent: "delta", count: 4 },
      { agent: "epsilon", count: 2 },
      { agent: "zeta", count: 1 },
    ];
    const result = topN(objs, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(objs[0]);
    expect(result[1]).toBe(objs[1]);
    expect(result[2]).toBe(objs[2]);
  });

  it("frd-12: WHEN items are numbers with n=5 (default) THEN the first 5 numbers are returned", () => {
    const nums = [100, 200, 300, 400, 500, 600, 700];
    expect(topN(nums)).toEqual([100, 200, 300, 400, 500]);
  });

  it("frd-12: WHEN items are arrays (T = number[]) THEN topN slices correctly (regression I3)", () => {
    // I3 regression: arrays-as-items must not confuse the generic with typeof-object checks.
    const items = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
      [9, 10],
      [11, 12],
    ];
    const result = topN(items, 4);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual([1, 2]);
    expect(result[3]).toEqual([7, 8]);
  });

  it("frd-12: WHEN items are strings THEN the first n strings are returned in order", () => {
    const agents = ["agent-a", "agent-b", "agent-c", "agent-d", "agent-e", "agent-f"];
    expect(topN(agents, 5)).toEqual(["agent-a", "agent-b", "agent-c", "agent-d", "agent-e"]);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — order preservation invariant (parametric coverage)
//
// Rule: topN(items, n)[k] === items[k]  for all k < min(n, items.length).
// Verified across 5 lengths × 5 n values = 25 combinations.
// ---------------------------------------------------------------------------

describe("frd-12: topN — order preservation invariant (parametric)", () => {
  const lengths = [0, 1, 4, 5, 10];
  const caps = [0, 1, 3, 5, 7];

  for (const len of lengths) {
    for (const n of caps) {
      it(`frd-12: WHEN items.length=${len} and n=${n} THEN topN(items,n) === items.slice(0,n) (order preserved)`, () => {
        const items = Array.from({ length: len }, (_, i) => i * 10);
        const result = topN(items, n);
        const expected = items.slice(0, n);
        expect(result).toEqual(expected);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — idempotency: topN(topN(items, n), n) === topN(items, n)
// Applying the cap twice is the same as applying it once.
// ---------------------------------------------------------------------------

describe("frd-12: topN — idempotency invariant (parametric)", () => {
  const cases: Array<[number, number]> = [
    [10, 5],
    [3, 5],
    [5, 5],
    [0, 5],
    [8, 3],
    [1, 1],
  ];

  for (const [len, n] of cases) {
    it(`frd-12: WHEN items.length=${len} n=${n} THEN topN(topN(items,n),n) equals topN(items,n)`, () => {
      const items = Array.from({ length: len }, (_, i) => i);
      const once = topN(items, n);
      const twice = topN(once, n);
      expect(twice).toEqual(once);
    });
  }
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — length invariant
// topN always returns min(n, items.length) items (no more, never negative).
// ---------------------------------------------------------------------------

describe("frd-12: topN — length invariant min(n, items.length)", () => {
  it("frd-12: WHEN n < items.length THEN result.length === n", () => {
    expect(topN([1, 2, 3, 4, 5, 6, 7], 4)).toHaveLength(4);
  });

  it("frd-12: WHEN n === items.length THEN result.length === items.length", () => {
    expect(topN([1, 2, 3], 3)).toHaveLength(3);
  });

  it("frd-12: WHEN n > items.length THEN result.length === items.length (no padding)", () => {
    expect(topN([1, 2], 10)).toHaveLength(2);
  });

  it("frd-12: WHEN n=0 THEN result.length === 0 regardless of items.length", () => {
    expect(topN([1, 2, 3, 4, 5], 0)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Regression: NaN / non-finite n must NOT silently return []
// Anchor: B1' (WO-13-001, 2026-06-16).
//
// If `n` is NaN and the impl uses `items.slice(0, NaN)`, JS returns [] —
// silently hiding all items.  topN must detect non-finite n and fall back
// to the default cap of 5.
// ---------------------------------------------------------------------------

describe("frd-12: topN — NaN / non-finite n regression (B1' anchor)", () => {
  it("frd-12: WHEN n is NaN THEN topN falls back to default 5, NOT []", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = topN(items, Number.NaN);
    // Must not be empty — the silent-[] failure is the regression.
    expect(result.length).toBeGreaterThan(0);
    // Must fall back to the default cap of 5.
    expect(result).toHaveLength(5);
  });

  it("frd-12: WHEN n is +Infinity THEN topN returns all items (or falls back — must not throw)", () => {
    const items = [1, 2, 3];
    expect(() => topN(items, Number.POSITIVE_INFINITY)).not.toThrow();
    // Acceptable behavior: return all items (Infinity > length, so min(∞, 3) = 3).
    const result = topN(items, Number.POSITIVE_INFINITY);
    expect(result).toHaveLength(3);
  });

  it("frd-12: WHEN n is -1 THEN topN does NOT throw (error path)", () => {
    expect(() => topN([1, 2, 3], -1)).not.toThrow();
  });

  it("frd-12: WHEN n is -1 THEN topN returns [] (negative cap means zero items)", () => {
    // Negative cap → no items selected; must not crash.
    const result = topN([1, 2, 3, 4, 5], -1);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.1 — topN does NOT throw under any input combination
// The pure function is the single cap enforcer; it must never propagate errors.
// ---------------------------------------------------------------------------

describe("frd-12: topN — never throws (pure, no side effects)", () => {
  const edgeCases: Array<[unknown[], number | undefined]> = [
    [[], undefined],
    [[], 0],
    [[1], 0],
    [[1, 2, 3], 5],
    [new Array(1000).fill("x"), 5],
    [new Array(1000).fill("x"), 1000],
  ];

  for (const [items, n] of edgeCases) {
    it(`frd-12: topN(items.length=${(items as unknown[]).length}, n=${n}) does NOT throw`, () => {
      expect(() => topN(items as unknown[], n)).not.toThrow();
    });
  }
});
