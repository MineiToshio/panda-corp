"use client";

/**
 * WoDag — Work-order dependency graph (DAG) view (WO-12-006)
 *
 * Renders the work orders as a compact, left-to-right LAYERED dependency graph:
 *   - Nodes (work orders) placed in topological columns by dependency depth
 *   - Directed bezier edges (dependency → dependent) with arrowheads
 *   - Compact fixed-size nodes + capped spacing → fits the tab, never gigantic
 *   - Chain-highlight: click a node → accent its up/downstream chain, dim the rest
 *   - Jump to first error: danger-bordered button → select first fail WO + chain
 *   - Follow active step: toggle → running WO gets accent drop-shadow + "▶ paso activo"
 *   - Live: subscribes to useLiveSnapshot (WO-01-009) for event-driven state updates
 *
 * Layout: hand-rolled layered layout (see ./layout.ts), NOT Dagre. In production
 * the work orders carry no explicit `dependsOn` (read from on-disk markdown), so
 * dependencies are DERIVED: explicit `dependsOn` wins; otherwise a sequential
 * chain within each FRD (from the WO-NN-MMM id scheme). This guarantees the view
 * always reads as a directed dependency graph instead of scattered boxes.
 *
 * Prototype: bDag() (~L1169), bDagChain() (~L1154) — static `col`/`rowIn` layout.
 * Design rules: tokens only, no hardcoded colors/spacing/radii.
 * a11y: state by icon + dot + text + color; nodes are interactive buttons;
 *       motion: transform/opacity only.
 *
 * Traceability:
 *   CMP-12-dag → REQ-12-004/005 → AC-12-004.1/2/3/4, AC-12-005.1/2
 */

import { useCallback, useState } from "react";
import { dagChain, firstError, toDag } from "@/app/_observability/dag/dag/dag";
import { useLiveSnapshot } from "@/hooks/useLiveSnapshot";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import {
  computeLayout,
  deriveDeps,
  NODE_H,
  NODE_W,
  type PositionedEdge,
  type PositionedNode,
} from "./layout";

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

// Shared panel/box styles (tokens only) — kept as consts so the JSX stays lean.
const PANEL_STYLE: React.CSSProperties = {
  background: "var(--color-panel)",
  border: "0.5px solid var(--color-border)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "12px 14px",
};

const BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 10px",
  borderRadius: "var(--radius-sm, 4px)",
  background: "transparent",
  fontSize: "12px",
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// buildBezierPath — SVG "d" from the 4 layout control points
// ---------------------------------------------------------------------------

/** Build a cubic-bezier path `d` from the layout's [start, cp1, cp2, end] points. */
function buildBezierPath(points: PositionedEdge["points"]): string {
  const [start, cp1, cp2, end] = points;
  if (!start || !cp1 || !cp2 || !end) return "";
  return `M${start.x} ${start.y} C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
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
  edge: PositionedEdge,
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
  node: PositionedNode;
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
      aria-label={`${node.id} ${node.title} — ${node.state}`}
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
        rx="8"
        fill="var(--color-card)"
        stroke={nodeBorderColor}
        strokeWidth={nodeBorderWidth}
      />

      {/* State icon (decorative — pairs with state dot + WO id text for a11y) */}
      <foreignObject x={node.x + 10} y={node.y + 8} width="14" height="14">
        <span
          className={`ti ${stateIcon}`}
          style={{ fontSize: "11px", color: stateColor, display: "block", lineHeight: 1 }}
        />
      </foreignObject>

      {/* Title (first 18 chars) */}
      <text x={node.x + 28} y={node.y + 20} fontSize="12" fontWeight="600" fill="var(--color-text)">
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
        cx={node.x + NODE_W - 14}
        cy={node.y + 16}
        r="5.5"
        fill={stateColor}
      />

      {/* "▶ paso activo" caption when follow is ON and this is the running WO */}
      {isRunning && (
        <text
          data-testid={`dag-node-active-caption-${node.id}`}
          x={node.x + NODE_W - 11}
          y={node.y + NODE_H - 7}
          fontSize="8.5"
          textAnchor="end"
          fill="var(--color-accent-text)"
        >
          ▶ paso activo
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Live-state merge + dependency derivation
// ---------------------------------------------------------------------------

/**
 * Merge live event state onto the static work orders, then derive dependencies
 * (explicit `dependsOn` wins; otherwise a sequential chain within each FRD).
 * Returns work orders ready for `toDag`.
 */
function buildEffectiveOrders(
  workOrders: WorkOrder[],
  snapshot: ReturnType<typeof useLiveSnapshot>["snapshot"],
): WorkOrderWithDeps[] {
  const withLiveState: WorkOrderWithDeps[] = workOrders.map((wo) => {
    if (snapshot === null) return wo;
    const woEvents = snapshot.events.filter((e) => e.workOrder === wo.id);
    const last = woEvents[woEvents.length - 1];
    if (!last) return wo;
    let liveState: WorkOrderState = wo.state;
    if (last.status === "ok") liveState = "done";
    else if (last.status === "fail") liveState = "fail";
    else liveState = "in_progress";
    return { ...wo, state: liveState };
  });

  return deriveDeps(withLiveState);
}

// ---------------------------------------------------------------------------
// WoDag component
// ---------------------------------------------------------------------------

/**
 * WoDag — work-order dependency graph with a compact layered layout,
 * chain-highlight, jump-to-error, follow-active-step and live updates.
 *
 * Prototype: bDag() (~L1169).
 */
export function WoDag({ workOrders, project }: WoDagProps): React.JSX.Element {
  // Live subscription (AC-12-005.1/.2)
  const { snapshot } = useLiveSnapshot({ project });

  // Live-merged + dependency-derived work orders
  const effectiveOrders = buildEffectiveOrders(workOrders, snapshot);

  // Build DAG (nodes + directed edges) from the derived deps
  const { nodes: dagNodes, edges: dagEdges } = toDag(effectiveOrders);

  // FRD lookup map (id → frd label) — DagNode doesn't carry frd, carry it aside
  const frdById: Record<string, string> = {};
  for (const wo of effectiveOrders) {
    frdById[wo.id.trim()] = wo.frd;
  }

  // Compute the compact layered layout
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

  return (
    <div data-testid="wo-dag" style={PANEL_STYLE}>
      {/* Legend */}
      <Legend />

      {/* Controls bar (AC-12-004.3/.4) */}
      <Controls
        firstErrorId={firstErrorId}
        followActive={followActive}
        activeNodeId={activeNodeId}
        onJumpError={handleJumpError}
        onFollowToggle={handleFollowToggle}
        onClearChain={handleClearChain}
      />

      {/* SVG graph container — bounded; horizontal scroll only if it overflows */}
      <div
        data-testid="dag-svg-container"
        style={{
          overflowX: "auto",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          background: "var(--color-canvas)",
          padding: "8px",
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
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
// Controls subcomponent (jump-to-error + follow toggle + chain hint)
// ---------------------------------------------------------------------------

interface ControlsProps {
  firstErrorId: string | null;
  followActive: boolean;
  activeNodeId: string | null;
  onJumpError: () => void;
  onFollowToggle: () => void;
  onClearChain: () => void;
}

function Controls({
  firstErrorId,
  followActive,
  activeNodeId,
  onJumpError,
  onFollowToggle,
  onClearChain,
}: ControlsProps): React.JSX.Element {
  return (
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
          onClick={onJumpError}
          style={{
            ...BTN_STYLE,
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger)",
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
        onClick={onFollowToggle}
        style={{
          ...BTN_STYLE,
          border: followActive
            ? "1px solid var(--color-accent)"
            : "0.5px solid var(--color-border)",
          color: followActive ? "var(--color-accent-text)" : "var(--color-text3)",
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
              onClick={onClearChain}
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
            Haz clic en un nodo para resaltar su cadena de dependencias y atenuar el resto.
          </span>
        )}
      </span>
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
      Grafo de dependencias entre work orders (DAG) — por orden topológico, de dependencia a
      dependiente.
    </div>
  );
}
