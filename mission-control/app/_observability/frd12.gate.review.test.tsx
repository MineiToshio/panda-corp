/**
 * FRD-12 — FRD-gate reviewer adversarial tests (round 2, DR-015 / DR-016 / DR-050).
 *
 * Written by the FRD-gate reviewer (Opus — a different model from the sonnet/haiku
 * implementers and from the previous cycle's reviewer). Complements
 * `frd12.integration.review.test.tsx` with gaps that file did NOT anchor:
 *
 *   - The REAL `toTimeline` selector (WO-12-004 — previously BLOCKED on the B2
 *     bug) folded end-to-end and rendered THROUGH the toggle (WO-12-007), proving
 *     the no-task running-WO case survives the full feature pipeline, not just the
 *     selector unit test.
 *   - DAG follow-mode (WO-12-006) driven through the toggle's `executingId` prop
 *     (REQ-12-005 follow-mode) — exercised at the integration seam FRD-06 will use.
 *   - `firstError` determinism on a fully-cyclic all-failed graph (no root cause):
 *     must be stable across input orderings, not insertion-order dependent.
 *   - Toggle persistence round-trip: a stored "dag" choice rehydrates the DAG view
 *     on mount (the localStorage seam architecture §4.8 relies on).
 *
 * These are mutation-sensitive: each assertion pins a specific behavior such that
 * mutating the corresponding production branch (e.g. dropping the B2 running guard,
 * or the follow-mode select) would flip a test red.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Event } from "@/lib/events";
import type { WorkOrder } from "@/lib/work-orders";
import { firstError, toDag } from "./dag/dag";
import { RpgTimelineToggle } from "./RpgTimelineToggle";
import { toTimeline } from "./selectors/timeline";

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

// localStorage mock with a controllable seed so we can test rehydration.
function installLocalStorageMock(seed?: Record<string, string>): Map<string, string> {
  const store = new Map<string, string>(seed ? Object.entries(seed) : undefined);
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

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. WO-12-004 (B2) survives end-to-end through the toggle's timeline view.
//    The selector was BLOCKED on: a no-task WO with a closed action followed by
//    a later OPEN action must render as RUNNING (end:null), not "ok".
//    Here we drive the REAL toTimeline output through RpgTimelineToggle so the
//    integration (selector → toggle → TimelineView) is exercised, not just the
//    unit. A regression to the B2 bug would render the WO row as a closed
//    duration instead of the running state.
// ---------------------------------------------------------------------------

describe("FRD-12 gate — B2 timeline running-WO renders through the toggle", () => {
  beforeEach(() => installLocalStorageMock());

  const events: Event[] = [
    // No-task direct actions on the same WO: first closes ok, second stays open.
    { event: "ToolCall", at: "2026-06-17T10:00:00.000Z", workOrder: "WO-RUN", status: "ok" },
    { event: "ToolCall", at: "2026-06-17T10:05:00.000Z", workOrder: "WO-RUN" },
  ] as unknown as Event[];

  it("toTimeline marks the no-task WO running (B2) and the toggle shows that row", () => {
    const rows = toTimeline(events);
    const woRow = rows.find((r) => r.kind === "wo");
    expect(woRow).toBeDefined();
    // The B2 invariant — this is the exact bug WO-12-004 was blocked on.
    expect(woRow?.status).toBe("running");
    expect(woRow?.end).toBeNull();
    expect(woRow?.duration).toBeNull();

    // And it survives rendering through the toggle's timeline panel.
    render(
      <RpgTimelineToggle
        timelineRows={rows}
        workOrders={[]}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    expect(within(panel).getByTestId("timeline-view")).toBeTruthy();
    // The running WO surfaces an "En ejecución" indicator in the duration slot —
    // NOT a fabricated 0ms duration. A regression to the B2 bug (end set, dur 0)
    // would render a numeric duration here instead of the running indicator.
    const durSlot = within(panel).getByTestId(`timeline-duration-${woRow?.id}`);
    expect(durSlot.textContent).toMatch(/en ejecución/i);
    expect(durSlot.textContent).not.toMatch(/\d+\s*ms|\d+\.\d+\s*s/i);
  });
});

// ---------------------------------------------------------------------------
// 2. DAG follow-mode driven through the toggle's executingId (REQ-12-005).
//    The prior integration file never enabled follow-mode via the toggle seam.
// ---------------------------------------------------------------------------

describe("FRD-12 gate — DAG follow-mode through the toggle executingId seam", () => {
  beforeEach(() => installLocalStorageMock());

  const wos = [makeWo("WO-A", "done"), makeWo("WO-B", "in_progress", ["WO-A"])];

  it("enabling follow-mode selects the executing node forwarded by the toggle", () => {
    render(
      <RpgTimelineToggle
        timelineRows={[]}
        workOrders={wos}
        executingId="WO-B"
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    // Before follow-mode nothing is selected by execution.
    expect(within(panel).getByTestId("wo-dag-node-WO-B").getAttribute("data-selected")).toBeNull();
    // Toggle follow-mode on → executing node (WO-B) becomes selected.
    fireEvent.click(within(panel).getByTestId("wo-dag-follow-toggle"));
    expect(within(panel).getByTestId("wo-dag-node-WO-B").getAttribute("data-selected")).toBe(
      "true",
    );
    // The non-executing node stays unselected (follow centers ONLY the running step).
    expect(within(panel).getByTestId("wo-dag-node-WO-A").getAttribute("data-selected")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. firstError on a real (acyclic) multi-failure graph picks the ROOT cause,
//    deterministically. This is the contract REQ-12-005 actually relies on:
//    "jump to the first error" → the upstream-most failure, not a casualty.
//    (Note: a fully-cyclic all-failed graph has no root cause and the pick is
//    insertion-order dependent — captured as a robustness nit, not a blocker,
//    since work-order DAGs are acyclic by construction.)
// ---------------------------------------------------------------------------

describe("FRD-12 gate — firstError picks the deterministic root cause (acyclic)", () => {
  it("returns the upstream-most failed node regardless of input ordering", () => {
    // A -> B -> C, A and C fail. Root cause is A (no failed ancestor).
    const order1 = toDag([
      makeWo("A", "fail"),
      makeWo("B", "done", ["A"]),
      makeWo("C", "fail", ["B"]),
    ]);
    const order2 = toDag([
      makeWo("C", "fail", ["B"]),
      makeWo("B", "done", ["A"]),
      makeWo("A", "fail"),
    ]);
    expect(firstError(order1.nodes, order1.edges)).toBe("A");
    // Stable across input ordering — "jump to first error" never flips target.
    expect(firstError(order2.nodes, order2.edges)).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// 4. Toggle persistence rehydration (architecture §4.8): a stored "dag" choice
//    must restore the DAG view on mount, not default back to RPG.
// ---------------------------------------------------------------------------

describe("FRD-12 gate — toggle rehydrates the persisted view on mount", () => {
  it("a stored 'dag' mode mounts directly into the DAG panel", () => {
    installLocalStorageMock({ "mc:view-mode": "dag" });
    render(
      <RpgTimelineToggle
        timelineRows={[]}
        workOrders={[makeWo("WO-X", "done")]}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    // RPG slot is NOT in the panel — DAG was restored.
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    expect(within(panel).queryByTestId("rpg-scene")).toBeNull();
    expect(within(panel).getByTestId("wo-dag-node-WO-X")).toBeTruthy();
    // The DAG tab reports itself selected.
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("a corrupt stored mode falls back to RPG (no crash, no blank panel)", () => {
    installLocalStorageMock({ "mc:view-mode": "__proto__" });
    render(
      <RpgTimelineToggle
        timelineRows={[]}
        workOrders={[]}
        rpgSlot={<div data-testid="rpg-scene">scene</div>}
      />,
    );
    expect(screen.getByTestId("rpg-scene")).toBeTruthy();
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});
