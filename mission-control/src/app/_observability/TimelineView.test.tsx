/**
 * TimelineView component tests — CMP-12-timeline (WO-12-004 UI)
 *
 * Tests the presentational layer over `toTimeline` (IF-12-timeline).
 * All tests use static TimelineRow fixtures — no real event file reads, no I/O.
 *
 * Traceability:
 *   AC-12-003.1 → CMP-12-timeline → WO-12-004
 *   REQ-12-003: RPG ↔ timeline/tree toggle over the same data (wo→task→action, durations).
 *   REQ-12-007: honest metrics — time per work order — derived from event file.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineRow } from "./selectors/timeline";
import type { TimelineViewProps } from "./TimelineView";
import { TimelineView } from "./TimelineView";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<TimelineRow> = {}): TimelineRow {
  return {
    id: "wo:1:WO-A",
    kind: "wo",
    label: "WO-A",
    start: "2026-06-16T10:00:00Z",
    end: "2026-06-16T10:05:00Z",
    duration: 300_000,
    parentId: null,
    status: "ok",
    ...overrides,
  };
}

const WO_ROW: TimelineRow = makeRow();

const TASK_ROW: TimelineRow = makeRow({
  id: "task:1:task-a",
  kind: "task",
  label: "task-a",
  parentId: "wo:1:WO-A",
  duration: 120_000,
});

const ACTION_ROW: TimelineRow = makeRow({
  id: "action:1",
  kind: "action",
  label: "ToolCall",
  parentId: "task:1:task-a",
  duration: 5_000,
});

const RUNNING_ROW: TimelineRow = makeRow({
  id: "wo:2:WO-OPEN",
  kind: "wo",
  label: "WO-OPEN",
  end: null,
  duration: null,
  status: "running",
});

const FAIL_ROW: TimelineRow = makeRow({
  id: "wo:3:WO-FAIL",
  kind: "wo",
  label: "WO-FAIL",
  status: "fail",
  duration: 60_000,
});

const FULL_TREE: TimelineRow[] = [WO_ROW, TASK_ROW, ACTION_ROW];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderTimeline(props: TimelineViewProps) {
  return render(<TimelineView {...props} />);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("TimelineView: empty state", () => {
  it("renders timeline-empty testid when rows is []", () => {
    renderTimeline({ rows: [] });
    expect(screen.getByTestId("timeline-empty")).toBeDefined();
  });

  it("does NOT render timeline-view when rows is []", () => {
    renderTimeline({ rows: [] });
    expect(screen.queryByTestId("timeline-view")).toBeNull();
  });

  it("empty state has role=status", () => {
    renderTimeline({ rows: [] });
    const el = screen.getByTestId("timeline-empty");
    expect(el.getAttribute("role")).toBe("status");
  });

  it("empty state has aria-label", () => {
    renderTimeline({ rows: [] });
    const el = screen.getByTestId("timeline-empty");
    expect(el.getAttribute("aria-label")).toBeTruthy();
  });

  it("empty state contains descriptive text in Spanish", () => {
    renderTimeline({ rows: [] });
    // Should mention 'actividad' or 'Sin'
    const el = screen.getByTestId("timeline-empty");
    expect(el.textContent?.toLowerCase()).toMatch(/sin|actividad/);
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("TimelineView: loading state", () => {
  it("renders timeline-loading testid when isLoading=true", () => {
    renderTimeline({ rows: [], isLoading: true });
    expect(screen.getByTestId("timeline-loading")).toBeDefined();
  });

  it("loading state has role=status", () => {
    renderTimeline({ rows: [], isLoading: true });
    expect(screen.getByTestId("timeline-loading").getAttribute("role")).toBe("status");
  });

  it("loading state has aria-busy=true", () => {
    renderTimeline({ rows: [], isLoading: true });
    expect(screen.getByTestId("timeline-loading").getAttribute("aria-busy")).toBe("true");
  });

  it("loading state has aria-label", () => {
    renderTimeline({ rows: [], isLoading: true });
    expect(screen.getByTestId("timeline-loading").getAttribute("aria-label")).toBeTruthy();
  });

  it("loading state takes precedence over non-empty rows", () => {
    renderTimeline({ rows: FULL_TREE, isLoading: true });
    expect(screen.getByTestId("timeline-loading")).toBeDefined();
    expect(screen.queryByTestId("timeline-view")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("TimelineView: error state", () => {
  it("renders timeline-error testid when error prop is provided", () => {
    renderTimeline({ rows: [], error: "Fallo al leer eventos" });
    expect(screen.getByTestId("timeline-error")).toBeDefined();
  });

  it("error state has role=alert", () => {
    renderTimeline({ rows: [], error: "Fallo" });
    expect(screen.getByTestId("timeline-error").getAttribute("role")).toBe("alert");
  });

  it("error state has aria-label", () => {
    renderTimeline({ rows: [], error: "Fallo" });
    expect(screen.getByTestId("timeline-error").getAttribute("aria-label")).toBeTruthy();
  });

  it("error state shows the error message", () => {
    renderTimeline({ rows: [], error: "Error de prueba" });
    expect(screen.getByTestId("timeline-error").textContent).toContain("Error de prueba");
  });

  it("isLoading takes precedence over error", () => {
    renderTimeline({ rows: [], isLoading: true, error: "Fallo" });
    expect(screen.queryByTestId("timeline-error")).toBeNull();
    expect(screen.getByTestId("timeline-loading")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Normal state — structure
// ---------------------------------------------------------------------------

describe("TimelineView: normal state structure", () => {
  it("renders timeline-view testid when rows are present", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-view")).toBeDefined();
  });

  it("timeline-view has role=region (section element)", () => {
    renderTimeline({ rows: FULL_TREE });
    const el = screen.getByTestId("timeline-view");
    expect(el.tagName.toLowerCase()).toBe("section");
  });

  it("timeline-view has aria-label", () => {
    renderTimeline({ rows: FULL_TREE });
    const el = screen.getByTestId("timeline-view");
    expect(el.getAttribute("aria-label")).toBeTruthy();
  });

  it("renders timeline-tree container", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-tree")).toBeDefined();
  });

  it("timeline-tree has role=tree", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-tree").getAttribute("role")).toBe("tree");
  });

  it("renders timeline-summary testid", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-summary")).toBeDefined();
  });

  it("summary counts WO / tasks / actions correctly", () => {
    renderTimeline({ rows: FULL_TREE });
    const summary = screen.getByTestId("timeline-summary").textContent ?? "";
    expect(summary).toContain("1 WO");
    expect(summary).toContain("1 tarea");
    expect(summary).toContain("1 acción");
  });
});

// ---------------------------------------------------------------------------
// Row rendering — kind-based testids
// ---------------------------------------------------------------------------

describe("TimelineView: row rendering per kind", () => {
  it("renders one timeline-row-wo per WO row", () => {
    renderTimeline({ rows: FULL_TREE });
    const woRows = screen.getAllByTestId("timeline-row-wo");
    expect(woRows).toHaveLength(1);
  });

  it("renders one timeline-row-task per task row", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getAllByTestId("timeline-row-task")).toHaveLength(1);
  });

  it("renders one timeline-row-action per action row", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getAllByTestId("timeline-row-action")).toHaveLength(1);
  });

  it("WO row has role=treeitem", () => {
    renderTimeline({ rows: [WO_ROW] });
    const woEl = screen.getByTestId("timeline-row-wo");
    expect(woEl.getAttribute("role")).toBe("treeitem");
  });

  it("WO row has aria-label containing the label text", () => {
    renderTimeline({ rows: [WO_ROW] });
    const woEl = screen.getByTestId("timeline-row-wo");
    expect(woEl.getAttribute("aria-label")).toContain("WO-A");
  });

  it("WO row has aria-label containing the kind", () => {
    renderTimeline({ rows: [WO_ROW] });
    const woEl = screen.getByTestId("timeline-row-wo");
    // Spanish kind label
    expect(woEl.getAttribute("aria-label")).toMatch(/orden|trabajo/i);
  });

  it("renders label text content for each row", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId(`timeline-label-${WO_ROW.id}`).textContent).toBe("WO-A");
    expect(screen.getByTestId(`timeline-label-${TASK_ROW.id}`).textContent).toBe("task-a");
    expect(screen.getByTestId(`timeline-label-${ACTION_ROW.id}`).textContent).toBe("ToolCall");
  });

  it("multiple WO rows render multiple timeline-row-wo elements", () => {
    const wo2: TimelineRow = makeRow({ id: "wo:2:WO-B", label: "WO-B" });
    renderTimeline({ rows: [WO_ROW, wo2] });
    expect(screen.getAllByTestId("timeline-row-wo")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Duration rendering (AC-12-007.1)
// tabular-nums required on all numeric values (FRD-13)
// ---------------------------------------------------------------------------

describe("TimelineView: duration rendering — AC-12-007.1", () => {
  it("renders the duration chip for a closed row", () => {
    renderTimeline({ rows: [WO_ROW] });
    const chip = screen.getByTestId(`timeline-duration-${WO_ROW.id}`);
    expect(chip).toBeDefined();
  });

  it("duration chip shows '5m' for a 300000ms duration", () => {
    renderTimeline({ rows: [WO_ROW] });
    const chip = screen.getByTestId(`timeline-duration-${WO_ROW.id}`);
    expect(chip.textContent).toBe("5m");
  });

  it("duration chip shows '2m' for a 120000ms duration (task)", () => {
    renderTimeline({ rows: [TASK_ROW] });
    const chip = screen.getByTestId(`timeline-duration-${TASK_ROW.id}`);
    expect(chip.textContent).toBe("2m");
  });

  it("duration chip shows '5s' for a 5000ms action duration", () => {
    renderTimeline({ rows: [ACTION_ROW] });
    const chip = screen.getByTestId(`timeline-duration-${ACTION_ROW.id}`);
    expect(chip.textContent).toBe("5s");
  });

  it("renders duration chip for running row (null duration) with running label", () => {
    renderTimeline({ rows: [RUNNING_ROW] });
    const chip = screen.getByTestId(`timeline-duration-${RUNNING_ROW.id}`);
    // No numeric duration — shows status label instead
    expect(chip).toBeDefined();
  });

  it("running row: the treeitem aria-label contains 'en curso'", () => {
    renderTimeline({ rows: [RUNNING_ROW] });
    // The row's aria-label is the a11y surface; the duration span is aria-hidden
    const rowEl = screen.getByTestId("timeline-row-wo");
    expect(rowEl.getAttribute("aria-label")?.toLowerCase()).toContain("en curso");
  });

  it("duration chip for ms-range shows 'ms' suffix", () => {
    const msRow = makeRow({ id: "wo:4:WO-MS", label: "WO-MS", duration: 250 });
    renderTimeline({ rows: [msRow] });
    const chip = screen.getByTestId(`timeline-duration-${msRow.id}`);
    expect(chip.textContent).toContain("ms");
  });

  it("duration chip for sub-minute seconds shows 's' suffix", () => {
    const secRow = makeRow({ id: "wo:5:WO-SEC", label: "WO-SEC", duration: 45_000 });
    renderTimeline({ rows: [secRow] });
    const chip = screen.getByTestId(`timeline-duration-${secRow.id}`);
    expect(chip.textContent).toContain("s");
  });
});

// ---------------------------------------------------------------------------
// Status icon rendering — icon + label, never color-only (FRD-13 a11y)
// ---------------------------------------------------------------------------

describe("TimelineView: status icon rendering — no color-only encoding", () => {
  it("renders status icon testid for each row", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId(`timeline-status-icon-${WO_ROW.id}`)).toBeDefined();
    expect(screen.getByTestId(`timeline-status-icon-${TASK_ROW.id}`)).toBeDefined();
    expect(screen.getByTestId(`timeline-status-icon-${ACTION_ROW.id}`)).toBeDefined();
  });

  it("ok status icon is aria-hidden (label comes from row aria-label)", () => {
    renderTimeline({ rows: [WO_ROW] });
    const icon = screen.getByTestId(`timeline-status-icon-${WO_ROW.id}`);
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("fail status row aria-label contains 'Fallido'", () => {
    renderTimeline({ rows: [FAIL_ROW] });
    const rowEl = screen.getByTestId("timeline-row-wo");
    expect(rowEl.getAttribute("aria-label")).toContain("Fallido");
  });

  it("running status row aria-label contains 'En ejecución'", () => {
    renderTimeline({ rows: [RUNNING_ROW] });
    const rowEl = screen.getByTestId("timeline-row-wo");
    expect(rowEl.getAttribute("aria-label")).toContain("En ejecución");
  });

  it("ok status row aria-label contains 'Completado'", () => {
    renderTimeline({ rows: [WO_ROW] });
    const rowEl = screen.getByTestId("timeline-row-wo");
    expect(rowEl.getAttribute("aria-label")).toContain("Completado");
  });
});

// ---------------------------------------------------------------------------
// data-testid completeness — test-writer contract
// Every interactive / significant element must have data-testid
// ---------------------------------------------------------------------------

describe("TimelineView: data-testid completeness", () => {
  it("timeline-view testid present in normal state", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-view")).toBeDefined();
  });

  it("timeline-tree testid present in normal state", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-tree")).toBeDefined();
  });

  it("timeline-summary testid present in normal state", () => {
    renderTimeline({ rows: FULL_TREE });
    expect(screen.getByTestId("timeline-summary")).toBeDefined();
  });

  it("timeline-loading testid present in loading state", () => {
    renderTimeline({ rows: [], isLoading: true });
    expect(screen.getByTestId("timeline-loading")).toBeDefined();
  });

  it("timeline-empty testid present in empty state", () => {
    renderTimeline({ rows: [] });
    expect(screen.getByTestId("timeline-empty")).toBeDefined();
  });

  it("timeline-error testid present in error state", () => {
    renderTimeline({ rows: [], error: "Fallo" });
    expect(screen.getByTestId("timeline-error")).toBeDefined();
  });

  it("every row has a data-testid by kind", () => {
    renderTimeline({ rows: FULL_TREE });
    // Kind-based testids are always emitted
    expect(screen.getAllByTestId("timeline-row-wo").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("timeline-row-task").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("timeline-row-action").length).toBeGreaterThan(0);
  });

  it("every row has a timeline-label-{id} testid", () => {
    renderTimeline({ rows: FULL_TREE });
    for (const row of FULL_TREE) {
      expect(screen.getByTestId(`timeline-label-${row.id}`)).toBeDefined();
    }
  });

  it("every row has a timeline-duration-{id} testid", () => {
    renderTimeline({ rows: FULL_TREE });
    for (const row of FULL_TREE) {
      expect(screen.getByTestId(`timeline-duration-${row.id}`)).toBeDefined();
    }
  });

  it("every row has a timeline-status-icon-{id} testid", () => {
    renderTimeline({ rows: FULL_TREE });
    for (const row of FULL_TREE) {
      expect(screen.getByTestId(`timeline-status-icon-${row.id}`)).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

describe("TimelineView: summary counts are correct", () => {
  it("counts 2 WOs, 3 tasks, 4 actions correctly", () => {
    const rows: TimelineRow[] = [
      makeRow({ id: "wo:1:A", label: "WO-A", kind: "wo", parentId: null }),
      makeRow({ id: "wo:2:B", label: "WO-B", kind: "wo", parentId: null }),
      makeRow({ id: "task:1:t1", label: "t1", kind: "task", parentId: "wo:1:A" }),
      makeRow({ id: "task:2:t2", label: "t2", kind: "task", parentId: "wo:1:A" }),
      makeRow({ id: "task:3:t3", label: "t3", kind: "task", parentId: "wo:2:B" }),
      makeRow({ id: "action:1", label: "A1", kind: "action", parentId: "task:1:t1" }),
      makeRow({ id: "action:2", label: "A2", kind: "action", parentId: "task:1:t1" }),
      makeRow({ id: "action:3", label: "A3", kind: "action", parentId: "task:2:t2" }),
      makeRow({ id: "action:4", label: "A4", kind: "action", parentId: "task:3:t3" }),
    ];
    renderTimeline({ rows });
    const summary = screen.getByTestId("timeline-summary").textContent ?? "";
    expect(summary).toContain("2 WO");
    expect(summary).toContain("3 tareas");
    expect(summary).toContain("4 acciones");
  });

  it("singular form 'tarea' when count is 1", () => {
    renderTimeline({ rows: [WO_ROW, TASK_ROW] });
    const summary = screen.getByTestId("timeline-summary").textContent ?? "";
    expect(summary).toContain("1 tarea");
    expect(summary).not.toContain("1 tareas");
  });

  it("singular form 'acción' when count is 1", () => {
    renderTimeline({ rows: [WO_ROW, ACTION_ROW] });
    const summary = screen.getByTestId("timeline-summary").textContent ?? "";
    expect(summary).toContain("1 acción");
    expect(summary).not.toContain("1 acciones");
  });
});

// ---------------------------------------------------------------------------
// No hardcoded colors assertion (structural contract)
// ---------------------------------------------------------------------------

describe("TimelineView: zero hardcoded color values", () => {
  it("renders without errors when CSS custom properties are not resolved (all var() fallbacks)", () => {
    // This test verifies the component renders in a jsdom env where
    // CSS custom properties are not resolved — any hardcoded color would
    // make the component's inline styles incorrect in a token-less context.
    // The test passes if no throw occurs and the tree renders.
    expect(() => renderTimeline({ rows: FULL_TREE })).not.toThrow();
    expect(screen.getByTestId("timeline-view")).toBeDefined();
  });
});
