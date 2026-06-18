/**
 * FRD-12 — Reviewer adversarial INTEGRATION tests (DR-015 / DR-050 gate).
 *
 * Written by the FRD-gate reviewer (a different model from the implementers).
 * Exercises the THREE reviewed work orders together against edge cases the
 * implementers did NOT anchor on, plus the stable VERIFIED foundation
 * (IF-12-dag pure, IF-12-timeline rows):
 *
 *   WO-12-005  FreshnessBadge   (CMP-12-freshness)
 *   WO-12-006  WorkOrderDag     (CMP-12-dag) + dag.ts (IF-12-dag)
 *   WO-12-007  RpgTimelineToggle (CMP-12-toggle)
 *
 * Anchored in EARS:
 *   REQ-12-002  Live / No-signal + last-event timestamp.
 *   REQ-12-003  RPG ↔ timeline ↔ DAG toggle over the SAME data snapshot.
 *   REQ-12-005  DAG path-focus highlights only the dependency chain; first-error.
 *
 * Focus of the adversarial probes (the bugs that hide between work orders):
 *   - Cyclic dependency input (toDag/dagChain/firstError must terminate, not loop).
 *   - DAG view reachable through the toggle with the SAME workOrders prop.
 *   - Switching views does not re-mount / re-fetch — same snapshot identity.
 *   - FreshnessBadge with hostile/malformed lastAt (never throws, never color-only).
 *   - Path-focus invariant: a hovered node never dims itself or its full chain.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { dagChain, firstError, toDag } from "../dag/dag/dag";
import { WorkOrderDag } from "../dag/WorkOrderDag/WorkOrderDag";
import { FreshnessBadge } from "../FreshnessBadge/FreshnessBadge";
import { RpgTimelineToggle } from "../RpgTimelineToggle/RpgTimelineToggle";
import type { TimelineRow } from "../selectors/timeline/timeline";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWo(
  id: string,
  state: WorkOrder["state"] = "todo",
  deps: string[] = [],
): WorkOrder & { dependsOn?: string[] } {
  return {
    id,
    title: `WO ${id}`,
    frd: "frd-12-observability-dataviz",
    state,
    relPath: `docs/frds/frd-12-observability-dataviz/work-orders/${id}.md`,
    ...(deps.length > 0 ? { dependsOn: deps } : {}),
  };
}

const SAMPLE_ROWS: TimelineRow[] = [
  {
    id: "WO-A",
    kind: "wo",
    label: "WO A",
    start: "2026-06-17T10:00:00.000Z",
    end: "2026-06-17T10:05:00.000Z",
    duration: 300000,
    parentId: null,
    status: "ok",
  },
];

// localStorage mock so the toggle never touches a real store between tests.
function installLocalStorageMock(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  });
  return store;
}

beforeEach(() => {
  installLocalStorageMock();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. Cyclic dependencies — the BFS/first-error must terminate (REQ-12-005)
// ---------------------------------------------------------------------------

describe("FRD-12 adversarial — cyclic dependency graph", () => {
  // A→B→C→A. dependsOn is "this depends on X" => edge X -> this.
  const cyclic = [
    makeWo("A", "fail", ["C"]),
    makeWo("B", "fail", ["A"]),
    makeWo("C", "todo", ["B"]),
  ];

  it("toDag keeps every real edge of a cycle (no silent drop of in-graph deps)", () => {
    const { nodes, edges } = toDag(cyclic);
    expect(nodes).toHaveLength(3);
    // 3 edges: C->A, A->B, B->C
    expect(edges).toHaveLength(3);
  });

  it("dagChain terminates on a cycle and never includes the pivot in its own chain", () => {
    const { nodes, edges } = toDag(cyclic);
    // If this loops forever the test runner times out — that IS the assertion.
    const chain = dagChain("A", nodes, edges);
    expect(chain.up.has("A")).toBe(false);
    expect(chain.down.has("A")).toBe(false);
    // In a full 3-cycle every other node is both up and down of A.
    expect(chain.up.has("B")).toBe(true);
    expect(chain.up.has("C")).toBe(true);
    expect(chain.down.has("B")).toBe(true);
    expect(chain.down.has("C")).toBe(true);
  });

  it("firstError terminates on an all-failed cycle and returns a real failed node id", () => {
    const { nodes, edges } = toDag(cyclic);
    const id = firstError(nodes, edges);
    // Both A and B are failed and each has a failed ancestor (cycle) → no
    // root-cause; the function must still return one of the failed ids, never
    // null and never a non-failed node.
    expect(id).not.toBeNull();
    expect(["A", "B"]).toContain(id);
  });
});

// ---------------------------------------------------------------------------
// 2. Path-focus invariant when rendered (REQ-12-005, AC-12-005.1)
// ---------------------------------------------------------------------------

describe("FRD-12 adversarial — DAG path-focus dim invariant", () => {
  // Diamond: A -> B, A -> C, B -> D, C -> D.  Hover B: chain = {A up, D down}.
  // C is NOT in B's chain and MUST be dimmed; A, B, D must NOT be dimmed.
  const diamond = [
    makeWo("A", "done"),
    makeWo("B", "in_progress", ["A"]),
    makeWo("C", "todo", ["A"]),
    makeWo("D", "todo", ["B", "C"]),
  ];

  it("hovering a node dims only nodes outside its up/down chain, never itself", () => {
    render(<WorkOrderDag workOrders={diamond} />);
    const nodeB = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(nodeB);

    // B is the pivot — never dimmed.
    expect(screen.getByTestId("wo-dag-node-B").getAttribute("data-dimmed")).toBeNull();
    // A (upstream) and D (downstream) are in the chain — not dimmed.
    expect(screen.getByTestId("wo-dag-node-A").getAttribute("data-dimmed")).toBeNull();
    expect(screen.getByTestId("wo-dag-node-D").getAttribute("data-dimmed")).toBeNull();
    // C is a sibling off the chain — MUST be dimmed.
    expect(screen.getByTestId("wo-dag-node-C").getAttribute("data-dimmed")).toBe("true");
  });

  it("leaving the node clears all dimming (no stuck focus state)", () => {
    render(<WorkOrderDag workOrders={diamond} />);
    const nodeB = screen.getByTestId("wo-dag-node-B");
    fireEvent.mouseEnter(nodeB);
    fireEvent.mouseLeave(nodeB);
    for (const id of ["A", "B", "C", "D"]) {
      expect(screen.getByTestId(`wo-dag-node-${id}`).getAttribute("data-dimmed")).toBeNull();
    }
  });

  it("jump-to-first-error selects the root-cause failed node, not a downstream casualty", () => {
    // A fails; B depends on A and also fails (casualty). Root cause is A.
    const chainFail = [makeWo("A", "fail"), makeWo("B", "fail", ["A"]), makeWo("C", "done", ["B"])];
    render(<WorkOrderDag workOrders={chainFail} />);
    fireEvent.click(screen.getByTestId("wo-dag-jump-error"));
    expect(screen.getByTestId("wo-dag-node-A").getAttribute("data-selected")).toBe("true");
    expect(screen.getByTestId("wo-dag-node-B").getAttribute("data-selected")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Toggle integration — same snapshot across the three views (REQ-12-003)
// ---------------------------------------------------------------------------

describe("FRD-12 adversarial — toggle drives DAG over the SAME workOrders", () => {
  const wos = [makeWo("WO-A", "done"), makeWo("WO-B", "fail", ["WO-A"])];

  it("switching to the DAG view renders the same work orders passed once at the top", () => {
    render(
      <RpgTimelineToggle
        timelineRows={SAMPLE_ROWS}
        workOrders={wos}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    // Default RPG.
    expect(screen.getByTestId("rpg-scene")).toBeTruthy();
    // Switch to DAG — must surface the very nodes from the single workOrders prop.
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    expect(within(panel).getByTestId("wo-dag-node-WO-A")).toBeTruthy();
    expect(within(panel).getByTestId("wo-dag-node-WO-B")).toBeTruthy();
    // The DAG inside the toggle still exposes jump-to-error (failed WO-B present).
    expect(within(panel).getByTestId("wo-dag-jump-error")).toBeTruthy();
  });

  it("flipping RPG→DAG→timeline→RPG keeps exactly one panel and never throws", () => {
    render(
      <RpgTimelineToggle
        timelineRows={SAMPLE_ROWS}
        workOrders={wos}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    // Exactly one tab selected at a time.
    const selected = screen
      .getAllByRole("tab")
      .filter((b) => b.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(screen.getByTestId("rpg-scene")).toBeTruthy();
  });

  it("DAG view with an empty work-order list shows the empty state, not a crash", () => {
    render(
      <RpgTimelineToggle
        timelineRows={[]}
        workOrders={[]}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(screen.getByTestId("wo-dag-empty")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. FreshnessBadge hostile inputs (REQ-12-002, FRD-13 not-color-only)
// ---------------------------------------------------------------------------

describe("FRD-12 adversarial — FreshnessBadge resilience", () => {
  it("malformed lastAt renders the raw string and never throws (no NaN/Invalid Date leak)", () => {
    render(<FreshnessBadge live={false} lastAt="not-a-timestamp" />);
    const ts = screen.getByTestId("freshness-timestamp");
    // Falls back to the raw string, never "Invalid Date" / "NaN".
    expect(ts.textContent).toBe("not-a-timestamp");
    expect(ts.textContent).not.toMatch(/Invalid Date|NaN/);
  });

  it("stale state is distinguishable WITHOUT color — icon + label both present", () => {
    render(<FreshnessBadge live={false} lastAt={null} />);
    // Label carries the semantic state (FRD-13 — never color-alone).
    expect(screen.getByTestId("freshness-no-signal-label").textContent).toMatch(/sin señal/i);
    expect(screen.getByTestId("freshness-icon")).toBeTruthy();
    // role=status so assistive tech announces the freshness change.
    expect(screen.getByTestId("freshness-badge").getAttribute("role")).toBe("status");
  });

  it("null lastAt does not render a timestamp element (no empty/dangling node)", () => {
    render(<FreshnessBadge live={true} lastAt={null} />);
    expect(screen.queryByTestId("freshness-timestamp")).toBeNull();
    expect(screen.getByTestId("freshness-live-label").textContent).toMatch(/en vivo/i);
  });
});
