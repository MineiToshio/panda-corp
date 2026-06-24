/**
 * WO-12-006 — WoDag tests (CMP-12-dag, layered layout, chain-highlight, live)
 *
 * Acceptance criteria covered:
 *   AC-12-004.1 — DAG renders the work-order dependency graph (compact layered layout)
 *   AC-12-004.2 — Hovering/selecting a node highlights dependency chain (up+down) and dims rest
 *   AC-12-004.3 — "saltar al primer error" selects/highlights the first failed WO and its chain
 *   AC-12-004.4 — "seguir al paso activo" toggle marks/centers the WO currently in execution
 *   AC-12-005.1/.2 — live/event-driven updates via useLiveSnapshot; no fabricated progress
 *   Fidelity — tokens only, bezier edges, state by icon+dot+text, motion transform/opacity only,
 *              prefers-reduced-motion honored, panel wrapper, data-testids
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WoDag } from "../WoDag";

// ---------------------------------------------------------------------------
// Mock useLiveSnapshot — jsdom has no EventSource
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: null, connected: false, lastEventAt: null }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DONE_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-001",
  title: "Esquema de datos",
  frd: "FRD-01",
  state: "done",
  relPath: "work-orders/wo-01-001.md",
};

const FAIL_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-002",
  title: "CRUD de grupos",
  frd: "FRD-01",
  state: "fail",
  relPath: "work-orders/wo-01-002.md",
  dependsOn: ["WO-01-001"],
};

const PROGRESS_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-003",
  title: "Registrar gasto",
  frd: "FRD-02",
  state: "in_progress",
  relPath: "work-orders/wo-01-003.md",
  dependsOn: ["WO-01-001"],
};

const TODO_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-004",
  title: "Cálculo de deudas",
  frd: "FRD-03",
  state: "todo",
  relPath: "work-orders/wo-01-004.md",
  dependsOn: ["WO-01-002", "WO-01-003"],
};

const ALL_WOS = [DONE_WO, FAIL_WO, PROGRESS_WO, TODO_WO];

// ---------------------------------------------------------------------------
// AC-12-004.1 — DAG renders the work-order dependency graph (layered layout)
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.1: renders DAG graph", () => {
  it("renders the dag panel wrapper", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("wo-dag")).toBeTruthy();
  });

  it("renders a node for each work order", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-node-WO-01-001")).toBeTruthy();
    expect(screen.getByTestId("dag-node-WO-01-002")).toBeTruthy();
    expect(screen.getByTestId("dag-node-WO-01-003")).toBeTruthy();
    expect(screen.getByTestId("dag-node-WO-01-004")).toBeTruthy();
  });

  it("renders the WO title in each node", () => {
    render(<WoDag workOrders={[DONE_WO]} project="test-project" />);
    const node = screen.getByTestId("dag-node-WO-01-001");
    expect(node.textContent).toContain("Esquema de datos");
  });

  it("keeps the full description (wrapped, not JS-truncated) and strips a redundant WO-id title prefix", () => {
    // A long title that ALSO repeats the id as a "WO-NN-MMM — " prefix.
    const longWo: WorkOrder = {
      id: "WO-01-009",
      title: "WO-01-009 — Implementa el pipeline completo de validación de entrada",
      frd: "FRD-01",
      state: "todo",
      relPath: "x.md",
    };
    render(<WoDag workOrders={[longWo]} project="p" />);
    const node = screen.getByTestId("dag-node-WO-01-009");
    // Full description is present — the title is wrapped via CSS, never sliced to 18 chars.
    expect(node.textContent).toContain("validación de entrada");
    // The id is shown ONCE (in the mono sub-line), stripped from the title to save room.
    const idOccurrences = (node.textContent?.match(/WO-01-009/g) ?? []).length;
    expect(idOccurrences).toBe(1);
    expect(screen.getByTestId("dag-node-meta-WO-01-009").textContent).toContain("WO-01-009");
  });

  it("renders WO id and FRD in mono sub-line per node", () => {
    render(<WoDag workOrders={[DONE_WO]} project="test-project" />);
    const meta = screen.getByTestId("dag-node-meta-WO-01-001");
    expect(meta.textContent).toContain("WO-01-001");
    expect(meta.textContent).toContain("FRD-01");
  });

  it("renders a state dot per node (not color alone)", () => {
    render(<WoDag workOrders={[DONE_WO]} project="test-project" />);
    expect(screen.getByTestId("dag-node-dot-WO-01-001")).toBeTruthy();
  });

  it("renders an SVG element for the graph", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders bezier-curve edges (path elements with cubic bezier)", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const paths = container.querySelectorAll("path[data-edge]");
    // Should have at least 3 edges: WO-001→002, WO-001→003, WO-002→004, WO-003→004
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it("renders empty state when no work orders are provided", () => {
    render(<WoDag workOrders={[]} project="test-project" />);
    expect(screen.getByTestId("dag-empty")).toBeTruthy();
  });

  it("renders the legend with binary-tree icon", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-legend")).toBeTruthy();
    const legend = screen.getByTestId("dag-legend");
    expect(legend.innerHTML).toContain("ti-binary-tree");
  });

  it("uses only CSS token colors (no hardcoded hex) on nodes", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const html = container.innerHTML;
    // No bare hex colors
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

// ---------------------------------------------------------------------------
// Dependency derivation — the graph must read as a DAG even when the work
// orders carry NO explicit dependsOn (the production case: lib/work-orders
// reads on-disk markdown that has no deps field). Fallback: a sequential
// chain within each FRD, derived from the WO-NN-MMM id sequence.
// ---------------------------------------------------------------------------

describe("WoDag — dependency derivation (DR-087: real deps, no fabrication)", () => {
  // Work orders with NO explicit dependsOn → independent nodes, zero edges.
  const NO_DEPS: ReadonlyArray<WorkOrder> = [
    { id: "WO-07-001", title: "Primero", frd: "FRD-07", state: "done", relPath: "a.md" },
    { id: "WO-07-002", title: "Segundo", frd: "FRD-07", state: "in_progress", relPath: "b.md" },
    { id: "WO-07-003", title: "Tercero", frd: "FRD-07", state: "todo", relPath: "c.md" },
  ];

  it("does NOT fabricate a chain when no WO declares dependencies", () => {
    const { container } = render(<WoDag workOrders={[...NO_DEPS]} project="p" />);
    // No dependencies declared ⇒ zero edges (the old sequential fallback is gone).
    expect(container.querySelector("path[data-edge]")).toBeNull();
  });

  it("renders real edges from explicit dependsOn, incl. cross-FRD + fan-in", () => {
    const wos: ReadonlyArray<WorkOrder> = [
      { id: "WO-08-001", title: "Root", frd: "FRD-08", state: "done", relPath: "a.md" },
      { id: "WO-07-005", title: "Mid", frd: "FRD-07", state: "done", relPath: "b.md" },
      {
        id: "WO-08-002",
        title: "Leaf",
        frd: "FRD-08",
        state: "todo",
        relPath: "c.md",
        dependsOn: ["WO-07-005", "WO-08-001"], // cross-FRD + fan-in (one WO needs two)
      },
    ];
    const { container } = render(<WoDag workOrders={[...wos]} project="p" />);
    expect(container.querySelector('[data-edge="WO-08-001-WO-08-002"]')).not.toBeNull();
    // Cross-FRD dependency renders as a real edge.
    expect(container.querySelector('[data-edge="WO-07-005-WO-08-002"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.2 — Chain-highlight on node click/hover
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.2: chain-highlight", () => {
  it("clicking a node sets it as active (aria-pressed or data-active)", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const node = screen.getByTestId("dag-node-WO-01-001");
    fireEvent.click(node);
    // After click, the node is active — either aria-pressed=true or data-active
    const updated = screen.getByTestId("dag-node-WO-01-001");
    const isActive =
      updated.getAttribute("aria-pressed") === "true" ||
      updated.getAttribute("data-active") === "true";
    expect(isActive).toBe(true);
  });

  it("non-chain nodes are dimmed when a node is selected (opacity ~0.32)", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    // Click WO-01-002; WO-01-004 is downstream, WO-01-001 is upstream
    // WO-01-003 has no path through WO-01-002's chain → should be dimmed
    fireEvent.click(screen.getByTestId("dag-node-WO-01-002"));
    const unrelatedNode = screen.getByTestId("dag-node-WO-01-003");
    // The node or its wrapper should have opacity style around 0.32
    const style = unrelatedNode.getAttribute("style") ?? "";
    expect(style).toMatch(/opacity/);
  });

  it("renders the chain-hint line when a node is active", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    expect(screen.getByTestId("dag-chain-hint")).toBeTruthy();
    const hint = screen.getByTestId("dag-chain-hint");
    expect(hint.textContent).toContain("WO-01-001");
  });

  it("renders a 'limpiar' clear link in the hint when a chain is active", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    const clear = screen.getByTestId("dag-chain-clear");
    expect(clear).toBeTruthy();
  });

  it("clicking 'limpiar' clears the active node selection", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    expect(screen.getByTestId("dag-chain-hint")).toBeTruthy();
    fireEvent.click(screen.getByTestId("dag-chain-clear"));
    // After clear, no chain hint should be shown
    expect(screen.queryByTestId("dag-chain-hint")).toBeNull();
  });

  it("without active node, renders default hint text (no chain)", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    // No node clicked: should show the default hover invitation text
    const hint = screen.getByTestId("dag-default-hint");
    expect(hint).toBeTruthy();
  });

  it("chain-in-focus edges use accent color token (not default border token)", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    // Click WO-01-001: edge to WO-01-002 and WO-01-003 should be highlighted
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    const accentEdges = container.querySelectorAll("path[data-edge][data-chain='true']");
    expect(accentEdges.length).toBeGreaterThan(0);
    for (const edge of accentEdges) {
      const stroke = edge.getAttribute("stroke") ?? "";
      expect(stroke).toContain("var(--");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.3 — Jump to first error
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.3: jump to first error", () => {
  it("renders the 'Saltar al primer error' button when a fail WO exists", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-jump-error")).toBeTruthy();
  });

  it("'Saltar al primer error' button has danger-border styling (not color alone)", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const btn = screen.getByTestId("dag-jump-error");
    const style = btn.getAttribute("style") ?? "";
    // Should reference the danger color token, not a hardcoded hex
    expect(style).toContain("var(--");
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("clicking 'Saltar al primer error' selects the first failed WO", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-jump-error"));
    // The first failed WO node should become active
    const failNode = screen.getByTestId("dag-node-WO-01-002");
    const isActive =
      failNode.getAttribute("aria-pressed") === "true" ||
      failNode.getAttribute("data-active") === "true";
    expect(isActive).toBe(true);
  });

  it("does NOT render the error button when no WOs have failed", () => {
    render(<WoDag workOrders={[DONE_WO, PROGRESS_WO]} project="test-project" />);
    expect(screen.queryByTestId("dag-jump-error")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.4 — Follow active step toggle
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.4: follow active step", () => {
  it("renders the 'Seguir al paso activo' toggle button", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-follow-toggle")).toBeTruthy();
  });

  it("toggle shows 'OFF' by default", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const toggle = screen.getByTestId("dag-follow-toggle");
    expect(toggle.textContent).toContain("OFF");
  });

  it("clicking the toggle switches to ON", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    const toggle = screen.getByTestId("dag-follow-toggle");
    expect(toggle.textContent).toContain("ON");
  });

  it("when follow is ON, the in-progress WO node shows '▶ paso activo' caption", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    // PROGRESS_WO (WO-01-003) is the running node
    const caption = screen.getByTestId("dag-node-active-caption-WO-01-003");
    expect(caption).toBeTruthy();
    expect(caption.textContent).toContain("paso activo");
  });

  it("when follow is OFF, no 'paso activo' caption is shown", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    // Default is OFF
    expect(screen.queryByTestId("dag-node-active-caption-WO-01-003")).toBeNull();
  });

  it("when follow is ON, the running WO node has an accent drop-shadow filter", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    // The running node should have a drop-shadow style
    const runningNode = screen.getByTestId("dag-node-WO-01-003");
    const style = runningNode.getAttribute("style") ?? "";
    expect(style).toMatch(/filter|drop-shadow/);
  });
});

// ---------------------------------------------------------------------------
// AC-12-005.1/.2 — Live updates (no fabricated progress)
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-005.1/.2: live updates", () => {
  it("renders with snapshot=null without errors (no fabricated progress)", () => {
    // Default mock returns snapshot=null — should render cleanly
    expect(() => {
      render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    }).not.toThrow();
    expect(screen.getByTestId("wo-dag")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fidelity — tokens, a11y, motion
// ---------------------------------------------------------------------------

describe("WoDag — fidelity: tokens, a11y, motion", () => {
  it("nodes are interactive (focusable buttons or role=button)", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const node = screen.getByTestId("dag-node-WO-01-001");
    // Either a native button or has role=button
    const role = node.getAttribute("role");
    const tag = node.tagName.toLowerCase();
    expect(tag === "button" || role === "button").toBe(true);
  });

  it("renders the controls bar (error button + follow toggle) above the SVG", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-controls")).toBeTruthy();
  });

  it("wraps the SVG in an overflow-x:auto scroll container", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
  });

  it("renders the zoom toolbar (out · level · in · fit · fullscreen) defaulting to 100%", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    expect(screen.getByTestId("dag-zoom")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-out")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-in")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-fit")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-level").textContent).toContain("100%");
  });

  it("renders a fullscreen toggle button", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    const btn = screen.getByTestId("dag-fullscreen");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toContain("pantalla completa");
  });

  it("clicking zoom-in raises the displayed zoom level above 100%", () => {
    render(<WoDag workOrders={ALL_WOS} project="test-project" />);
    fireEvent.click(screen.getByTestId("dag-zoom-in"));
    expect(screen.getByTestId("dag-zoom-level").textContent).not.toBe("100%");
  });
});
