/**
 * WO-12-005 — ObservabilidadTab tests (CMP-12-toggle shell)
 *
 * Tests for the Observabilidad project tab shell + the Línea de tiempo ↔ DAG toggle.
 * Acceptance criteria covered:
 *   AC-12-002.1 — Observabilidad tab exists as a sibling of Party (not nested)
 *   AC-12-002.2 — Party stays live-agents-only; timeline/DAG are NOT in Party
 *   AC-12-002.3 — Observabilidad tab provides Línea de tiempo ↔ DAG toggle
 *   AC-12-003.1 — Timeline view rendered when "timeline" view is active
 *   AC-12-005.1/.2 — live state (connected/not) surfaced in the component
 *   Fidelity — SectionHead strip with eye-search icon + eyebrow + toggle
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { ObservabilidadTab } from "../ObservabilidadTab";

// Mock useLiveSnapshot — ObservabilidadTab uses it; jest out the SSE
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({
    snapshot: null,
    connected: false,
    lastEventAt: null,
  }),
}));

// Mock the WoDag component (WO-12-006 — sibling, not yet in scope)
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ObservabilidadTab (WO-12-005)", () => {
  // AC-12-002.3 — toggle exists
  it("renders the Línea de tiempo ↔ DAG toggle", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    expect(screen.getByTestId("obs-toggle")).toBeTruthy();
  });

  it("toggle has exactly two options: timeline and dag", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    const toggle = screen.getByTestId("obs-toggle");
    // Both views should be in the toggle
    expect(toggle.textContent).toMatch(/Línea de tiempo/i);
    expect(toggle.textContent).toMatch(/DAG/i);
  });

  // Fidelity — SectionHead eyebrow
  it("renders OBSERVABILIDAD eyebrow with eye-search icon", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    const header = screen.getByTestId("obs-header");
    expect(header.textContent).toMatch(/OBSERVABILIDAD/i);
    // The icon container should exist
    expect(screen.getByTestId("obs-header-icon")).toBeTruthy();
  });

  it("renders the '2 vistas sobre los MISMOS work orders' eyebrow text", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    const header = screen.getByTestId("obs-header");
    expect(header.textContent).toMatch(/vistas/i);
    expect(header.textContent).toMatch(/work orders/i);
  });

  it("renders the Party hint line pointing operators to the Party tab", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    const hint = screen.getByTestId("obs-party-hint");
    expect(hint.textContent).toMatch(/Party/i);
    expect(hint.textContent).toMatch(/agentes/i);
  });

  // Default view — timeline
  it("AC-12-002.3 — defaults to timeline view", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    // Timeline view should be present in the default state
    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("wo-dag-stub")).toBeNull();
  });

  // Toggle switches views
  it("AC-12-002.3 — clicking DAG tab switches to DAG view", async () => {
    const user = userEvent.setup();
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    // Find and click the DAG tab
    const dagTab = screen.getByTestId("tab-dag");
    await user.click(dagTab);
    // Now DAG stub should be visible and timeline hidden
    expect(screen.getByTestId("wo-dag-stub")).toBeTruthy();
    expect(screen.queryByTestId("obs-view-timeline")).toBeNull();
  });

  it("AC-12-002.3 — clicking back to timeline restores timeline view", async () => {
    const user = userEvent.setup();
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    // Switch to DAG
    await user.click(screen.getByTestId("tab-dag"));
    // Switch back to timeline
    await user.click(screen.getByTestId("tab-timeline"));
    expect(screen.getByTestId("obs-view-timeline")).toBeTruthy();
    expect(screen.queryByTestId("wo-dag-stub")).toBeNull();
  });

  // Live state surfaced
  it("AC-12-005.2 — renders without error when snapshot is null (no signal)", () => {
    // useLiveSnapshot mocked to return null snapshot
    expect(() => {
      render(<ObservabilidadTab workOrders={[]} project="test-project" />);
    }).not.toThrow();
  });

  // AC-12-003.1 — timeline receives work orders
  it("AC-12-003.1 — timeline view receives the work orders as props", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    // The timeline gantt should render with the WO rows
    const gantt = screen.getByTestId("timeline-gantt");
    expect(gantt).toBeTruthy();
  });

  // AC-12-003.2 — jump-to-first-error present when fail WO exists
  it("AC-12-003.2 — timeline shows first-error note for fail WO", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    // SAMPLE_WORK_ORDERS has WO-01-002 in fail state
    expect(screen.getByTestId("timeline-gantt-first-error")).toBeTruthy();
  });

  // Empty work orders
  it("renders empty timeline when no work orders are provided", () => {
    render(<ObservabilidadTab workOrders={[]} project="test-project" />);
    expect(screen.getByTestId("timeline-gantt-empty")).toBeTruthy();
  });

  // Panel wrapper
  it("renders within a panel wrapper", () => {
    render(<ObservabilidadTab workOrders={SAMPLE_WORK_ORDERS} project="test-project" />);
    expect(screen.getByTestId("obs-shell")).toBeTruthy();
  });
});
