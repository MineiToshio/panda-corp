/**
 * WO-05-002 — `lib/work-orders.ts`: `aggregateProgress`
 *
 * Traceability:
 *   REQ-05-004  It SHALL show the project's progress (work orders done / total
 *               and %), aggregated across every feature's work-orders/.
 *   AC-05-004.1 The view SHALL show aggregated progress done / total and %,
 *               summing every feature's work-orders/.
 *
 * TDD anchors (WO-05-002 §TDD):
 *   1. done/total/pct for a mixed set (AC-05-004.1)
 *   2. total === 0 → {done:0,total:0,pct:0} — no division by zero
 *   3. Pure: same input → same output
 *
 * Precision contract (from adversarial reviewer, work-orders.adversarial.test.ts):
 *   pct is rounded to 1 decimal place (Math.round(done/total*1000)/10).
 *
 * Note: the WO-05-002 TDD example uses pct:29 for 2/7 as a narrative approximation;
 *   the adversarial reviewer (the higher authority) pinned 1-decimal precision
 *   (e.g. 1/3 → 33.3), so this test suite uses that contract.
 */

import { describe, expect, it } from "vitest";
import { aggregateProgress, type WorkOrder, type WorkOrderProgress } from "./work-orders";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(state: WorkOrder["state"]): WorkOrder {
  return {
    id: "WO-01-001",
    title: "Example order",
    frd: "frd-01-example",
    state,
    relPath: "docs/frds/frd-01-example/work-orders/wo-01-001.md",
  };
}

// ---------------------------------------------------------------------------
// AC-05-004.1 — mixed set: done/total/pct
// ---------------------------------------------------------------------------

describe("WO-05-002: AC-05-004.1 — aggregated progress done/total/pct over mixed set", () => {
  it("WO-05-002: WHEN 2 orders are done of 5 total THEN done=2, total=5, pct=40", () => {
    const orders = [
      makeOrder("done"),
      makeOrder("done"),
      makeOrder("todo"),
      makeOrder("in_progress"),
      makeOrder("review"),
    ];
    const result: WorkOrderProgress = aggregateProgress(orders);
    expect(result.done).toBe(2);
    expect(result.total).toBe(5);
    expect(result.pct).toBe(40);
  });

  it("WO-05-002: WHEN 2 orders are done of 7 total THEN done=2, total=7, pct=28.6 (1-decimal precision)", () => {
    const orders = [
      makeOrder("done"),
      makeOrder("done"),
      makeOrder("todo"),
      makeOrder("in_progress"),
      makeOrder("review"),
      makeOrder("fail"),
      makeOrder("todo"),
    ];
    const result = aggregateProgress(orders);
    expect(result.done).toBe(2);
    expect(result.total).toBe(7);
    // 2/7*100 = 28.571... → rounds to 28.6 at 1 decimal
    expect(result.pct).toBe(28.6);
  });

  it("WO-05-002: WHEN all orders are done THEN pct=100", () => {
    const orders = [makeOrder("done"), makeOrder("done"), makeOrder("done")];
    const result = aggregateProgress(orders);
    expect(result.done).toBe(3);
    expect(result.total).toBe(3);
    expect(result.pct).toBe(100);
  });

  it("WO-05-002: WHEN no orders are done THEN done=0 and pct=0", () => {
    const orders = [makeOrder("todo"), makeOrder("in_progress"), makeOrder("review")];
    const result = aggregateProgress(orders);
    expect(result.done).toBe(0);
    expect(result.total).toBe(3);
    expect(result.pct).toBe(0);
  });

  it("WO-05-002: WHEN a single order is done THEN pct=100", () => {
    const result = aggregateProgress([makeOrder("done")]);
    expect(result.done).toBe(1);
    expect(result.total).toBe(1);
    expect(result.pct).toBe(100);
  });

  it("WO-05-002: WHEN a single order is not done THEN pct=0", () => {
    const result = aggregateProgress([makeOrder("todo")]);
    expect(result.done).toBe(0);
    expect(result.total).toBe(1);
    expect(result.pct).toBe(0);
  });

  it("WO-05-002: ONLY state==='done' counts toward done — review/fail/in_progress/todo are excluded", () => {
    const orders = [
      makeOrder("done"),
      makeOrder("review"), // NOT done
      makeOrder("fail"), // NOT done
      makeOrder("in_progress"), // NOT done
      makeOrder("todo"), // NOT done
    ];
    const result = aggregateProgress(orders);
    expect(result.done).toBe(1);
    expect(result.total).toBe(5);
  });

  it("WO-05-002: pct is a 1-decimal rounded number — 1/3 → 33.3", () => {
    const result = aggregateProgress([makeOrder("done"), makeOrder("todo"), makeOrder("todo")]);
    expect(result.pct).toBe(33.3);
  });

  it("WO-05-002: pct is a 1-decimal rounded number — 2/3 → 66.7", () => {
    const result = aggregateProgress([makeOrder("done"), makeOrder("done"), makeOrder("todo")]);
    expect(result.pct).toBe(66.7);
  });
});

// ---------------------------------------------------------------------------
// AC-05-004.1 — empty list: no division by zero, all zeros
// ---------------------------------------------------------------------------

describe("WO-05-002: AC-05-004.1 — empty list guard: total===0 → {done:0,total:0,pct:0}", () => {
  it("WO-05-002: WHEN orders list is empty THEN returns {done:0,total:0,pct:0}", () => {
    const result = aggregateProgress([]);
    expect(result).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("WO-05-002: WHEN orders list is empty THEN pct is NOT NaN (no division by zero)", () => {
    const result = aggregateProgress([]);
    expect(Number.isNaN(result.pct)).toBe(false);
  });

  it("WO-05-002: WHEN orders list is empty THEN pct is a finite number", () => {
    const result = aggregateProgress([]);
    expect(Number.isFinite(result.pct)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pure function: same input → same output
// ---------------------------------------------------------------------------

describe("WO-05-002: pure function contract — same input always yields same output", () => {
  it("WO-05-002: WHEN called twice with the same input THEN returns identical results", () => {
    const orders = [
      makeOrder("done"),
      makeOrder("done"),
      makeOrder("todo"),
      makeOrder("review"),
      makeOrder("fail"),
    ];
    const first = aggregateProgress(orders);
    const second = aggregateProgress(orders);
    expect(second).toEqual(first);
  });

  it("WO-05-002: WHEN called on an empty list twice THEN returns identical results", () => {
    const first = aggregateProgress([]);
    const second = aggregateProgress([]);
    expect(second).toEqual(first);
  });

  it("WO-05-002: calling aggregateProgress does NOT mutate the input array", () => {
    const orders = [makeOrder("done"), makeOrder("todo")];
    const snapshot = JSON.stringify(orders);
    aggregateProgress(orders);
    expect(JSON.stringify(orders)).toBe(snapshot);
  });

  it("WO-05-002: calling aggregateProgress does NOT mutate individual WorkOrder objects", () => {
    const order = makeOrder("done");
    const stateBefore = order.state;
    aggregateProgress([order]);
    expect(order.state).toBe(stateBefore);
  });
});

// ---------------------------------------------------------------------------
// Shape: returned object has exactly done/total/pct — correct types, no NaN
// ---------------------------------------------------------------------------

describe("WO-05-002: WorkOrderProgress shape invariants", () => {
  it("WO-05-002: result has exactly the fields done, total, pct (all numbers)", () => {
    const result = aggregateProgress([makeOrder("done"), makeOrder("todo")]);
    expect(typeof result.done).toBe("number");
    expect(typeof result.total).toBe("number");
    expect(typeof result.pct).toBe("number");
  });

  it("WO-05-002: done is a non-negative integer", () => {
    const result = aggregateProgress([makeOrder("done"), makeOrder("done"), makeOrder("todo")]);
    expect(Number.isInteger(result.done)).toBe(true);
    expect(result.done).toBeGreaterThanOrEqual(0);
  });

  it("WO-05-002: total equals orders.length", () => {
    const orders = [makeOrder("done"), makeOrder("todo"), makeOrder("review")];
    const result = aggregateProgress(orders);
    expect(result.total).toBe(orders.length);
  });

  it("WO-05-002: pct is always in the range [0, 100]", () => {
    const cases: WorkOrder[][] = [
      [],
      [makeOrder("todo")],
      [makeOrder("done")],
      [makeOrder("done"), makeOrder("todo")],
      [makeOrder("done"), makeOrder("done"), makeOrder("done")],
    ];
    for (const orders of cases) {
      const result = aggregateProgress(orders);
      expect(result.pct).toBeGreaterThanOrEqual(0);
      expect(result.pct).toBeLessThanOrEqual(100);
    }
  });

  it("WO-05-002: result is JSON-serializable (survives round-trip)", () => {
    const orders = [makeOrder("done"), makeOrder("todo"), makeOrder("in_progress")];
    const result = aggregateProgress(orders);
    const roundTrip = JSON.parse(JSON.stringify(result)) as WorkOrderProgress;
    expect(roundTrip).toEqual(result);
  });

  it("WO-05-002: done is always <= total", () => {
    const orders = [makeOrder("done"), makeOrder("done"), makeOrder("todo"), makeOrder("review")];
    const result = aggregateProgress(orders);
    expect(result.done).toBeLessThanOrEqual(result.total);
  });
});

// ---------------------------------------------------------------------------
// Cross-FRD aggregation: orders from multiple FRDs are summed correctly
// ---------------------------------------------------------------------------

describe("WO-05-002: cross-FRD aggregation — sums across all features", () => {
  it("WO-05-002: WHEN orders come from multiple FRDs THEN all are counted together", () => {
    const ordersFromDifferentFrds: WorkOrder[] = [
      {
        id: "WO-01-001",
        title: "a",
        frd: "frd-01-alpha",
        state: "done",
        relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-001.md",
      },
      {
        id: "WO-02-001",
        title: "b",
        frd: "frd-02-beta",
        state: "done",
        relPath: "docs/frds/frd-02-beta/work-orders/wo-02-001.md",
      },
      {
        id: "WO-03-001",
        title: "c",
        frd: "frd-03-gamma",
        state: "todo",
        relPath: "docs/frds/frd-03-gamma/work-orders/wo-03-001.md",
      },
      {
        id: "WO-04-001",
        title: "d",
        frd: "frd-04-delta",
        state: "in_progress",
        relPath: "docs/frds/frd-04-delta/work-orders/wo-04-001.md",
      },
    ];
    const result = aggregateProgress(ordersFromDifferentFrds);
    expect(result.done).toBe(2);
    expect(result.total).toBe(4);
    expect(result.pct).toBe(50);
  });

  it("WO-05-002: result is the same regardless of order of WorkOrders in the array", () => {
    const base: WorkOrder[] = [
      {
        id: "WO-01-001",
        title: "a",
        frd: "frd-01-alpha",
        state: "done",
        relPath: "d/frds/frd-01-alpha/work-orders/wo-01-001.md",
      },
      {
        id: "WO-02-001",
        title: "b",
        frd: "frd-02-beta",
        state: "todo",
        relPath: "d/frds/frd-02-beta/work-orders/wo-02-001.md",
      },
      {
        id: "WO-03-001",
        title: "c",
        frd: "frd-03-gamma",
        state: "review",
        relPath: "d/frds/frd-03-gamma/work-orders/wo-03-001.md",
      },
    ];
    const reversed = [...base].reverse();
    expect(aggregateProgress(base)).toEqual(aggregateProgress(reversed));
  });
});
