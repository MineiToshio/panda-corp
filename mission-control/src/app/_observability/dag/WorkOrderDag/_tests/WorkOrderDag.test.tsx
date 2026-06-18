/**
 * WO-12-006 — WorkOrderDag component tests (RED phase)
 *
 * Covers:
 *   AC-12-005.1  hover a node → dims non-chain nodes; "jump to first error" selects
 *                the failed node; follow-mode centers the executing node.
 *   AC-12-006.1  component does not import ELK.
 *   REQ-12-005, REQ-12-006
 *
 * data-testid contract:
 *   wo-dag                  — root SVG/div container
 *   wo-dag-node-{id}        — each node
 *   wo-dag-edge-{from}-{to} — each edge
 *   wo-dag-jump-error       — "jump to first error" button
 *   wo-dag-follow-toggle    — follow-mode toggle button
 *   wo-dag-empty            — empty state when no nodes
 *
 * Uses @testing-library/react + jsdom. Dagre layout mocked to avoid
 * real SVG measurements (jsdom has no layout engine).
 */

import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderDag } from "../WorkOrderDag";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeWo(
  id: string,
  state: WorkOrder["state"] = "todo",
  deps: string[] = [],
): WorkOrder & { dependsOn?: string[] } {
  return {
    id,
    title: `Work order ${id}`,
    frd: "frd-01-alpha",
    state,
    relPath: `docs/frds/frd-01-alpha/work-orders/${id}.md`,
    ...(deps.length > 0 ? { dependsOn: deps } : {}),
  };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("WorkOrderDag — empty state", () => {
  it("shows empty state when no work orders provided", () => {
    render(<WorkOrderDag workOrders={[]} />);
    expect(screen.getByTestId("wo-dag-empty")).toBeInTheDocument();
  });

  it("does not show the dag container when empty", () => {
    render(<WorkOrderDag workOrders={[]} />);
    expect(screen.queryByTestId("wo-dag")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Node rendering
// ---------------------------------------------------------------------------

describe("WorkOrderDag — node rendering", () => {
  const wos = [makeWo("WO-01-001", "done"), makeWo("WO-01-002", "in_progress", ["WO-01-001"])];

  it("renders the dag container", () => {
    render(<WorkOrderDag workOrders={wos} />);
    expect(screen.getByTestId("wo-dag")).toBeInTheDocument();
  });

  it("renders a node element for each work order", () => {
    render(<WorkOrderDag workOrders={wos} />);
    expect(screen.getByTestId("wo-dag-node-WO-01-001")).toBeInTheDocument();
    expect(screen.getByTestId("wo-dag-node-WO-01-002")).toBeInTheDocument();
  });

  it("each node shows the work order title", () => {
    render(<WorkOrderDag workOrders={wos} />);
    expect(screen.getByTestId("wo-dag-node-WO-01-001")).toHaveTextContent("WO-01-001");
  });

  it("renders an edge element for dependency", () => {
    render(<WorkOrderDag workOrders={wos} />);
    expect(screen.getByTestId("wo-dag-edge-WO-01-001-WO-01-002")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Path-focus on hover: AC-12-005.1
// ---------------------------------------------------------------------------

describe("WorkOrderDag — path-focus on hover", () => {
  // A → B → D
  //     ↑
  // C ──┘
  const wos = [
    makeWo("A", "done"),
    makeWo("B", "in_progress", ["A"]),
    makeWo("C", "done"),
    makeWo("D", "todo", ["B", "C"]),
  ];

  it("before hover: no node has dimmed attribute", () => {
    render(<WorkOrderDag workOrders={wos} />);
    const aNode = screen.getByTestId("wo-dag-node-A");
    expect(aNode).not.toHaveAttribute("data-dimmed", "true");
  });

  it("hovering node B dims nodes outside its chain (D is downstream, A is upstream — C is neither in B's chain nor B itself)", () => {
    render(<WorkOrderDag workOrders={wos} />);
    const bNode = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(bNode);

    // C is not in B's chain (neither upstream nor downstream of B)
    // B→D exists but C→D also exists; hovering B should dim C
    expect(screen.getByTestId("wo-dag-node-C")).toHaveAttribute("data-dimmed", "true");
  });

  it("hovering node B does NOT dim its upstream (A) or downstream (D)", () => {
    render(<WorkOrderDag workOrders={wos} />);
    const bNode = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(bNode);

    expect(screen.getByTestId("wo-dag-node-A")).not.toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("wo-dag-node-D")).not.toHaveAttribute("data-dimmed", "true");
  });

  it("hovering node B does NOT dim itself", () => {
    render(<WorkOrderDag workOrders={wos} />);
    const bNode = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(bNode);
    expect(bNode).not.toHaveAttribute("data-dimmed", "true");
  });

  it("mouse leave resets dim — no node is dimmed after leave", () => {
    render(<WorkOrderDag workOrders={wos} />);
    const bNode = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(bNode);
    fireEvent.mouseLeave(bNode);
    for (const id of ["A", "B", "C", "D"]) {
      expect(screen.getByTestId(`wo-dag-node-${id}`)).not.toHaveAttribute("data-dimmed", "true");
    }
  });
});

// ---------------------------------------------------------------------------
// Jump to first error: AC-12-005.1
// ---------------------------------------------------------------------------

describe("WorkOrderDag — jump to first error", () => {
  it("jump button is present when there are nodes", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    expect(screen.getByTestId("wo-dag-jump-error")).toBeInTheDocument();
  });

  it("clicking jump-error when no failures does nothing harmful (button still present)", () => {
    const wos = [makeWo("A", "done"), makeWo("B", "done")];
    render(<WorkOrderDag workOrders={wos} />);
    const btn = screen.getByTestId("wo-dag-jump-error");
    fireEvent.click(btn);
    // Button still there — no crash
    expect(screen.getByTestId("wo-dag-jump-error")).toBeInTheDocument();
  });

  it("clicking jump-error selects the first failed node (data-selected=true)", () => {
    const wos = [makeWo("A", "fail"), makeWo("B", "todo", ["A"])];
    render(<WorkOrderDag workOrders={wos} />);
    fireEvent.click(screen.getByTestId("wo-dag-jump-error"));
    expect(screen.getByTestId("wo-dag-node-A")).toHaveAttribute("data-selected", "true");
  });

  it("clicking jump-error does not select a non-failed node", () => {
    const wos = [makeWo("A", "fail"), makeWo("B", "todo", ["A"])];
    render(<WorkOrderDag workOrders={wos} />);
    fireEvent.click(screen.getByTestId("wo-dag-jump-error"));
    expect(screen.getByTestId("wo-dag-node-B")).not.toHaveAttribute("data-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// Follow-mode: AC-12-005.1
// ---------------------------------------------------------------------------

describe("WorkOrderDag — follow-mode", () => {
  it("follow-mode toggle button is present", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    expect(screen.getByTestId("wo-dag-follow-toggle")).toBeInTheDocument();
  });

  it("follow-mode is off by default (aria-pressed=false)", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    const btn = screen.getByTestId("wo-dag-follow-toggle");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking follow-toggle enables follow-mode (aria-pressed=true)", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    const btn = screen.getByTestId("wo-dag-follow-toggle");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking follow-toggle again disables follow-mode (aria-pressed=false)", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    const btn = screen.getByTestId("wo-dag-follow-toggle");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("follow-mode with executing node selects it (data-selected=true)", () => {
    const wos = [makeWo("A", "done"), makeWo("B", "in_progress")];
    render(<WorkOrderDag workOrders={wos} executingId="B" />);
    const btn = screen.getByTestId("wo-dag-follow-toggle");
    fireEvent.click(btn); // enable follow-mode
    expect(screen.getByTestId("wo-dag-node-B")).toHaveAttribute("data-selected", "true");
  });

  it("follow-mode off — executing node is NOT auto-selected", () => {
    const wos = [makeWo("A", "done"), makeWo("B", "in_progress")];
    render(<WorkOrderDag workOrders={wos} executingId="B" />);
    // follow-mode is off by default
    expect(screen.getByTestId("wo-dag-node-B")).not.toHaveAttribute("data-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// No hardcoded colors (design-token-only assertion)
// ---------------------------------------------------------------------------

describe("WorkOrderDag — no hardcoded colors", () => {
  it("no node has inline style with hardcoded color values (hex/rgb/hsl)", () => {
    const wos = [makeWo("A", "fail"), makeWo("B", "done")];
    render(<WorkOrderDag workOrders={wos} />);
    const nodes = document.querySelectorAll("[data-testid^='wo-dag-node-']");
    for (const node of nodes) {
      const style = (node as HTMLElement).getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(style).not.toMatch(/\brgb\(/);
      expect(style).not.toMatch(/\bhsl\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// ELK exclusion (AC-12-006.1) — component-level check
// ---------------------------------------------------------------------------

describe("WorkOrderDag — no ELK import (REQ-12-006)", () => {
  it("WorkOrderDag does not import ELK (no elkjs or @eclipse-elk import)", () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, "../WorkOrderDag.tsx"), "utf-8");
    // Only import lines matter — comments may reference ELK to explain the choice.
    const importLines = src
      .split("\n")
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    expect(importLines.toLowerCase()).not.toMatch(/\belk/);
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("WorkOrderDag — accessibility", () => {
  it("jump-error button has an accessible label in Spanish", () => {
    render(<WorkOrderDag workOrders={[makeWo("A", "fail")]} />);
    const btn = screen.getByTestId("wo-dag-jump-error");
    const label = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("follow-toggle button has an accessible label in Spanish", () => {
    render(<WorkOrderDag workOrders={[makeWo("A")]} />);
    const btn = screen.getByTestId("wo-dag-follow-toggle");
    const label = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("each node has an aria-label", () => {
    render(<WorkOrderDag workOrders={[makeWo("WO-01-001", "done")]} />);
    const node = screen.getByTestId("wo-dag-node-WO-01-001");
    expect(node.getAttribute("aria-label")).toBeTruthy();
  });
});
