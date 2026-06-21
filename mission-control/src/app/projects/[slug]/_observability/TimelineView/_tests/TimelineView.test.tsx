/**
 * WO-12-005 — TimelineView tests (CMP-12-timeline Gantt-style, project-scoped)
 *
 * This tests the NEW Gantt-style TimelineView at the project route level,
 * matching prototype bTimeline() (~L1156). Distinct from the shared tree-based
 * TimelineView at src/app/_observability/TimelineView/.
 *
 * Acceptance criteria covered:
 *   AC-12-003.1 — WO→tasks Gantt bars sized to duration, child bars nested
 *   AC-12-003.2 — "saltar al primer error" affordance for first failed WO
 *   Fidelity — panel, time axis, label column, duration bars, nested task bars,
 *               tabular-nums on durations
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GanttWorkOrder } from "../TimelineView";
import { TimelineView } from "../TimelineView";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DONE_WO: GanttWorkOrder = {
  id: "WO-01-001",
  title: "Esquema de datos",
  frd: "FRD-01",
  state: "done",
  start: 0,
  dur: 34,
  tasks: [
    { title: "Modelar tablas", dur: 14, state: "done" },
    { title: "Migración inicial", dur: 11, state: "done" },
  ],
};

const FAIL_WO: GanttWorkOrder = {
  id: "WO-01-002",
  title: "CRUD de grupos",
  frd: "FRD-01",
  state: "fail",
  start: 34,
  dur: 28,
  tasks: [
    { title: "Server actions", dur: 13, state: "done" },
    { title: "Tests adversariales", dur: 6, state: "fail" },
  ],
};

const PROGRESS_WO: GanttWorkOrder = {
  id: "WO-01-003",
  title: "Registrar gasto",
  frd: "FRD-02",
  state: "in_progress",
  start: 62,
  dur: 22,
  tasks: [{ title: "Formulario Zod", dur: 12, state: "done" }],
};

const TODO_WO: GanttWorkOrder = {
  id: "WO-01-004",
  title: "Cálculo de deudas",
  frd: "FRD-03",
  state: "todo",
  start: 84,
  dur: 18,
  tasks: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TimelineView (Gantt, WO-12-005)", () => {
  // AC-12-003.1 — basic render with bars
  it("renders a row per work order", () => {
    render(<TimelineView workOrders={[DONE_WO, FAIL_WO]} total={62} />);
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
    // Both WO title labels should appear
    expect(screen.getByTestId("timeline-gantt-label-WO-01-001")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-label-WO-01-002")).toBeTruthy();
  });

  it("renders duration bar for each work order", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    const bar = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    expect(bar).toBeTruthy();
    // The bar should carry dur in minutes
    expect(bar.title).toMatch(/34/);
  });

  it("renders WO id and FRD in mono style below title", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    const meta = screen.getByTestId("timeline-gantt-meta-WO-01-001");
    expect(meta.textContent).toContain("WO-01-001");
    expect(meta.textContent).toContain("FRD-01");
  });

  it("AC-12-003.1 — renders nested task bars for each WO", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    // Both tasks should appear as sub-bars
    expect(screen.getByTestId("timeline-gantt-task-WO-01-001-0")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-task-WO-01-001-1")).toBeTruthy();
  });

  it("task bars have reduced opacity (faint sub-bars)", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    const taskBar = screen.getByTestId("timeline-gantt-task-bar-WO-01-001-0");
    // The style should include opacity ~0.55
    const style = taskBar.getAttribute("style") ?? "";
    expect(style).toMatch(/opacity/);
  });

  // AC-12-003.2 — jump-to-first-error
  it("AC-12-003.2 — renders jump-to-first-error note when a fail WO exists", () => {
    render(<TimelineView workOrders={[DONE_WO, FAIL_WO]} total={62} />);
    const jumpNote = screen.getByTestId("timeline-gantt-first-error");
    expect(jumpNote).toBeTruthy();
    expect(jumpNote.textContent).toContain("WO-01-002");
  });

  it("AC-12-003.2 — no jump-to-error note when all WOs are done", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    expect(screen.queryByTestId("timeline-gantt-first-error")).toBeNull();
  });

  // Time axis
  it("renders a time axis with 0, midpoint and total values", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={100} />);
    const axis = screen.getByTestId("timeline-gantt-axis");
    expect(axis.textContent).toContain("0");
    expect(axis.textContent).toContain("50");
    expect(axis.textContent).toContain("100");
  });

  // Legend
  it("renders the legend with timeline icon", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    expect(screen.getByTestId("timeline-gantt-legend")).toBeTruthy();
  });

  // State icon + label (not color alone) — FRD-13 a11y
  it("renders state icon for each WO row (icon + text, not color alone)", () => {
    render(<TimelineView workOrders={[DONE_WO, FAIL_WO, PROGRESS_WO]} total={84} />);
    // Icons should be present as Tabler icons
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-001")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-002")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-003")).toBeTruthy();
  });

  // tabular-nums on duration labels
  it("renders duration text on each bar with tabular-nums", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    const bar = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    // Should show "34m" inside the bar
    expect(bar.textContent).toMatch(/\d+m/);
  });

  // Empty state
  it("renders empty state when no work orders provided", () => {
    render(<TimelineView workOrders={[]} total={0} />);
    expect(screen.getByTestId("timeline-gantt-empty")).toBeTruthy();
  });

  // State colors — different states produce different CSS variable references
  it("uses status-specific CSS token colors (no hardcoded hex)", () => {
    render(<TimelineView workOrders={[DONE_WO, FAIL_WO, PROGRESS_WO, TODO_WO]} total={102} />);
    const doneBar = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    const failBar = screen.getByTestId("timeline-gantt-bar-WO-01-002");
    const progressBar = screen.getByTestId("timeline-gantt-bar-WO-01-003");
    const todoBar = screen.getByTestId("timeline-gantt-bar-WO-01-004");

    // Each bar should reference a CSS var for color (no hardcoded hex)
    const styles = [doneBar, failBar, progressBar, todoBar].map(
      (el) => el.getAttribute("style") ?? "",
    );
    for (const s of styles) {
      expect(s).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(s).toMatch(/var\(--/);
    }
  });

  it("renders work order state icons with Tabler CSS class", () => {
    render(<TimelineView workOrders={[DONE_WO]} total={34} />);
    const icon = screen.getByTestId("timeline-gantt-icon-WO-01-001");
    // Should have a tabler icon class (ti-*)
    const className = icon.className;
    expect(className).toMatch(/ti ti-/);
  });
});
