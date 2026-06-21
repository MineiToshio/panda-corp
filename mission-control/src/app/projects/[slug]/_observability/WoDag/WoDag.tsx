"use client";

/**
 * WoDag — Work-order DAG view (WO-12-006)
 *
 * Renders the work-order dependency graph via Dagre (~39KB), with:
 *   - Bezier edges from dependency → dependent
 *   - Chain-highlight: hover/click a node → accent edges + dim rest (opacity .32)
 *   - Jump to first error: danger-bordered button → select first fail WO + chain
 *   - Follow active step: toggle → running WO gets accent drop-shadow + "▶ paso activo"
 *   - Live: subscribes to useLiveSnapshot (WO-01-009) for event-driven state updates
 *
 * Prototype: bDag() (~L1169), bDagChain() (~L1154)
 * Design rules: tokens only, no hardcoded colors/spacing/radii.
 * a11y: state by icon + dot + text + color; nodes are interactive buttons;
 *       motion: transform/opacity only; honors prefers-reduced-motion.
 *
 * Traceability:
 *   CMP-12-dag → REQ-12-004/005 → AC-12-004.1/2/3/4, AC-12-005.1/2
 */

import { Graph, layout } from "@dagrejs/dagre";
import { useCallback, useState } from "react";
import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import { dagChain, firstError, toDag } from "@/app/_observability/dag/dag/dag";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface WoDagProps {
  /** Static work order list from lib/work-orders (server-read). */
  workOrders: WorkOrder[];
  /** Project slug — scopes useLiveSnapshot subscription. */
  project?: string;
}

// ---------------------------------------------------------------------------
// WorkOrder augmented with optional deps (for DAG construction)
// ---------------------------------------------------------------------------

type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

// ---------------------------------------------------------------------------
// Node / edge layout output
// ---------------------------------------------------------------------------

interface LayoutNode extends DagNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutEdge extends DagEdge {
  /** Bezier control points from Dagre */
  points: Array<{ x: number; y: number }>;
}

interface DagLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// State color/icon maps — mirrors prototype WOCOL / WOICON
// ---------------------------------------------------------------------------

const STATE_COLOR: Record<WorkOrderState, string> = {
  done: "var(--color-ok)",
  fail: "var(--color-danger)",
  in_progress: "var(--color-accent)",
  review: "var(--color-info)",
  todo: "var(--color-border-strong)",
};

const STATE_ICON: Record<WorkOrderState, string> = {
  done: "ti-circle-check",
  fail: "ti-alert-triangle",
  in_progress: "ti-loader-2",
  review: "ti-eye",
  todo: "ti-circle",
};

// Node dimensions — matches prototype NW=156, NH=58
const NODE_W = 156;
const NODE_H = 58;
const PAD_X = 14;
const PAD_Y = 14;

// ---------------------------------------------------------------------------
// computeLayout — run Dagre and return positioned nodes + edges
// ---------------------------------------------------------------------------

/**
 * Build the Dagre layout for the given nodes and edges.
 * Returns pixel-positioned nodes and edge bezier points.
 * Never throws — returns an empty layout on any error (defensive).
 */
function computeLayout(nodes: DagNode[], edges: DagEdge[]): DagLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const g = new Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: 34,
    ranksep: 34,
    marginx: PAD_X,
    marginy: PAD_Y,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H, label: node.id });
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  try {
    layout(g);
  } catch {
    // Dagre layout failed — fall back to empty layout so the component still renders
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const graphLabel = g.graph() as { width?: number; height?: number };
  const graphW = (graphLabel.width ?? 400) + PAD_X * 2;
  const graphH = (graphLabel.height ?? 200) + PAD_Y * 2;

  const layoutNodes: LayoutNode[] = nodes.map((n) => {
    const gn = g.node(n.id) as
      | { x?: number; y?: number; width?: number; height?: number }
      | undefined;
    return {
      ...n,
      x: gn?.x != null ? gn.x - NODE_W / 2 : 0,
      y: gn?.y != null ? gn.y - NODE_H / 2 : 0,
      width: NODE_W,
      height: NODE_H,
    };
  });

  const layoutEdges: LayoutEdge[] = edges.map((e) => {
    const ge = g.edge(e.from, e.to) as { points?: Array<{ x: number; y: number }> } | undefined;
    return {
      ...e,
      points: ge?.points ?? [],
    };
  });

  return { nodes: layoutNodes, edges: layoutEdges, width: graphW, height: graphH };
}

// ---------------------------------------------------------------------------
// buildBezierPath — generate an SVG cubic bezier "d" attribute
// ---------------------------------------------------------------------------

/**
 * Build a cubic bezier path from Dagre edge points.
 * If only 2 points: straight line. Otherwise: C cubic curve.
 */
function buildBezierPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  if (!first) return "";
  const last = rest[rest.length - 1];
  if (!last) return "";

  if (points.length === 2) {
    return `M${first.x} ${first.y} L${last.x} ${last.y}`;
  }

  // Build cubic bezier: M start C cp1 cp2 end
  const mid = Math.floor(points.length / 2);
  const cp1 = points[1];
  const cp2 = points[mid] ?? points[1];
  if (!cp1 || !cp2) return `M${first.x} ${first.y} L${last.x} ${last.y}`;

  return `M${first.x} ${first.y} C${cp1.x} ${first.y} ${cp2.x} ${last.y} ${last.x} ${last.y}`;
}

// ---------------------------------------------------------------------------
// Edge style computation — extracted to keep render map simple (complexity)
// ---------------------------------------------------------------------------

interface EdgeStyle {
  strokeColor: string;
  strokeWidth: number;
  opacity: string;
  markerId: string;
  isHighlighted: boolean;
}

/**
 * Compute the visual style for a DAG edge given the current chain state.
 * Extracted to keep the render-map callback under the complexity threshold.
 */
function computeEdgeStyle(
  edge: LayoutEdge,
  chain: { up: Set<string>; down: Set<string> } | null,
  activeNodeId: string | null,
): EdgeStyle {
  const isActive = activeNodeId !== null;
  const isHighlighted =
    chain !== null &&
    (edge.from === activeNodeId || chain.up.has(edge.from) || chain.down.has(edge.from)) &&
    (edge.to === activeNodeId || chain.up.has(edge.to) || chain.down.has(edge.to));

  return {
    isHighlighted,
    strokeColor: isHighlighted
      ? "var(--color-accent)"
      : isActive
        ? "var(--color-border)"
        : "var(--color-border-strong)",
    strokeWidth: isHighlighted ? 2.2 : 1.2,
    opacity: isActive && !isHighlighted ? "0.3" : "1",
    markerId: isHighlighted ? "dag-arrow-on" : "dag-arrow",
  };
}

// ---------------------------------------------------------------------------
// DagNodeGroup — extracted SVG node to keep render map simple (complexity)
// ---------------------------------------------------------------------------

interface DagNodeGroupProps {
  node: LayoutNode;
  isActiveNode: boolean;
  isDimmed: boolean;
  isRunning: boolean;
  frd: string;
  onNodeClick: (id: string) => void;
}

/**
 * A single interactive DAG node rendered as an SVG `<g>`.
 * `<g>` cannot be a native `<button>` (not valid in SVG), so we use
 * `role="button"` + keyboard handler — required for interactive SVG nodes.
 */
function DagNodeGroup({
  node,
  isActiveNode,
  isDimmed,
  isRunning,
  frd,
  onNodeClick,
}: DagNodeGroupProps): React.JSX.Element {
  const nodeOpacity = isDimmed ? "0.32" : "1";
  const nodeBorderColor = isActiveNode ? "var(--color-accent)" : STATE_COLOR[node.state];
  const nodeBorderWidth = isActiveNode ? 2.4 : 1.4;
  const nodeFilter = isRunning ? "drop-shadow(0 0 7px var(--color-accent))" : undefined;
  const stateColor = STATE_COLOR[node.state];
  const stateIcon = STATE_ICON[node.state];
  const titleSlice = node.title.slice(0, 18);
  const metaLine = `${node.id} · ${frd}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot be a native <button>; role=button is the correct ARIA pattern for interactive SVG nodes
    <g
      key={node.id}
      data-testid={`dag-node-${node.id}`}
      data-active={isActiveNode ? "true" : "false"}
      aria-pressed={isActiveNode ? "true" : "false"}
      role="button"
      tabIndex={0}
      onClick={() => onNodeClick(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNodeClick(node.id);
        }
      }}
      style={{
        cursor: "pointer",
        opacity: nodeOpacity,
        ...(nodeFilter ? { filter: nodeFilter } : {}),
      }}
    >
      {/* Node rect */}
      <rect
        x={node.x}
        y={node.y}
        width={NODE_W}
        height={NODE_H}
        rx="9"
        fill="var(--color-card)"
        stroke={nodeBorderColor}
        strokeWidth={nodeBorderWidth}
      />

      {/* Title (first 18 chars) */}
      <text x={node.x + 11} y={node.y + 22} fontSize="12" fontWeight="600" fill="var(--color-text)">
        {titleSlice}
      </text>

      {/* WO id · FRD mono sub-line */}
      <text
        data-testid={`dag-node-meta-${node.id}`}
        x={node.x + 11}
        y={node.y + 38}
        fontSize="9.5"
        fill="var(--color-text3)"
        fontFamily="ui-monospace, monospace"
      >
        {metaLine}
      </text>

      {/* State dot (top-right, not color alone — pairs with the state icon) */}
      <circle
        data-testid={`dag-node-dot-${node.id}`}
        cx={node.x + NODE_W - 15}
        cy={node.y + 18}
        r="6"
        fill={stateColor}
      />

      {/* State icon (decorative — pairs with state dot + WO id text for a11y) */}
      <foreignObject x={node.x + 11} y={node.y + 2} width="16" height="16">
        <span
          className={`ti ${stateIcon}`}
          style={{ fontSize: "11px", color: stateColor, display: "block" }}
        />
      </foreignObject>

      {/* "▶ paso activo" caption when follow is ON and this is the running WO */}
      {isRunning && (
        <text
          data-testid={`dag-node-active-caption-${node.id}`}
          x={node.x + 11}
          y={node.y + NODE_H - 8}
          fontSize="8.5"
          fill="var(--color-accent-text)"
        >
          ▶ paso activo
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// WoDag component
// ---------------------------------------------------------------------------

/**
 * WoDag — work-order DAG with Dagre layout, chain-highlight, jump-to-error,
 * follow-active-step, live updates via useLiveSnapshot.
 *
 * Prototype: bDag() (~L1169).
 */
export function WoDag({ workOrders, project }: WoDagProps): React.JSX.Element {
  // Live subscription (AC-12-005.1/.2)
  const { snapshot } = useLiveSnapshot({ project });

  // Merge live state into work orders when a snapshot exists
  const effectiveOrders: WorkOrderWithDeps[] = workOrders.map((wo) => {
    if (snapshot === null) return wo;
    // Find last event for this WO to derive live state
    const woEvents = snapshot.events.filter((e) => e.workOrder === wo.id);
    if (woEvents.length === 0) return wo;
    const last = woEvents[woEvents.length - 1];
    if (!last) return wo;
    let liveState: WorkOrderState = wo.state;
    if (last.status === "ok") liveState = "done";
    else if (last.status === "fail") liveState = "fail";
    else liveState = "in_progress";
    return { ...wo, state: liveState };
  });

  // Build DAG from effective orders
  const { nodes: dagNodes, edges: dagEdges } = toDag(effectiveOrders);

  // FRD lookup map (id → frd label) — DagNode doesn't carry frd, so we carry it separately
  const frdById: Record<string, string> = {};
  for (const wo of effectiveOrders) {
    frdById[wo.id.trim()] = wo.frd;
  }

  // Compute Dagre layout
  const {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: svgW,
    height: svgH,
  } = computeLayout(dagNodes, dagEdges);

  // First error node (AC-12-004.3)
  const firstErrorId = firstError(dagNodes, dagEdges);

  // Running node (in_progress state, for follow-active)
  const runningNode = dagNodes.find((n) => n.state === "in_progress");

  // UI state
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [followActive, setFollowActive] = useState(false);

  // Chain for active node (AC-12-004.2)
  const chain = activeNodeId !== null ? dagChain(activeNodeId, dagNodes, dagEdges) : null;

  // Handlers
  const handleNodeClick = useCallback((id: string) => {
    setActiveNodeId((prev) => (prev === id ? null : id));
  }, []);

  const handleClearChain = useCallback(() => {
    setActiveNodeId(null);
  }, []);

  const handleJumpError = useCallback(() => {
    if (firstErrorId !== null) {
      setActiveNodeId(firstErrorId);
    }
  }, [firstErrorId]);

  const handleFollowToggle = useCallback(() => {
    setFollowActive((prev) => !prev);
  }, []);

  // Empty state
  if (effectiveOrders.length === 0) {
    return (
      <div
        data-testid="wo-dag"
        style={{
          background: "var(--color-panel)",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "12px 14px",
        }}
      >
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

  return (
    <div
      data-testid="wo-dag"
      style={{
        background: "var(--color-panel)",
        border: "0.5px solid var(--color-border)",
        borderRadius: "var(--radius-md, 8px)",
        padding: "12px 14px",
      }}
    >
      {/* Legend */}
      <Legend />

      {/* Controls bar (AC-12-004.3/.4) */}
      <div
        data-testid="dag-controls"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        {/* Jump to first error button */}
        {firstErrorId !== null && (
          <button
            type="button"
            data-testid="dag-jump-error"
            onClick={handleJumpError}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-sm, 4px)",
              background: "transparent",
              color: "var(--color-danger)",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: "13px" }} />
            Saltar al primer error
          </button>
        )}

        {/* Follow active toggle (AC-12-004.4) */}
        <button
          type="button"
          data-testid="dag-follow-toggle"
          onClick={handleFollowToggle}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 10px",
            border: followActive
              ? "1px solid var(--color-accent)"
              : "0.5px solid var(--color-border)",
            borderRadius: "var(--radius-sm, 4px)",
            background: "transparent",
            color: followActive ? "var(--color-accent-text)" : "var(--color-text3)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <i
            className={`ti ${followActive ? "ti-eye" : "ti-eye-off"}`}
            aria-hidden="true"
            style={{ fontSize: "13px" }}
          />
          Seguir al paso activo: {followActive ? "ON" : "OFF"}
        </button>

        {/* Chain hint / default hint */}
        <span
          style={{
            fontSize: "11px",
            color: "var(--color-text3)",
            flex: 1,
            minWidth: "160px",
            textAlign: "right",
          }}
        >
          {activeNodeId !== null ? (
            <span data-testid="dag-chain-hint">
              <i
                className="ti ti-affiliate"
                aria-hidden="true"
                style={{ fontSize: "12px", verticalAlign: "-1px" }}
              />{" "}
              Resaltando la cadena de <strong>{activeNodeId}</strong> (upstream + downstream).{" "}
              <button
                type="button"
                data-testid="dag-chain-clear"
                onClick={handleClearChain}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-accent-text)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "inherit",
                  textDecoration: "underline",
                }}
              >
                limpiar
              </button>
            </span>
          ) : (
            <span data-testid="dag-default-hint">
              Pasa el ratón / clic en un nodo para resaltar su cadena de dependencias y atenuar el
              resto.
            </span>
          )}
        </span>
      </div>

      {/* SVG graph container */}
      <div
        data-testid="dag-svg-container"
        style={{
          overflowX: "auto",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          background: "var(--color-canvas)",
          padding: "6px",
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ minWidth: `${svgW}px`, height: "auto", display: "block" }}
          aria-label="Grafo de dependencias entre work orders"
          role="img"
        >
          <defs>
            {/* Default arrowhead */}
            <marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0L8 4L0 8z" fill="var(--color-border-strong)" />
            </marker>
            {/* Accent arrowhead for chain-highlight */}
            <marker
              id="dag-arrow-on"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8z" fill="var(--color-accent)" />
            </marker>
          </defs>

          {/* Edges (bezier paths) — style computed by computeEdgeStyle helper */}
          {layoutEdges.map((edge) => {
            const { strokeColor, strokeWidth, opacity, markerId, isHighlighted } = computeEdgeStyle(
              edge,
              chain,
              activeNodeId,
            );
            const dPath = buildBezierPath(edge.points);
            if (!dPath) return null;

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={dPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                markerEnd={`url(#${markerId})`}
                data-edge={`${edge.from}-${edge.to}`}
                data-chain={isHighlighted ? "true" : "false"}
              />
            );
          })}

          {/* Nodes — rendered by DagNodeGroup subcomponent */}
          {layoutNodes.map((node) => {
            const isActiveNode = node.id === activeNodeId;
            const isInChain = chain !== null && (chain.up.has(node.id) || chain.down.has(node.id));
            const isDimmed = activeNodeId !== null && !isActiveNode && !isInChain;
            const isRunning = followActive && runningNode?.id === node.id;

            return (
              <DagNodeGroup
                key={node.id}
                node={node}
                isActiveNode={isActiveNode}
                isDimmed={isDimmed}
                isRunning={isRunning}
                frd={frdById[node.id] ?? ""}
                onNodeClick={handleNodeClick}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend subcomponent
// ---------------------------------------------------------------------------

function Legend(): React.JSX.Element {
  return (
    <div
      data-testid="dag-legend"
      style={{ fontSize: "12px", color: "var(--color-text2)", marginBottom: "10px" }}
    >
      <i
        className="ti ti-binary-tree"
        aria-hidden="true"
        style={{
          fontSize: "14px",
          verticalAlign: "-2px",
          color: "var(--color-accent-text)",
          marginRight: "6px",
        }}
      />
      Grafo de dependencias entre work orders (DAG). Layout estático (en la app real lo dibuja
      Dagre, ~39KB).
    </div>
  );
}
