/**
 * WO-05-006 — TabWorkOrders (kanban board + CMP-05-empty integration) tests
 *
 * Traceability:
 *   AC-05-006.1  WHEN a project has no work orders, the view SHALL show a message
 *               that they are generated in /pandacorp:blueprint.
 *
 * Note (#22): the per-tab progress bar was removed (it duplicated the project
 * header's canonical objectives bar). The tab now renders the kanban board only;
 * these tests assert the board is present and `wo-progress` is NOT rendered here.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { TabWorkOrders } from "../tab-work-orders";

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
// AC-05-001.1 — orders present → kanban board (NO duplicate progress bar, #22)
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-001.1 — TabWorkOrders renders the kanban board", () => {
  it("frd-05: AC-05-001.1 — WHEN orders present THEN the kanban board is rendered", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
  });

  it("frd-05: #22 — WHEN orders present THEN the redundant per-tab progress bar is NOT rendered", () => {
    render(<TabWorkOrders orders={ORDERS_PARTIAL} />);
    expect(screen.queryByTestId("wo-progress")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-05-006.1 — total === 0 → empty state (not the board)
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-006.1 — TabWorkOrders renders empty state when no orders", () => {
  it("frd-05: AC-05-006.1 — WHEN no work orders THEN empty state is shown", () => {
    render(<TabWorkOrders orders={ORDERS_EMPTY} />);
    expect(screen.getByTestId("wo-empty")).toBeDefined();
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
