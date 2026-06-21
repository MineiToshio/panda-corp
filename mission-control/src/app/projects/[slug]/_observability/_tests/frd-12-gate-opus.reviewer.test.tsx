/**
 * FRD-12 gate — opus reviewer adversarial integration (DR-015).
 *
 * Exercises WO-12-005 (ObservabilidadTab + TimelineView) and WO-12-006 (the REAL
 * Dagre WoDag) TOGETHER, against the integration seams the per-WO suites miss:
 *
 *   - The existing ObservabilidadTab suite MOCKS WoDag with a stub, so the
 *     real toggle→DAG mount (AC-12-002.3) and the shared static WO data flowing
 *     into the real Dagre graph were never verified end-to-end. Here WoDag is REAL.
 *   - The live seam `deriveGanttOrders → toTimeline` (WO-12-004) is only tested
 *     in the tab with a null snapshot. Here we drive a real EventsSnapshot with
 *     `fail`/`ok`/`running` events and assert the timeline reflects it (AC-12-005.1).
 *   - Cross-view consistency (AC-12-003.2 ↔ AC-12-004.3): the SAME failed WO must
 *     be the located "first error" in BOTH the timeline and the DAG over one dataset.
 *   - DR-062: exactly one shared SubTabs `role=tablist`, no forked switcher.
 *
 * useLiveSnapshot is mocked per-test via a module-level mutable so we can inject
 * different snapshots without re-mocking. WoDag is intentionally NOT mocked.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, EventsSnapshot } from "@/lib/events/events";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { ObservabilidadTab } from "../ObservabilidadTab/ObservabilidadTab";

// ---------------------------------------------------------------------------
// Live snapshot injection — mutable so each test drives its own data.
// WoDag is REAL here (not stubbed): this is true WO-12-005 ↔ WO-12-006 integration.
// ---------------------------------------------------------------------------

let liveSnapshot: EventsSnapshot | null = null;

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({
    snapshot: liveSnapshot,
    connected: liveSnapshot !== null,
    lastEventAt: liveSnapshot?.lastEventAt ?? null,
  }),
}));

beforeEach(() => {
  liveSnapshot = null;
});
afterEach(() => {
  liveSnapshot = null;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures — a small dependency chain so the DAG has real edges.
// WO-A (done) → WO-B (fail) → WO-C (todo); WO-D (in_progress) is independent.
// ---------------------------------------------------------------------------

type WoWithDeps = WorkOrder & { dependsOn?: string[] };

const WO_A: WoWithDeps = {
  id: "WO-01-001",
  title: "Esquema de datos",
  frd: "FRD-01",
  state: "done",
  relPath: "docs/frds/frd-01/work-orders/wo-01-001.md",
};
const WO_B: WoWithDeps = {
  id: "WO-01-002",
  title: "CRUD de grupos",
  frd: "FRD-01",
  state: "fail",
  relPath: "docs/frds/frd-01/work-orders/wo-01-002.md",
  dependsOn: ["WO-01-001"],
};
const WO_C: WoWithDeps = {
  id: "WO-01-003",
  title: "Cálculo de deudas",
  frd: "FRD-02",
  state: "todo",
  relPath: "docs/frds/frd-02/work-orders/wo-01-003.md",
  dependsOn: ["WO-01-002"],
};
const WO_D: WoWithDeps = {
  id: "WO-01-004",
  title: "Exportar CSV",
  frd: "FRD-03",
  state: "in_progress",
  relPath: "docs/frds/frd-03/work-orders/wo-01-004.md",
};

const STATIC_WOS: WorkOrder[] = [WO_A, WO_B, WO_C, WO_D];

function makeSnapshot(events: Event[]): EventsSnapshot {
  const last = events.length > 0 ? events[events.length - 1]?.at ?? null : null;
  return { events, lastEventAt: last, byProject: {} };
}

function switchToDag(): void {
  // The toggle is the shared SubTabs primitive (DR-062): tab-dag is the DAG button.
  fireEvent.click(screen.getByTestId("tab-dag"));
}

// ---------------------------------------------------------------------------
// AC-12-002.3 — the toggle mounts the REAL Dagre DAG (not a stub), over the
// SAME static work orders the timeline uses.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · AC-12-002.3 — real DAG mounts behind the toggle", () => {
  it("switching to DAG renders the real Dagre graph (svg + nodes), not the timeline", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);

    // Default: timeline view present, no DAG svg.
    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("dag-svg-container")).toBeNull();

    switchToDag();

    // Real WoDag mounted: its svg container + a node for each WO.
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
    for (const wo of STATIC_WOS) {
      expect(screen.getByTestId(`dag-node-${wo.id}`)).toBeTruthy();
    }
    // Timeline is gone — exactly one lens at a time (no RPG view; AC-12-002.3).
    expect(screen.queryByTestId("obs-view-timeline")).toBeNull();
  });

  it("the DAG renders real dependency edges from the shared WO list (WO-B depends on WO-A)", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    switchToDag();

    const svg = screen.getByTestId("dag-svg-container");
    // The A→B and B→C edges must exist as laid-out paths (data-edge attribute).
    const edgeAB = svg.querySelector('[data-edge="WO-01-001-WO-01-002"]');
    const edgeBC = svg.querySelector('[data-edge="WO-01-002-WO-01-003"]');
    expect(edgeAB).not.toBeNull();
    expect(edgeBC).not.toBeNull();
  });

  it("toggling DAG → timeline → DAG keeps both lenses functional (no stale-state crash)", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    switchToDag();
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tab-timeline"));
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
    expect(screen.queryByTestId("dag-svg-container")).toBeNull();
    switchToDag();
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// DR-062 — exactly ONE shared tablist toggle, not a forked per-screen switcher.
// (This is the defect the previous gate rejected; assert the fix holds.)
// ---------------------------------------------------------------------------

describe("FRD-12 gate · DR-062 — single shared SubTabs toggle", () => {
  it("the lens toggle is one role=tablist with exactly the two views (no bespoke switcher)", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    const toggle = screen.getByTestId("obs-toggle");
    const tablists = toggle.querySelectorAll('[role="tablist"]');
    expect(tablists.length).toBe(1);
    const tabs = within(toggle).getAllByRole("tab");
    expect(tabs.length).toBe(2);
    expect(screen.getByTestId("tab-timeline")).toBeTruthy();
    expect(screen.getByTestId("tab-dag")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-12-005.1 — live events flow through deriveGanttOrders → toTimeline (WO-12-004)
// into the REAL timeline. The per-WO suite only ever exercised the null snapshot.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · AC-12-005.1 — live snapshot drives the timeline", () => {
  it("a fail event on WO-B surfaces a fail bar + the jump-to-first-error note", () => {
    // WO-A finishes ok; WO-B fails. Both carry a terminal status so toTimeline
    // gives them an end + duration (a real Gantt row, not the static fallback).
    liveSnapshot = makeSnapshot([
      { event: "WorkOrderStarted", at: "2026-06-21T10:00:00Z", workOrder: "WO-01-001" },
      { event: "WorkOrderDone", at: "2026-06-21T10:05:00Z", workOrder: "WO-01-001", status: "ok" },
      { event: "WorkOrderStarted", at: "2026-06-21T10:05:00Z", workOrder: "WO-01-002" },
      {
        event: "WorkOrderFailed",
        at: "2026-06-21T10:12:00Z",
        workOrder: "WO-01-002",
        status: "fail",
      },
    ]);

    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);

    // The fail bar must be the live WO-B (resolved title via the static list).
    const note = screen.getByTestId("timeline-gantt-first-error");
    expect(note.textContent).toMatch(/WO-01-002/);
    // The WO-B row exists with its fail-state icon (state by icon, not color alone).
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-002")).toBeTruthy();
  });

  it("the live duration is derived from the event timestamps, not the 20-min static slot", () => {
    // WO-A spans 10:00→10:30 = 30 minutes. The static fallback would emit 20m.
    liveSnapshot = makeSnapshot([
      { event: "WorkOrderStarted", at: "2026-06-21T10:00:00Z", workOrder: "WO-01-001" },
      { event: "WorkOrderDone", at: "2026-06-21T10:30:00Z", workOrder: "WO-01-001", status: "ok" },
    ]);

    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);

    const bar = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    // 30-minute duration label — proves the live seam ran (static fallback => "20m").
    expect(bar.textContent).toMatch(/30m/);
    expect(bar.textContent).not.toMatch(/20m/);
  });
});

// ---------------------------------------------------------------------------
// AC-12-005.2 — no fabricated progress: with no live snapshot the timeline shows
// the static WO states verbatim (a "todo" WO never renders as "done").
// ---------------------------------------------------------------------------

describe("FRD-12 gate · AC-12-005.2 — no fabricated progress without events", () => {
  it("with a null snapshot, a todo WO keeps its todo icon (no invented completion)", () => {
    liveSnapshot = null;
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    // WO-C is "todo" → ti-circle (todo icon), never ti-circle-check (done).
    const icon = screen.getByTestId("timeline-gantt-icon-WO-01-003");
    expect(icon.className).toMatch(/ti-circle\b/);
    expect(icon.className).not.toMatch(/ti-circle-check/);
  });

  it("an empty snapshot (events: []) falls back to static, never crashes the toggle", () => {
    liveSnapshot = makeSnapshot([]);
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
    switchToDag();
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Cross-view consistency — AC-12-003.2 (timeline) ↔ AC-12-004.3 (DAG): the SAME
// failed WO is located as the first error in BOTH lenses over one dataset.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · cross-view first-error consistency", () => {
  it("timeline first-error note and DAG jump-to-error target the same WO (WO-B)", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);

    // Timeline: first-error note names WO-B.
    expect(screen.getByTestId("timeline-gantt-first-error").textContent).toMatch(/WO-01-002/);

    // DAG: jump-to-error selects WO-B (its node becomes the active node).
    switchToDag();
    fireEvent.click(screen.getByTestId("dag-jump-error"));
    const failNode = screen.getByTestId("dag-node-WO-01-002");
    expect(failNode.getAttribute("data-active")).toBe("true");
    expect(failNode.getAttribute("aria-pressed")).toBe("true");
  });

  it("AC-12-004.2 — selecting WO-B highlights its chain and dims unrelated WO-D", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    switchToDag();

    fireEvent.click(screen.getByTestId("dag-node-WO-01-002"));
    // WO-D is independent of the A→B→C chain → dimmed.
    const independent = screen.getByTestId("dag-node-WO-01-004");
    expect(independent.style.opacity).toBe("0.32");
    // WO-A (upstream of B) and WO-C (downstream of B) stay in the chain → not dimmed.
    expect(screen.getByTestId("dag-node-WO-01-001").style.opacity).not.toBe("0.32");
    expect(screen.getByTestId("dag-node-WO-01-003").style.opacity).not.toBe("0.32");
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.4 — follow-active marks the running WO. With WO-D in_progress (static)
// and no live override, turning follow ON must mark WO-D.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · AC-12-004.4 — follow-active marks the running WO", () => {
  it("follow ON adds the '▶ paso activo' caption to the in_progress WO-D", () => {
    render(<ObservabilidadTab workOrders={STATIC_WOS} project="p" />);
    switchToDag();

    // Off by default — no caption yet.
    expect(screen.queryByTestId("dag-node-active-caption-WO-01-004")).toBeNull();

    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    expect(screen.getByTestId("dag-node-active-caption-WO-01-004")).toBeTruthy();
  });
});
