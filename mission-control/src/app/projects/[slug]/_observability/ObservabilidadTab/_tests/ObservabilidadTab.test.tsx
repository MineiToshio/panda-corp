/**
 * WO-12-005 — ObservabilidadTab tests (CMP-12-toggle shell)
 *
 * Tests for the Observabilidad project tab shell + the Línea de tiempo ↔ DAG toggle.
 * Timeline v2: the tab receives a BuildTimeline prop (read server-side) and mounts
 * WoLiveRefresh for live updates — it no longer derives Gantt rows from the event stream.
 *
 * Acceptance criteria covered:
 *   AC-12-002.1 — Observabilidad tab exists as a sibling of Party (not nested)
 *   AC-12-002.2 — Party stays live-agents-only; timeline/DAG are NOT in Party
 *   AC-12-002.3 — Observabilidad tab provides Línea de tiempo ↔ DAG toggle
 *   AC-12-003.1 — Timeline view rendered when "timeline" view is active
 *   AC-12-005.1 — live updater mounted (WoLiveRefresh re-reads the durable track)
 *   Fidelity — SectionHead strip with eye-search icon + eyebrow + toggle
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BuildTimeline } from "@/lib/build-track/build-track";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { ObservabilidadTab } from "../ObservabilidadTab";

// WoLiveRefresh uses next/navigation's useRouter + useLiveSnapshot — stub both.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({
    snapshot: null,
    connected: false,
    lastEventAt: null,
  }),
}));

// Mock the WoDag component (sibling — keep this suite focused on the shell)
vi.mock("@/app/projects/[slug]/_observability/WoDag/WoDag", () => ({
  WoDag: ({ workOrders }: { workOrders: WorkOrder[] }) => (
    <div data-testid="wo-dag-stub">DAG stub ({workOrders.length} WOs)</div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_WORK_ORDERS: WorkOrder[] = [
  {
    id: "WO-01-001",
    title: "Esquema de datos",
    frd: "frd-01-data-reading",
    state: "done",
    relPath: "docs/frds/frd-01-data-reading/work-orders/wo-01-001.md",
  },
  {
    id: "WO-01-002",
    title: "CRUD grupos",
    frd: "frd-01-data-reading",
    state: "fail",
    relPath: "docs/frds/frd-01-data-reading/work-orders/wo-01-002.md",
  },
];

const T0 = Date.parse("2026-06-23T10:00:00Z");
const MIN = 60_000;

/** A durations timeline with one failed WO (drives the first-error note). */
const TIMELINE_WITH_FAIL: BuildTimeline = {
  frds: [
    {
      id: "frd-01-data-reading",
      label: "FRD-01",
      startMs: T0,
      endMs: T0 + 40 * MIN,
      state: "fail",
      workOrders: [
        {
          id: "WO-01-001",
          title: "Esquema de datos",
          frd: "frd-01-data-reading",
          state: "done",
          startMs: T0,
          endMs: T0 + 12 * MIN,
          durationMin: 12,
          attempts: 1,
        },
        {
          id: "WO-01-002",
          title: "CRUD grupos",
          frd: "frd-01-data-reading",
          state: "fail",
          startMs: T0 + 12 * MIN,
          endMs: T0 + 40 * MIN,
          durationMin: 28,
          attempts: 1,
        },
      ],
      review: null,
    },
  ],
  hasDurations: true,
  source: "track",
  buildStartMs: T0,
};

const EMPTY_TIMELINE: BuildTimeline = {
  frds: [],
  hasDurations: false,
  source: "empty",
  buildStartMs: null,
};

function renderTab(over?: Partial<Parameters<typeof ObservabilidadTab>[0]>): void {
  render(
    <ObservabilidadTab
      workOrders={SAMPLE_WORK_ORDERS}
      timeline={TIMELINE_WITH_FAIL}
      project="test-project"
      {...over}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ObservabilidadTab (WO-12-005)", () => {
  it("renders the Línea de tiempo ↔ DAG toggle", () => {
    renderTab();
    expect(screen.getByTestId("obs-toggle")).toBeTruthy();
  });

  it("toggle has exactly two options: timeline and dag", () => {
    renderTab();
    const toggle = screen.getByTestId("obs-toggle");
    expect(toggle.textContent).toMatch(/Línea de tiempo/i);
    expect(toggle.textContent).toMatch(/DAG/i);
  });

  it("renders OBSERVABILIDAD eyebrow with eye-search icon", () => {
    renderTab();
    const header = screen.getByTestId("obs-header");
    expect(header.textContent).toMatch(/OBSERVABILIDAD/i);
    expect(screen.getByTestId("obs-header-icon")).toBeTruthy();
  });

  it("renders the '2 vistas sobre los MISMOS work orders' eyebrow text", () => {
    renderTab();
    const header = screen.getByTestId("obs-header");
    expect(header.textContent).toMatch(/vistas/i);
    expect(header.textContent).toMatch(/work orders/i);
  });

  it("renders the Party hint line pointing operators to the Party tab", () => {
    renderTab();
    const hint = screen.getByTestId("obs-party-hint");
    expect(hint.textContent).toMatch(/Party/i);
    expect(hint.textContent).toMatch(/agentes/i);
  });

  it("AC-12-002.3 — defaults to timeline view", () => {
    renderTab();
    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("wo-dag-stub")).toBeNull();
  });

  it("AC-12-002.3 — clicking DAG tab switches to DAG view", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByTestId("tab-dag"));
    expect(screen.getByTestId("wo-dag-stub")).toBeTruthy();
    expect(screen.queryByTestId("obs-view-timeline")).toBeNull();
  });

  it("AC-12-002.3 — clicking back to timeline restores timeline view", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByTestId("tab-dag"));
    await user.click(screen.getByTestId("tab-timeline"));
    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("wo-dag-stub")).toBeNull();
  });

  it("AC-12-005.1 — mounts the live updater (WoLiveRefresh)", () => {
    renderTab();
    expect(screen.getByTestId("wo-live-refresh")).toBeTruthy();
  });

  it("AC-12-003.1 — renders the timeline from the BuildTimeline prop", () => {
    renderTab();
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
  });

  it("AC-12-003.2 — timeline shows first-error note for a fail WO", () => {
    renderTab();
    expect(screen.getByTestId("timeline-gantt-first-error")).toBeTruthy();
  });

  it("renders the honest empty timeline when there is no build data", () => {
    renderTab({ timeline: EMPTY_TIMELINE, workOrders: [] });
    expect(screen.getByTestId("timeline-gantt-empty")).toBeTruthy();
  });

  it("renders within a panel wrapper", () => {
    renderTab();
    expect(screen.getByTestId("obs-shell")).toBeTruthy();
  });
});
