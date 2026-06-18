/**
 * WO-05-005 — WorkOrderDetail (CMP-05-detail) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-003.1  WHEN a work order is clicked, a detail view SHALL open with a
 *               Summary tab and a Full document tab.
 *   AC-05-003.2  The Full document tab SHALL render the entire work order markdown
 *               (acceptance criteria, scope, definition of done, evidence).
 *
 * Architecture:
 *   - `WorkOrderDetail` is a Server Component with an internal `WoDetailTabBar`
 *     client component ("use client") for tab selection.
 *   - The active tab is URL-driven via `?wotab=<summary|full>` so the server
 *     renders the correct pane without round-trips.
 *   - Back affordance: href="?tab=work-orders" (removes ?wo and ?wotab).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Fixtures: WorkOrder + markdown string — no fs calls (I/O already tested in
 * lib/work-orders.test.ts and lib/docs.ts tests).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderDetail } from "../wo-detail";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_WO: WorkOrder = {
  id: "WO-05-005",
  title: "WO-05-005 — Work order detail: Summary + Full document tabs",
  frd: "frd-05-work-orders",
  state: "in_progress",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-005-wo-detail.md",
  summary: "Build the work order detail view with Summary and Full document tabs.",
};

const FIXTURE_WO_NO_SUMMARY: WorkOrder = {
  id: "WO-05-001",
  title: "WO-05-001 — Work orders reader",
  frd: "frd-05-work-orders",
  state: "done",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-001-reader.md",
};

const FIXTURE_MARKDOWN = `---
id: WO-05-005
implementation_status: IN_PROGRESS
---
# WO-05-005 — Work order detail: Summary + Full document tabs

## Acceptance criteria (copied)
- **AC-05-003.1** WHEN a work order is clicked, a detail view SHALL open.
- **AC-05-003.2** The Full document tab SHALL render the entire markdown.

## Scope
- CMP-05-detail with two tabs.

## Definition of done
- [ ] Component tests written first and green.

## Evidence
Tests passing.
`;

// ---------------------------------------------------------------------------
// AC-05-003.1 — Summary tab + Full document tab presence
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-003.1 — detail view has Summary tab and Full document tab", () => {
  it("frd-05: AC-05-003.1 — WHEN rendered with summary tab THEN data-testid=wo-detail is present", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail")).toBeDefined();
  });

  it("frd-05: AC-05-003.1 — WHEN rendered THEN a Summary tab button is present with data-testid=wo-detail-tab-summary", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail-tab-summary")).toBeDefined();
  });

  it("frd-05: AC-05-003.1 — WHEN rendered THEN a Full document tab button is present with data-testid=wo-detail-tab-full", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail-tab-full")).toBeDefined();
  });

  it("frd-05: AC-05-003.1 — WHEN rendered THEN the tab bar has role=tablist", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeDefined();
  });

  it("frd-05: AC-05-003.1 — WHEN activeWoTab=summary THEN Summary tab has aria-selected=true", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const summaryTab = screen.getByTestId("wo-detail-tab-summary");
    expect(summaryTab.getAttribute("aria-selected")).toBe("true");
  });

  it("frd-05: AC-05-003.1 — WHEN activeWoTab=full THEN Full document tab has aria-selected=true", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    const fullTab = screen.getByTestId("wo-detail-tab-full");
    expect(fullTab.getAttribute("aria-selected")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// AC-05-003.1 — Summary tab content (title, FRD chip, state, summary)
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-003.1 — Summary tab shows title, FRD chip, state, summary", () => {
  it("frd-05: WHEN activeWoTab=summary THEN summary panel is visible (data-testid=wo-detail-summary)", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail-summary")).toBeDefined();
  });

  it("frd-05: WHEN activeWoTab=summary THEN the work order title is shown", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const summary = screen.getByTestId("wo-detail-summary");
    expect(summary.textContent).toContain("WO-05-005");
  });

  it("frd-05: WHEN activeWoTab=summary THEN the FRD chip is shown with data-testid=wo-detail-frd-chip", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const chip = screen.getByTestId("wo-detail-frd-chip");
    expect(chip.textContent).toContain("frd-05-work-orders");
  });

  it("frd-05: WHEN activeWoTab=summary THEN the state badge is shown with data-testid=wo-detail-state", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail-state")).toBeDefined();
  });

  it("frd-05: WHEN activeWoTab=summary AND order has summary THEN summary text is shown", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const summary = screen.getByTestId("wo-detail-summary");
    expect(summary.textContent).toContain("Build the work order detail view");
  });

  it("frd-05: WHEN activeWoTab=summary AND order has no summary THEN no summary text placeholder shown (graceful)", () => {
    render(
      <WorkOrderDetail
        order={FIXTURE_WO_NO_SUMMARY}
        content={FIXTURE_MARKDOWN}
        activeWoTab="summary"
      />,
    );
    const summary = screen.getByTestId("wo-detail-summary");
    // Should at least show the title, not crash
    expect(summary.textContent).toContain("WO-05-001");
  });
});

// ---------------------------------------------------------------------------
// AC-05-003.2 — Full document tab renders complete markdown
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-003.2 — Full document tab renders complete markdown", () => {
  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full THEN full document panel is visible (data-testid=wo-detail-full)", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    expect(screen.getByTestId("wo-detail-full")).toBeDefined();
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full THEN acceptance criteria text is rendered", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    const fullPane = screen.getByTestId("wo-detail-full");
    expect(fullPane.textContent).toContain("Acceptance criteria");
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full THEN scope text is rendered", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    const fullPane = screen.getByTestId("wo-detail-full");
    expect(fullPane.textContent).toContain("Scope");
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full THEN definition of done is rendered", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    const fullPane = screen.getByTestId("wo-detail-full");
    expect(fullPane.textContent).toContain("Definition of done");
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full AND content=null THEN shows loading state", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={null} activeWoTab="full" />);
    expect(screen.getByTestId("wo-detail-full-loading")).toBeDefined();
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=summary THEN full document pane is NOT visible", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.queryByTestId("wo-detail-full")).toBeNull();
  });

  it("frd-05: AC-05-003.2 — WHEN activeWoTab=full THEN summary pane is NOT visible", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    expect(screen.queryByTestId("wo-detail-summary")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Back affordance
// ---------------------------------------------------------------------------

describe("frd-05: back affordance to the board", () => {
  it("frd-05: WHEN rendered THEN a back link with data-testid=wo-detail-back is present", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail-back")).toBeDefined();
  });

  it("frd-05: WHEN rendered THEN the back link href points to the work-orders tab", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    const back = screen.getByTestId("wo-detail-back");
    const href = back.getAttribute("href") ?? "";
    expect(href).toContain("tab=work-orders");
  });
});

// ---------------------------------------------------------------------------
// Design tokens — no hardcoded colors
// ---------------------------------------------------------------------------

describe("frd-05: design tokens — no hardcoded colors", () => {
  it("frd-05: WHEN rendered THEN no style attribute contains a raw hex color", () => {
    const { container } = render(
      <WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />,
    );
    // Walk inline styles — none should contain a hex color literal
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      // #RGB, #RRGGBB, #RRGGBBAA — none of these should appear
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// data-testid completeness
// ---------------------------------------------------------------------------

describe("frd-05: data-testid completeness", () => {
  it("frd-05: WHEN rendered THEN all required testids are present on summary tab", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="summary" />);
    expect(screen.getByTestId("wo-detail")).toBeDefined();
    expect(screen.getByTestId("wo-detail-back")).toBeDefined();
    expect(screen.getByTestId("wo-detail-tab-summary")).toBeDefined();
    expect(screen.getByTestId("wo-detail-tab-full")).toBeDefined();
    expect(screen.getByTestId("wo-detail-frd-chip")).toBeDefined();
    expect(screen.getByTestId("wo-detail-state")).toBeDefined();
    expect(screen.getByTestId("wo-detail-summary")).toBeDefined();
  });

  it("frd-05: WHEN rendered on full tab THEN all required testids are present", () => {
    render(<WorkOrderDetail order={FIXTURE_WO} content={FIXTURE_MARKDOWN} activeWoTab="full" />);
    expect(screen.getByTestId("wo-detail")).toBeDefined();
    expect(screen.getByTestId("wo-detail-back")).toBeDefined();
    expect(screen.getByTestId("wo-detail-tab-summary")).toBeDefined();
    expect(screen.getByTestId("wo-detail-tab-full")).toBeDefined();
    expect(screen.getByTestId("wo-detail-full")).toBeDefined();
  });
});
