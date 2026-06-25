"use client";

/**
 * WoDag — Work-order dependency graph, 2D COMPOUND (cluster) view (FRD-12).
 *
 * Ported from the approved prototype docs/design/prototype/dag-2d.html:
 *   - Each FRD is an opaque rounded BOX; boxes are positioned by a deterministic
 *     seeded force sim + AABB no-overlap pass (see ./layout.ts + ./forceLayout.ts).
 *   - WO cards live inside each box, laid out by intra-FRD dependency rank.
 *   - Edges at two levels: cross-FRD lines (aggregated FRD→FRD, drawn BEHIND the
 *     opaque boxes) and intra-FRD WO→WO lines (drawn ON TOP of the boxes).
 *   - Color-on-select: at rest all edges are uniform accent. On hover (nothing
 *     pinned) OR click-to-pin a card, its intra transitive chain + its FRD's
 *     immediate FRD neighbors light up, each highlighted line takes a DISTINCT
 *     trace-palette color, and everything else dims. Click again / empty = clear.
 *
 * DETERMINISM + LIVE DATA: the layout is computed from STRUCTURE ONLY (WO ids +
 * deps + frd) in a memo keyed on that structure — never on the live snapshot, so
 * boxes never jump when a WO's state changes. Live state updates ONLY recolor
 * cards (a separate memo merges live state into a state-by-id map).
 *
 * PRESERVES the controls/hooks: useDagZoom (zoom/pan/grab), useFullscreen, the
 * Controls bar (jump-to-error, follow-active), ZoomControls, Legend, empty state.
 *
 * Traceability: CMP-12-dag → REQ-12-004/005 → AC-12-004.1/2/3/4, AC-12-005.1/2
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { firstError, toDag } from "@/app/_observability/dag/dag/dag";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { Controls } from "./Controls";
import { DagCanvas } from "./DagCanvas";
import { deriveDeps } from "./deps";
import { Legend } from "./Legend";
import { computeLayout } from "./layout";
import { useDagZoom } from "./useDagZoom";
import { useFullscreen } from "./useFullscreen";
import { ZoomControls } from "./ZoomControls";

export interface WoDagProps {
  /** Static work order list from lib/work-orders (server-read). */
  workOrders: WorkOrder[];
  /** Project slug — scopes the useLiveSnapshot subscription. */
  project?: string;
}

type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

const PANEL_STYLE: React.CSSProperties = {
  background: "var(--color-panel)",
  border: "0.5px solid var(--color-border)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "12px 14px",
};

// ---------------------------------------------------------------------------
// Structure (stable → layout) vs state (live → card color), kept separate so a
// live state change never recomputes positions (no node jumping). The static
// `workOrders` prop is the structure (ids + deps + frd); the live `snapshot`
// only feeds the per-card state recolor below.
// ---------------------------------------------------------------------------

/** Map of WO id → live-effective state (static state overridden by last event). */
function buildLiveStateById(
  workOrders: WorkOrder[],
  snapshot: ReturnType<typeof useLiveSnapshot>["snapshot"],
): Map<string, WorkOrderState> {
  const out = new Map<string, WorkOrderState>();
  for (const wo of workOrders) {
    let state: WorkOrderState = wo.state;
    if (snapshot !== null) {
      const events = snapshot.events.filter((e) => e.workOrder === wo.id);
      const last = events[events.length - 1];
      if (last) {
        if (last.status === "ok") state = "done";
        else if (last.status === "fail") state = "fail";
        else state = "in_progress";
      }
    }
    out.set(wo.id.trim(), state);
  }
  return out;
}

/**
 * WoDag — the 2D compound work-order dependency graph with chain/neighbor
 * highlight, jump-to-error, follow-active-step and live state recolor.
 */
export function WoDag({ workOrders, project }: WoDagProps): React.JSX.Element {
  const { snapshot } = useLiveSnapshot({ project });

  // STRUCTURE → layout. `workOrders` is the STATIC server-read prop: it carries
  // the WO ids + deps + frd and does NOT change on a live update (those arrive
  // via `snapshot`). So keying the layout on `[workOrders]` is both correct and
  // stable — the deterministic, costly layout is computed once per structure and
  // never recomputed on a state change (no node jumping). The structureKey helper
  // documents the exact fields the layout depends on.
  const structure = useMemo(() => {
    const withDeps = deriveDeps(workOrders as WorkOrderWithDeps[]);
    const { nodes, edges } = toDag(withDeps);
    return { nodes, edges, layout: computeLayout(nodes, edges) };
  }, [workOrders]);
  const { nodes, edges, layout } = structure;

  // STATE → card color (live). Recomputing this does NOT touch the layout.
  const liveStateById = useMemo(
    () => buildLiveStateById(workOrders, snapshot),
    [workOrders, snapshot],
  );

  // First-error + running WO derived from the LIVE state, over the stable graph.
  const liveNodes = useMemo(
    () => nodes.map((n) => ({ ...n, state: liveStateById.get(n.id) ?? n.state })),
    [nodes, liveStateById],
  );
  const firstErrorId = useMemo(() => firstError(liveNodes, edges), [liveNodes, edges]);
  const runningNode = useMemo(
    () => liveNodes.find((n) => n.state === "in_progress") ?? null,
    [liveNodes],
  );

  const { scale, containerRef, isPanning, zoomIn, zoomOut, reset, fitToView } = useDagZoom();
  const panelRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(panelRef);

  // Pin (click) vs hover. Pin wins; hover only lights when nothing is pinned.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [followActive, setFollowActive] = useState(false);

  // The active selection: pinned beats hover (matches the prototype).
  const selectedId = pinnedId ?? hoverId;

  const handleSelect = useCallback((id: string) => {
    setPinnedId((prev) => (prev === id ? null : id));
  }, []);
  const handleHover = useCallback((id: string | null) => setHoverId(id), []);
  const handleClearChain = useCallback(() => setPinnedId(null), []);
  const handleJumpError = useCallback(() => {
    if (firstErrorId !== null) setPinnedId(firstErrorId);
  }, [firstErrorId]);
  const handleFollowToggle = useCallback(() => setFollowActive((p) => !p), []);
  const handleFit = useCallback(
    () => fitToView(layout.width, layout.height),
    [fitToView, layout.width, layout.height],
  );
  const handleBackgroundClick = useCallback(() => setPinnedId(null), []);

  if (nodes.length === 0) {
    return (
      <div data-testid="wo-dag" style={PANEL_STYLE}>
        <Legend />
        <div
          data-testid="dag-empty"
          style={{
            padding: "24px 16px",
            fontSize: "12px",
            color: "var(--color-text3)",
            textAlign: "center",
          }}
        >
          Los work orders se generan en /pandacorp:blueprint
        </div>
      </div>
    );
  }

  const panelStyle: React.CSSProperties = isFullscreen
    ? { ...PANEL_STYLE, height: "100%", display: "flex", flexDirection: "column", borderRadius: 0 }
    : PANEL_STYLE;
  const canvasWrapperStyle: React.CSSProperties = isFullscreen
    ? { position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
    : { position: "relative" };
  const scrollContainerStyle: React.CSSProperties = {
    overflow: "auto",
    border: "0.5px solid var(--color-border)",
    borderRadius: "var(--radius-md, 8px)",
    background: "var(--color-canvas)",
    padding: "8px",
    cursor: isPanning ? "grabbing" : "grab",
    userSelect: "none",
    ...(isFullscreen
      ? { flex: 1, minHeight: 0, maxHeight: "none" }
      : { maxHeight: "min(68vh, 680px)" }),
  };

  return (
    <div data-testid="wo-dag" ref={panelRef} style={panelStyle}>
      <Legend />
      <Controls
        firstErrorId={firstErrorId}
        followActive={followActive}
        activeNodeId={pinnedId}
        onJumpError={handleJumpError}
        onFollowToggle={handleFollowToggle}
        onClearChain={handleClearChain}
      />
      <div style={canvasWrapperStyle}>
        <ZoomControls
          scale={scale}
          isFullscreen={isFullscreen}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={reset}
          onFit={handleFit}
          onToggleFullscreen={toggleFullscreen}
        />
        <div ref={containerRef} data-testid="dag-svg-container" style={scrollContainerStyle}>
          <DagCanvas
            layout={layout}
            nodes={nodes}
            edges={edges}
            liveStateById={liveStateById}
            selectedId={selectedId}
            followActive={followActive}
            runningId={runningNode?.id ?? null}
            scale={scale}
            onSelect={handleSelect}
            onHover={handleHover}
            onBackgroundClick={handleBackgroundClick}
          />
        </div>
      </div>
    </div>
  );
}
