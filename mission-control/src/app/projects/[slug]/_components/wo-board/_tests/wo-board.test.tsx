/**
 * WO-05-003 — Kanban board (CMP-05-board, CMP-05-column, CMP-05-card) tests
 *
 * RED → GREEN → REFACTOR per TDD.
 *
 * Traceability:
 *   AC-05-001.1  The kanban SHALL render FIVE columns in order:
 *               To do · In progress · Review / Testing · Fail · Done
 *   AC-05-001.2  Equal-width wide columns; horizontal scroll; card text wraps.
 *   AC-05-002.1  EACH card SHALL show its FRD via a chip.
 *   AC-05-005.1  The kanban SHALL be read-only — no drag, no manual move.
 *   Fail col     "Fail" column header reads in danger color (conveyed by icon+label+color).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Fixture: WorkOrder[] inlined — no fs calls (I/O tested in lib/work-orders.test.ts).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders/work-orders";
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
// AC-05-001.1 — FIVE columns in correct order (the re-paint requirement)
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-001.1 — five columns in order", () => {
  it("frd-05: AC-05-001.1 — WHEN orders provided THEN renders exactly FIVE column headings", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const columns = screen.getAllByTestId("kanban-col-root");
    expect(columns).toHaveLength(5);
  });

  it("frd-05: AC-05-001.1 — WHEN orders provided THEN columns are in order: To do, In progress, Review/Testing, Fail, Done", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const columns = screen.getAllByTestId("kanban-col-root");
    expect(columns[0]?.textContent).toContain("To do");
    expect(columns[1]?.textContent).toContain("En progreso");
    expect(columns[2]?.textContent).toContain("Review");
    expect(columns[3]?.textContent).toContain("Falló");
    expect(columns[4]?.textContent).toContain("Hecho");
  });

  it("frd-05: AC-05-001.1 — WHEN empty orders THEN still renders five columns", () => {
    render(<WorkOrderBoard orders={EMPTY_ORDERS} />);
    const columns = screen.getAllByTestId("kanban-col-root");
    expect(columns).toHaveLength(5);
  });

  it("frd-05: AC-05-001.1 — WHEN rendered THEN Fail column is its own separate column (not merged with In progress)", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const labels = screen.getAllByTestId("kanban-col-label");
    const labelTexts = labels.map((l) => l.textContent ?? "");
    // Fail must be a distinct label, not embedded in "En progreso"
    expect(labelTexts.some((t) => t.includes("Falló") || t.includes("Fail"))).toBe(true);
    expect(labelTexts.some((t) => t.includes("En progreso"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-05-001.2 — Board container and column layout
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-001.2 — board container and column layout", () => {
  it("frd-05: AC-05-001.2 — WHEN rendered THEN board container has data-testid=wo-board", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
  });

  it("frd-05: AC-05-001.2 — WHEN rendered THEN each column uses the KanbanColumn primitive (kanban-col-root)", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols).toHaveLength(5);
  });

  it("frd-05: AC-05-001.2 — WHEN rendered THEN each column has a count badge via kanban-col-count", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    const counts = screen.getAllByTestId("kanban-col-count");
    expect(counts).toHaveLength(5);
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
    const dropTargets = document.querySelectorAll("[data-dropzone]");
    expect(dropTargets.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fail column treatment — danger variant (icon + label + color, not color alone)
// ---------------------------------------------------------------------------

describe("frd-05: Fail column — danger variant (AC-05-001.1 fail treatment)", () => {
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

  it("frd-05: WHEN a fail card is rendered THEN the Fail column (index 3) contains it", () => {
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    const columns = screen.getAllByTestId("kanban-col-root");
    // Column index 3 = Fail column (To do=0, In progress=1, Review=2, Fail=3, Done=4)
    expect(columns[3]?.textContent).toContain(WO_FAIL.title);
  });
});

// ---------------------------------------------------------------------------
// Card distribution — cards land in the right column
// ---------------------------------------------------------------------------

describe("frd-05: cards distributed to correct columns", () => {
  it("frd-05: WHEN a todo order THEN the todo column (index 0) contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols[0]?.textContent).toContain(WO_TODO.title);
  });

  it("frd-05: WHEN an in_progress order THEN the in_progress column (index 1) contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_IN_PROGRESS]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols[1]?.textContent).toContain("Build kanban board");
  });

  it("frd-05: WHEN a review order THEN the review column (index 2) contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_REVIEW]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols[2]?.textContent).toContain(WO_REVIEW.title);
  });

  it("frd-05: WHEN a fail order THEN the fail column (index 3) contains the card title (fail is its OWN column)", () => {
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    // Fail maps to column index 3, NOT index 1 (in_progress)
    expect(cols[3]?.textContent).toContain(WO_FAIL.title);
  });

  it("frd-05: WHEN a done order THEN the done column (index 4) contains the card title", () => {
    render(<WorkOrderBoard orders={[WO_DONE]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols[4]?.textContent).toContain(WO_DONE.title);
  });

  it("frd-05: WHEN a fail order THEN the in_progress column (index 1) does NOT contain it", () => {
    render(<WorkOrderBoard orders={[WO_FAIL]} />);
    const cols = screen.getAllByTestId("kanban-col-root");
    // Fail must NOT appear in In progress column
    expect(cols[1]?.textContent).not.toContain(WO_FAIL.title);
  });
});

// ---------------------------------------------------------------------------
// Empty column placeholder — "—"
// ---------------------------------------------------------------------------

describe("frd-05: empty column placeholder", () => {
  it("frd-05: WHEN a column has no cards THEN it shows the em-dash placeholder", () => {
    render(<WorkOrderBoard orders={[WO_TODO]} />);
    // Done column (index 4) should be empty → show "—"
    const cols = screen.getAllByTestId("kanban-col-root");
    expect(cols[4]?.textContent).toContain("—");
  });
});

// ---------------------------------------------------------------------------
// data-testid completeness
// ---------------------------------------------------------------------------

describe("frd-05: data-testid completeness", () => {
  it("frd-05: WHEN rendered THEN board, columns (kanban-col-root), cards, chips all have data-testid", () => {
    render(<WorkOrderBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
    expect(screen.getAllByTestId("kanban-col-root").length).toBe(5);
    expect(screen.getAllByTestId("wo-card").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("wo-frd-chip").length).toBeGreaterThan(0);
  });
});
