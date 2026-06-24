/**
 * FRD-12 gate — opus reviewer adversarial integration (DR-015).
 *
 * Exercises WO-12-005 (ObservabilidadTab + TimelineView v2) and WO-12-006 (the REAL
 * Dagre WoDag) TOGETHER, against the integration seams the per-WO suites miss:
 *
 *   - The ObservabilidadTab suite MOCKS WoDag with a stub, so the real toggle→DAG
 *     mount (AC-12-002.3) and the shared static WO data flowing into the real Dagre
 *     graph are only verified here, where WoDag is REAL.
 *   - Timeline v2: the timeline is fed by a durable BuildTimeline (read from
 *     `.pandacorp/track.jsonl`), NOT the live event stream. Here we pass a real
 *     durations BuildTimeline and assert the timeline reflects it (real bars,
 *     reopen attempts, review segment), and that the SAME failed WO is the located
 *     first error in BOTH the timeline and the DAG (AC-12-003.2 ↔ AC-12-004.3).
 *   - DR-062: exactly one shared SubTabs `role=tablist`, no forked switcher.
 *
 * useLiveSnapshot + next/navigation are stubbed (WoLiveRefresh mounts but is inert).
 * WoDag is intentionally NOT mocked.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BuildTimeline } from "@/lib/build-track/build-track";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { ObservabilidadTab } from "../ObservabilidadTab/ObservabilidadTab";

// WoLiveRefresh deps — inert here (no live driving; the timeline is the durable prop).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: null, connected: false, lastEventAt: null }),
}));

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

const T0 = Date.parse("2026-06-21T10:00:00Z");
const MIN = 60_000;

/**
 * A durations BuildTimeline mirroring the static WOs: WO-A done (30m, the seam that
 * used to prove "real, not the 20-min fake"), WO-B failed and reopened (2 attempts).
 */
const TIMELINE: BuildTimeline = {
  frds: [
    {
      id: "frd-01",
      label: "FRD-01",
      startMs: T0,
      endMs: T0 + 50 * MIN,
      state: "fail",
      workOrders: [
        {
          id: "WO-01-001",
          title: "Esquema de datos",
          frd: "frd-01",
          state: "done",
          startMs: T0,
          endMs: T0 + 30 * MIN,
          durationMin: 30,
          attempts: 1,
        },
        {
          id: "WO-01-002",
          title: "CRUD de grupos",
          frd: "frd-01",
          state: "fail",
          startMs: T0 + 30 * MIN,
          endMs: T0 + 50 * MIN,
          durationMin: 20,
          attempts: 2,
        },
      ],
      review: { startMs: null, endMs: null, verdict: null, durationMin: null },
    },
  ],
  hasDurations: true,
  source: "track",
  buildStartMs: T0,
};

function renderTab(): void {
  render(<ObservabilidadTab workOrders={STATIC_WOS} timeline={TIMELINE} project="p" />);
}

function switchToDag(): void {
  fireEvent.click(screen.getByTestId("tab-dag"));
}

// ---------------------------------------------------------------------------
// AC-12-002.3 — the toggle mounts the REAL Dagre DAG (not a stub), over the
// SAME static work orders.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · AC-12-002.3 — real DAG mounts behind the toggle", () => {
  it("switching to DAG renders the real Dagre graph (svg + nodes), not the timeline", () => {
    renderTab();

    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("dag-svg-container")).toBeNull();

    switchToDag();

    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
    for (const wo of STATIC_WOS) {
      expect(screen.getByTestId(`dag-node-${wo.id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("obs-view-timeline")).toBeNull();
  });

  it("the DAG renders real dependency edges from the shared WO list (WO-B depends on WO-A)", () => {
    renderTab();
    switchToDag();

    const svg = screen.getByTestId("dag-svg-container");
    const edgeAB = svg.querySelector('[data-edge="WO-01-001-WO-01-002"]');
    const edgeBC = svg.querySelector('[data-edge="WO-01-002-WO-01-003"]');
    expect(edgeAB).not.toBeNull();
    expect(edgeBC).not.toBeNull();
  });

  it("toggling DAG → timeline → DAG keeps both lenses functional (no stale-state crash)", () => {
    renderTab();
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
// ---------------------------------------------------------------------------

describe("FRD-12 gate · DR-062 — single shared SubTabs toggle", () => {
  it("the lens toggle is one role=tablist with exactly the two views (no bespoke switcher)", () => {
    renderTab();
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
// AC-12-003.1/005 — the durable BuildTimeline drives the timeline with REAL bars.
// (Timeline v2: durations come from the track, not fabricated 20-min slots.)
// ---------------------------------------------------------------------------

describe("FRD-12 gate · timeline v2 reflects the durable track", () => {
  it("a failed WO surfaces a fail bar + the jump-to-first-error note", () => {
    renderTab();
    const note = screen.getByTestId("timeline-gantt-first-error");
    expect(note.textContent).toMatch(/WO-01-002/);
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-002")).toBeTruthy();
  });

  it("the duration comes from the track, not a fabricated 20-min slot", () => {
    renderTab();
    const bar = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    // WO-A spans 30 minutes per the track — the old fake placeholder emitted 20m.
    expect(bar.textContent).toMatch(/30m/);
    expect(bar.textContent).not.toMatch(/20m/);
  });

  it("reopen attempts are surfaced honestly (WO-B has 2 attempts)", () => {
    renderTab();
    expect(screen.getByTestId("timeline-gantt-meta-WO-01-002").textContent).toMatch(/2 intentos/);
  });
});

// ---------------------------------------------------------------------------
// Cross-view consistency — AC-12-003.2 (timeline) ↔ AC-12-004.3 (DAG): the SAME
// failed WO is located as the first error in BOTH lenses over one dataset.
// ---------------------------------------------------------------------------

describe("FRD-12 gate · cross-view first-error consistency", () => {
  it("timeline first-error note and DAG jump-to-error target the same WO (WO-B)", () => {
    renderTab();

    expect(screen.getByTestId("timeline-gantt-first-error").textContent).toMatch(/WO-01-002/);

    switchToDag();
    fireEvent.click(screen.getByTestId("dag-jump-error"));
    const failNode = screen.getByTestId("dag-node-WO-01-002");
    expect(failNode.getAttribute("data-active")).toBe("true");
    expect(failNode.getAttribute("aria-pressed")).toBe("true");
  });

  it("AC-12-004.2 — selecting WO-B highlights its chain and dims unrelated WO-D", () => {
    renderTab();
    switchToDag();

    fireEvent.click(screen.getByTestId("dag-node-WO-01-002"));
    const independent = screen.getByTestId("dag-node-WO-01-004");
    expect(independent.style.opacity).toBe("0.32");
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
    renderTab();
    switchToDag();

    expect(screen.queryByTestId("dag-node-active-caption-WO-01-004")).toBeNull();

    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    expect(screen.getByTestId("dag-node-active-caption-WO-01-004")).toBeTruthy();
  });
});
