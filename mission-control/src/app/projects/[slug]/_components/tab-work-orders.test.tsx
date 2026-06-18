/**
 * WO-05-006 — TabWorkOrders (CMP-05-progress + CMP-05-empty integration) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-004.1  The view SHALL show aggregated progress done/total and %,
 *               summing every feature's work-orders/.
 *   AC-05-006.1  WHEN a project has no work orders, the view SHALL show a message
 *               that they are generated in /pandacorp:blueprint.
 *
 * TDD cases (from WO-05-006):
 *   1. Progress shows 2/7 · 28.6% for that set (AC-05-004.1).
 *   2. total === 0 renders the empty state instead of a zeroed bar (AC-05-006.1).
 *   3. Empty state message references /pandacorp:blueprint with a copy button.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders";
import { TabWorkOrders } from "./tab-work-orders";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "WO-01-001",
    title: "Sample work order",
    frd: "frd-01-alpha",
    state: "todo",
    relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-001.md",
    ...overrides,
  };
}

// 2 done, 5 todo/other → 2/7 · 28.6%
const ORDERS_PARTIAL: WorkOrder[] = [
  makeOrder({ id: "WO-01-001", state: "done" }),
  makeOrder({ id: "WO-01-002", state: "done" }),
  makeOrder({ id: "WO-01-003", state: "todo" }),
  makeOrder({ id: "WO-01-004", state: "todo" }),
  makeOrder({ id: "WO-01-005", state: "in_progress" }),
  makeOrder({ id: "WO-01-006", state: "review" }),
  makeOrder({ id: "WO-01-007", state: "fail" }),
];

const ORDERS_EMPTY: WorkOrder[] = [];

// ---------------------------------------------------------------------------
// AC-05-004.1 — TDD case 1: progress shows 2/7 · 28.6%
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-004.1 — TabWorkOrders renders aggregated progress", () => {
  it("frd-05: AC-05-004.1 — WHEN 2 of 7 orders are done THEN renders the progress section", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress")).toBeDefined();
  });

  it("frd-05: AC-05-004.1 — WHEN 2 of 7 orders are done THEN progress shows '2'", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress").textContent).toContain("2");
  });

  it("frd-05: AC-05-004.1 — WHEN 2 of 7 orders are done THEN progress shows '7'", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress").textContent).toContain("7");
  });

  it("frd-05: AC-05-004.1 — WHEN 2 of 7 orders are done THEN progress shows percentage '28.6'", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress").textContent).toContain("28.6");
  });

  it("frd-05: AC-05-004.1 — WHEN orders present THEN the kanban board is also rendered", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-05-006.1 — TDD case 2: total === 0 → empty state, not a zeroed bar
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-006.1 — TabWorkOrders renders empty state when no orders", () => {
  it("frd-05: AC-05-006.1 — WHEN no work orders THEN empty state is shown (not progress bar)", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.getByTestId("wo-empty")).toBeDefined();
  });

  it("frd-05: AC-05-006.1 — WHEN no work orders THEN progress bar is NOT shown", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.queryByTestId("wo-progress")).toBeNull();
  });

  it("frd-05: AC-05-006.1 — WHEN no work orders THEN kanban board is NOT shown", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.queryByTestId("wo-board")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-05-006.1 — TDD case 3: empty state references /pandacorp:blueprint + copy button
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-006.1 — TabWorkOrders empty state content", () => {
  it("frd-05: AC-05-006.1 — WHEN no orders THEN empty state references /pandacorp:blueprint", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    const empty = screen.getByTestId("wo-empty");
    expect(empty.textContent).toContain("/pandacorp:blueprint");
  });

  it("frd-05: AC-05-006.1 — WHEN no orders THEN empty state has a copy button for the command", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("frd-05: AC-05-006.1 — WHEN no orders THEN empty state has role=status for a11y", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    const empty = screen.getByTestId("wo-empty");
    expect(empty.getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// Integration seam — no hardcoded colors, data-testid completeness
// ---------------------------------------------------------------------------

describe("frd-05: TabWorkOrders — tokens and data-testid completeness", () => {
  it("frd-05: WHEN orders present THEN has tab-work-orders root testid", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("tab-work-orders")).toBeDefined();
  });

  it("frd-05: WHEN no orders THEN has tab-work-orders root testid", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.getByTestId("tab-work-orders")).toBeDefined();
  });
});
