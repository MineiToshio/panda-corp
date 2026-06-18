/**
 * WO-05-005 — WorkOrderDetail integration tests (CMP-05-detail)
 *
 * These tests verify that the COMPLETE flow works end-to-end:
 *   1. The board cards have click targets (links) to open the detail view.
 *   2. The page routes to WorkOrderDetail when ?wo=<id> is present.
 *   3. The full document tab renders work order markdown via readWorkOrderDoc.
 *   4. The back affordance returns to the board.
 *
 * Anchored in:
 *   AC-05-003.1  WHEN a work order is clicked, a detail view SHALL open with
 *               Summary tab and Full document tab.
 *   AC-05-003.2  The Full document tab SHALL render the entire work order markdown.
 *
 * Traceability: WO-05-005, CMP-05-detail
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderBoard } from "../../wo-board/wo-board";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WO_A: WorkOrder = {
  id: "WO-05-001",
  title: "WO-05-001 — Work orders reader",
  frd: "frd-05-work-orders",
  state: "done",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-001-work-orders-reader.md",
  summary: "Implement the work orders reader.",
};

const WO_B: WorkOrder = {
  id: "WO-05-005",
  title: "WO-05-005 — Work order detail: Summary + Full document tabs",
  frd: "frd-05-work-orders",
  state: "in_progress",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-005-wo-detail.md",
  summary: "Build the work order detail view with Summary and Full document tabs.",
};

// ---------------------------------------------------------------------------
// AC-05-003.1 — Card click target wiring
// Each board card must expose a navigable link that opens the detail view.
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-003.1 — board cards have click targets for detail view", () => {
  it("frd-05: WHEN a work order card is rendered THEN it has a link element (data-testid=wo-card-link)", () => {
    render(<WorkOrderBoard orders={[WO_A]} />);
    // Each card must have a navigable wo-card-link sibling/wrapper
    const links = screen.getAllByTestId("wo-card-link");
    expect(links.length).toBeGreaterThan(0);
  });

  it("frd-05: WHEN a work order card is rendered THEN the link navigates to ?tab=work-orders&wo=<id>", () => {
    render(<WorkOrderBoard orders={[WO_A]} />);
    // wo-card-link is the anchor wrapping the card — query it directly
    const links = screen.getAllByTestId("wo-card-link");
    const href = links[0]?.getAttribute("href") ?? "";
    expect(href).toContain("tab=work-orders");
    expect(href).toContain(`wo=${WO_A.id}`);
  });

  it("frd-05: WHEN multiple work order cards are rendered THEN each card link has its own id", () => {
    render(<WorkOrderBoard orders={[WO_A, WO_B]} />);
    const links = screen.getAllByTestId("wo-card-link");
    const hrefs = links.map((l) => l.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes(`wo=${WO_A.id}`))).toBe(true);
    expect(hrefs.some((h) => h.includes(`wo=${WO_B.id}`))).toBe(true);
  });

  it("frd-05: WHEN a card link is rendered THEN it has data-testid=wo-card-link", () => {
    render(<WorkOrderBoard orders={[WO_A]} />);
    const links = screen.getAllByTestId("wo-card-link");
    expect(links.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Page-level integration: ?wo=<id> routes to WorkOrderDetail
// Tests exercise page.tsx through mock boundaries (same pattern as page.reviewer.test.tsx).
// ---------------------------------------------------------------------------

vi.mock("@/lib/portfolio", () => ({
  activeProjects: () => [{ name: "demo", path: "/tmp/demo", stage: "implementation" }],
}));

vi.mock("@/lib/status", () => ({
  readStatus: () => ({
    present: true,
    malformed: false,
    status: {
      project: "Demo",
      phase: "implementation",
      version: "1.0.0",
      workOrdersTotal: 2,
      workOrdersDone: 1,
    },
  }),
}));

vi.mock("@/lib/docs", () => ({
  listProjectDocs: () => [],
  readDoc: () => null,
  readActivityLog: () => ({ entries: [] }),
  readDecisions: () => [],
}));

const FIXTURE_WO_CONTENT = `---
id: WO-05-001
implementation_status: DONE
---
# WO-05-001 — Work orders reader

## Acceptance criteria (copied)
- **AC-05-001.1** The board shall render four columns.

## Scope
- Implement listWorkOrders function.

## Definition of done
- [x] Component tests written and green.
`;

vi.mock("@/lib/work-orders", () => ({
  listWorkOrders: () => [WO_A, WO_B],
  readWorkOrderDoc: (_projectPath: string, relPath: string) => {
    if (relPath === WO_A.relPath) return FIXTURE_WO_CONTENT;
    return null;
  },
  aggregateProgress: () => ({ done: 1, total: 2, pct: 50 }),
}));

import ProjectWorkspacePage from "../../../page";

function renderPage(searchParams: Record<string, string> = {}) {
  return ProjectWorkspacePage({
    params: Promise.resolve({ slug: "demo" }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe("frd-05: AC-05-003.1 — page renders WorkOrderDetail when ?wo=<id> is present", () => {
  it("frd-05: WHEN tab=work-orders with no wo param THEN the board (not detail) is shown", async () => {
    const el = await renderPage({ tab: "work-orders" });
    render(el);
    expect(screen.getByTestId("wo-board")).toBeDefined();
    expect(screen.queryByTestId("wo-detail")).toBeNull();
  });

  it("frd-05: WHEN tab=work-orders&wo=WO-05-001 THEN the detail view is shown (not the board)", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001" });
    render(el);
    expect(screen.queryByTestId("wo-board")).toBeNull();
    expect(screen.getByTestId("wo-detail")).toBeDefined();
  });

  it("frd-05: WHEN detail view is shown THEN it defaults to the summary tab", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001" });
    render(el);
    // Summary pane must be visible by default
    expect(screen.getByTestId("wo-detail-summary")).toBeDefined();
    expect(screen.queryByTestId("wo-detail-full")).toBeNull();
  });

  it("frd-05: WHEN detail view is shown THEN the WO title is displayed", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001" });
    render(el);
    const detail = screen.getByTestId("wo-detail");
    expect(detail.textContent).toContain("WO-05-001");
  });

  it("frd-05: WHEN tab=work-orders&wo=<unknown-id> THEN falls back to the board (graceful)", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-99-999" });
    render(el);
    // Unknown id → board shown, no crash
    expect(screen.getByTestId("wo-board")).toBeDefined();
    expect(screen.queryByTestId("wo-detail")).toBeNull();
  });
});

describe("frd-05: AC-05-003.2 — full document tab renders work order markdown", () => {
  it("frd-05: WHEN tab=work-orders&wo=WO-05-001&wotab=full THEN the full document pane is shown", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001", wotab: "full" });
    render(el);
    expect(screen.getByTestId("wo-detail-full")).toBeDefined();
    expect(screen.queryByTestId("wo-detail-summary")).toBeNull();
  });

  it("frd-05: WHEN wotab=full THEN acceptance criteria text from the markdown is rendered", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001", wotab: "full" });
    render(el);
    const fullPane = screen.getByTestId("wo-detail-full");
    expect(fullPane.textContent).toContain("Acceptance criteria");
  });

  it("frd-05: WHEN wotab=full THEN definition of done text from the markdown is rendered", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001", wotab: "full" });
    render(el);
    const fullPane = screen.getByTestId("wo-detail-full");
    expect(fullPane.textContent).toContain("Definition of done");
  });

  it("frd-05: WHEN wotab=summary THEN the full document pane is NOT shown", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001", wotab: "summary" });
    render(el);
    expect(screen.queryByTestId("wo-detail-full")).toBeNull();
    expect(screen.getByTestId("wo-detail-summary")).toBeDefined();
  });
});

describe("frd-05: back affordance — detail view back link", () => {
  it("frd-05: WHEN detail is shown THEN back link is present", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001" });
    render(el);
    expect(screen.getByTestId("wo-detail-back")).toBeDefined();
  });

  it("frd-05: WHEN detail is shown THEN back link href contains tab=work-orders (no wo= param)", async () => {
    const el = await renderPage({ tab: "work-orders", wo: "WO-05-001" });
    render(el);
    const back = screen.getByTestId("wo-detail-back");
    const href = back.getAttribute("href") ?? "";
    expect(href).toContain("tab=work-orders");
    // Back must not carry the wo= param (it returns to the board, not another detail)
    expect(href).not.toContain("wo=");
  });
});
