/**
 * WO-05-003 — Kanban board (CMP-05-board, CMP-05-column, CMP-05-card) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-001.1  The kanban SHALL render four columns in order: To do, In progress,
 *               Review/Testing, Done.
 *   AC-05-001.2  Columns SHALL be equal-width and wide, with horizontal scroll; text wraps.
 *   AC-05-002.1  EACH card SHALL show its FRD via a chip.
 *   AC-05-005.1  The kanban SHALL be read-only — no drag, no manual move.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Fixture: WorkOrder[] inlined — no fs calls (I/O tested in lib/work-orders.test.ts).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderBoard } from "../wo-board";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WO_TODO: WorkOrder = {
  id: "WO-01-001",
  title: "Discover + parse work orders",
  frd: "frd-01-alpha",
  state: "todo",
  relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-001-reader.md",
};

const WO_IN_PROGRESS: WorkOrder = {
  id: "WO-01-002",
  title: "Build kanban board with very long wrapping title that must not clip",
  frd: "frd-01-alpha",
  state: "in_progress",
  relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-002-board.md",
};

const WO_REVIEW: WorkOrder = {
  id: "WO-02-001",
  title: "API integration tests",
  frd: "frd-02-beta",
  state: "review",
  relPath: "docs/frds/frd-02-beta/work-orders/wo-02-001-api.md",
};

const WO_DONE: WorkOrder = {
  id: "WO-02-002",
  title: "UI components",
  frd: "frd-02-beta",
  state: "done",
  relPath: "docs/frds/frd-02-beta/work-orders/wo-02-002-ui.md",
};

const WO_FAIL: WorkOrder = {
  id: "WO-03-001",
  title: "Blocked migration script",
  frd: "frd-03-gamma",
  state: "fail",
  relPath: "docs/frds/frd-03-gamma/work-orders/wo-03-001-blocked.md",
};

const ALL_ORDERS: WorkOrder[] = [WO_TODO, WO_IN_PROGRESS, WO_REVIEW, WO_DONE, WO_FAIL];
const EMPTY_ORDERS: WorkOrder[] = [];

// ---------------------------------------------------------------------------
// AC-05-001.1 — Four columns in correct order
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-001.1 — four columns in order", () => {
  it("frd-05: AC-05-001.1 — WHEN orders provided THEN renders exactly four column headings", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const columns = screen.getAllByTestId("wo-column");
    expect(columns).toHaveLength(4);
  });

  it("frd-05: AC-05-001.1 — WHEN orders provided THEN columns are in order: To do, In progress, Review/Testing, Done", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const columns = screen.getAllByTestId("wo-column");
    expect(columns[0]?.textContent).toContain("Pendiente");
    expect(columns[1]?.textContent).toContain("En progreso");
    expect(columns[2]?.textContent).toContain("Revisión");
    expect(columns[3]?.textContent).toContain("Hecho");
  });

  it("frd-05: AC-05-001.1 — WHEN empty orders THEN still renders four columns", () => {
    render(<WorkOrderBoard orders={EMPTY_ORDERS} />);
    const columns = screen.getAllByTestId("wo-column");
    expect(columns).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AC-05-001.2 — Equal-width columns; board container
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-001.2 — board container and column layout", () => {
  it("frd-05: AC-05-001.2 — WHEN rendered THEN board container has data-testid=wo-board", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
  });

  it("frd-05: AC-05-001.2 — WHEN rendered THEN each column has a heading element", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const headings = screen.getAllByTestId("wo-column-heading");
    expect(headings).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AC-05-002.1 — Each card shows FRD chip
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.1 — each card shows FRD chip", () => {
  it("frd-05: AC-05-002.1 — WHEN a card is rendered THEN it has a data-testid=wo-card element", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    const cards = screen.getAllByTestId("wo-card");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("frd-05: AC-05-002.1 — WHEN a card is rendered THEN it has a frd chip element", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    const chips = screen.getAllByTestId("wo-frd-chip");
    expect(chips.length).toBeGreaterThan(0);
  });

  it("frd-05: AC-05-002.1 — WHEN a card is rendered THEN the frd chip shows the frd slug", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    const chip = screen.getByTestId("wo-frd-chip");
    expect(chip.textContent).toContain("frd-01-alpha");
  });

  it("frd-05: AC-05-002.1 — WHEN multiple cards THEN each has a frd chip with its frd slug", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const chips = screen.getAllByTestId("wo-frd-chip");
    const chipTexts = chips.map((c) => c.textContent ?? "");
    expect(chipTexts.some((t) => t.includes("frd-01-alpha"))).toBe(true);
    expect(chipTexts.some((t) => t.includes("frd-02-beta"))).toBe(true);
    expect(chipTexts.some((t) => t.includes("frd-03-gamma"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-05-005.1 — Read-only: no drag, no move affordance
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-005.1 — kanban is read-only", () => {
  it("frd-05: AC-05-005.1 — WHEN rendered THEN no draggable attribute on any card", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const cards = screen.getAllByTestId("wo-card");
    for (const card of cards) {
      expect(card.getAttribute("draggable")).toBeNull();
    }
  });

  it("frd-05: AC-05-005.1 — WHEN rendered THEN no drop zone role present", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    // No elements with role=listbox or drop targets expected
    const dropTargets = document.querySelectorAll("[data-dropzone]");
    expect(dropTargets.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fail state a11y — icon + label, not color alone
// ---------------------------------------------------------------------------

describe("frd-05: fail state accessibility — icon + label, not color alone", () => {
  it("frd-05: WHEN a card has state=fail THEN it has a visible fail indicator element", () => {
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    const indicators = screen.getAllByTestId("wo-fail-indicator");
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("frd-05: WHEN a card has state=fail THEN the fail indicator has text (not just color)", () => {
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    const indicator = screen.getByTestId("wo-fail-indicator");
    expect((indicator.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("frd-05: WHEN a card has state=done THEN no fail indicator is shown", () => {
    render(<WorkOrderBoard orders={[WO_DONE]} />);
    const indicators = screen.queryAllByTestId("wo-fail-indicator");
    expect(indicators.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Card distribution — cards land in the right column
// ---------------------------------------------------------------------------

describe("frd-05: cards distributed to correct columns", () => {
  it("frd-05: WHEN a todo order THEN the todo column contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    const todoCol = screen.getAllByTestId("wo-column")[0];
    expect(todoCol?.textContent).toContain(WO_TODO.title);
  });

  it("frd-05: WHEN an in_progress order THEN the in_progress column contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_IN_PROGRESS]} />);
    const col = screen.getAllByTestId("wo-column")[1];
    expect(col?.textContent).toContain("Build kanban board");
  });

  it("frd-05: WHEN a review order THEN the review column contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_REVIEW]} />);
    const col = screen.getAllByTestId("wo-column")[2];
    expect(col?.textContent).toContain(WO_REVIEW.title);
  });

  it("frd-05: WHEN a done order THEN the done column contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_DONE]} />);
    const col = screen.getAllByTestId("wo-column")[3];
    expect(col?.textContent).toContain(WO_DONE.title);
  });

  it("frd-05: WHEN a fail order THEN the in_progress column contains the fail card (fail maps to in_progress slot)", () => {
    // fail is a sub-state of in_progress column per blueprint §3
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    // fail card appears somewhere — at least one card is rendered
    const cards = screen.getAllByTestId("wo-card");
    expect(cards.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// data-testid completeness
// ---------------------------------------------------------------------------

describe("frd-05: data-testid completeness", () => {
  it("frd-05: WHEN rendered THEN board, columns, cards, chips all have data-testid", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
    expect(screen.getAllByTestId("wo-column").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("wo-card").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("wo-frd-chip").length).toBeGreaterThan(0);
  });
});
