"use client";

/**
 * WO-12-006 — CMP-12-dag: WorkOrderDag client component
 *
 * Renders the work-order dependency DAG using Dagre layout.
 *
 * Features:
 *   - Dagre layout (LR rankdir) for node positions
 *   - Hover path-focus: highlights upstream/downstream chain, dims the rest
 *   - "Jump to first error" button: selects + scrolls to the first failed node
 *   - Follow-mode: when enabled, auto-selects the currently-executing node
 *
 * Tokens: CSS custom properties from design tokens — no hardcoded colors.
 * State by icon + label (AC-13-007.1) — never color-alone.
 *
 * Traces: REQ-12-005, REQ-12-006, AC-12-005.1, AC-12-006.1
 * NOT ELK (AC-12-006.1).
 */

import dagre from "@dagrejs/dagre";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkOrder } from "@/lib/work-orders";
import type { DagEdge, DagNode } from "../dag/dag";
import { dagChain, firstError, toDag } from "../dag/dag";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const GRAPH_PADDING = 24;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

interface PositionedNode extends DagNode {
  x: number;
  y: number;
}

interface LayoutResult {
  nodes: PositionedNode[];
  edges: DagEdge[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Dagre layout (pure computation, no side-effects)
// ---------------------------------------------------------------------------

function computeLayout(nodes: DagNode[], edges: DagEdge[]): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", marginx: GRAPH_PADDING, marginy: GRAPH_PADDING });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT, ...node });
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const positioned: PositionedNode[] = nodes.map((node) => {
    const n = g.node(node.id) as { x: number; y: number } & DagNode;
    return { ...node, x: n.x, y: n.y };
  });

  const graphLabel = g.graph() as { width?: number; height?: number };
  const width = (graphLabel.width ?? NODE_WIDTH) + GRAPH_PADDING * 2;
  const height = (graphLabel.height ?? NODE_HEIGHT) + GRAPH_PADDING * 2;

  return { nodes: positioned, edges, width, height };
}

// ---------------------------------------------------------------------------
// State → icon mapping (icon + label, never color-only — AC-13-007.1)
// ---------------------------------------------------------------------------

function stateIcon(state: WorkOrder["state"]): { icon: string; label: string } {
  const map: Record<WorkOrder["state"], { icon: string; label: string }> = {
    todo: { icon: "○", label: "Pendiente" },
    in_progress: { icon: "◑", label: "En progreso" },
    review: { icon: "◉", label: "En revisión" },
    done: { icon: "●", label: "Completado" },
    fail: { icon: "✕", label: "Fallido" },
  };
  return map[state];
}

// ---------------------------------------------------------------------------
// Node color token — CSS var reference from design tokens (no hardcoded colors)
// ---------------------------------------------------------------------------

function nodeColorVar(state: WorkOrder["state"]): string {
  // State-based color tokens — CSS custom properties from globals.css
  const stateTokens: Record<WorkOrder["state"], string> = {
    todo: "var(--color-text-muted, currentColor)",
    in_progress: "var(--color-accent, currentColor)",
    review: "var(--color-accent-secondary, currentColor)",
    done: "var(--color-success, currentColor)",
    fail: "var(--color-error, currentColor)",
  };
  return stateTokens[state];
}

// ---------------------------------------------------------------------------
// Edge path helper — straight line between node centers
// ---------------------------------------------------------------------------

function edgePath(from: PositionedNode, to: PositionedNode): string {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y;
  const x2 = to.x - NODE_WIDTH / 2;
  const y2 = to.y;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkOrderDagProps {
  workOrders: WorkOrderWithDeps[];
  /** Id of the currently-executing work order (for follow-mode). */
  executingId?: string;
}

// ---------------------------------------------------------------------------
// WorkOrderDag component
// ---------------------------------------------------------------------------

export function WorkOrderDag({ workOrders, executingId }: WorkOrderDagProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState(false);

  // Build the raw DAG graph from work orders.
  const { nodes: rawNodes, edges } = useMemo(() => toDag(workOrders), [workOrders]);

  // Compute Dagre layout.
  const layout = useMemo(
    () => (rawNodes.length > 0 ? computeLayout(rawNodes, edges) : null),
    [rawNodes, edges],
  );

  // Compute the chain for the hovered node.
  const chain = useMemo(() => {
    if (hoveredId === null || !layout) return null;
    return dagChain(hoveredId, layout.nodes, edges);
  }, [hoveredId, layout, edges]);

  // Compute the first error node.
  const errorId = useMemo(() => (layout ? firstError(layout.nodes, edges) : null), [layout, edges]);

  // Follow-mode: auto-select the executing node.
  useEffect(() => {
    if (followMode && executingId) {
      setSelectedId(executingId);
    }
  }, [followMode, executingId]);

  // Node refs for scroll-into-view on jump/follow.
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  function handleJumpError() {
    if (!errorId) return;
    setSelectedId(errorId);
    const el = nodeRefs.current.get(errorId);
    // scrollIntoView is not available in all environments (e.g. jsdom); guard it.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleFollowToggle() {
    setFollowMode((prev) => !prev);
  }

  // Empty state.
  if (!layout || layout.nodes.length === 0) {
    return (
      <div data-testid="wo-dag-empty" className="wo-dag-empty" role="status">
        <span>Sin work orders para visualizar</span>
      </div>
    );
  }

  return (
    <div className="wo-dag-wrapper" style={{ position: "relative" }}>
      {/* Controls */}
      <div
        className="wo-dag-controls"
        style={{ display: "flex", gap: "var(--spacing, 8px)", marginBottom: "var(--spacing, 8px)" }}
      >
        <button
          type="button"
          data-testid="wo-dag-jump-error"
          aria-label="Saltar al primer error"
          onClick={handleJumpError}
          disabled={!errorId}
          style={{ cursor: errorId ? "pointer" : "default" }}
        >
          ✕ Primer error
        </button>
        <button
          type="button"
          data-testid="wo-dag-follow-toggle"
          aria-label={followMode ? "Desactivar seguimiento" : "Activar seguimiento"}
          aria-pressed={followMode}
          onClick={handleFollowToggle}
        >
          {followMode ? "◎ Siguiendo" : "○ Seguir ejecución"}
        </button>
      </div>

      {/* DAG SVG */}
      <div
        data-testid="wo-dag"
        style={{
          position: "relative",
          width: layout.width,
          height: layout.height,
          overflow: "auto",
        }}
      >
        {/* SVG layer for edges */}
        <svg
          width={layout.width}
          height={layout.height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="wo-dag-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L8,3 z"
                style={{ fill: "var(--color-text-muted, currentColor)" }}
              />
            </marker>
          </defs>
          {edges.map((edge) => {
            const fromNode = layout.nodes.find((n) => n.id === edge.from);
            const toNode = layout.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const isChainEdge =
              hoveredId !== null &&
              chain !== null &&
              (chain.up.has(edge.from) ||
                chain.down.has(edge.to) ||
                edge.from === hoveredId ||
                edge.to === hoveredId);
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                data-testid={`wo-dag-edge-${edge.from}-${edge.to}`}
                d={edgePath(fromNode, toNode)}
                fill="none"
                strokeWidth={isChainEdge ? 2 : 1}
                markerEnd="url(#wo-dag-arrow)"
                style={{
                  stroke: isChainEdge
                    ? "var(--color-accent, currentColor)"
                    : "var(--color-text-muted, currentColor)",
                  opacity: hoveredId !== null && !isChainEdge ? 0.25 : 1,
                  transition:
                    "opacity var(--motion-duration-fast, 150ms) ease, stroke var(--motion-duration-fast, 150ms) ease",
                }}
              />
            );
          })}
        </svg>

        {/* Node layer */}
        {layout.nodes.map((node) => {
          const isDimmed =
            hoveredId !== null &&
            node.id !== hoveredId &&
            chain !== null &&
            !chain.up.has(node.id) &&
            !chain.down.has(node.id);

          const isSelected = node.id === selectedId;
          const badge = stateIcon(node.state);
          const colorVar = nodeColorVar(node.state);

          return (
            <button
              type="button"
              key={node.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(node.id, el);
                else nodeRefs.current.delete(node.id);
              }}
              data-testid={`wo-dag-node-${node.id}`}
              data-dimmed={isDimmed ? "true" : undefined}
              data-selected={isSelected ? "true" : undefined}
              aria-label={`${node.id}: ${node.title} — ${badge.label}`}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(node.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
              style={{
                position: "absolute",
                left: node.x - NODE_WIDTH / 2,
                top: node.y - NODE_HEIGHT / 2,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing, 6px)",
                padding: "0 var(--spacing, 8px)",
                borderRadius: "var(--radius, 6px)",
                border: isSelected
                  ? "2px solid var(--color-accent, currentColor)"
                  : "1px solid var(--hairline, currentColor)",
                background: "var(--color-surface, transparent)",
                color: colorVar,
                opacity: isDimmed ? 0.3 : 1,
                cursor: "pointer",
                outline: isSelected ? "var(--focus-ring, 2px solid)" : undefined,
                transition:
                  "opacity var(--motion-duration-fast, 150ms) ease, border-color var(--motion-duration-fast, 150ms) ease",
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.75rem",
                overflow: "hidden",
              }}
            >
              {/* State icon + label (AC-13-007.1 — never color-only) */}
              <span aria-hidden="true" style={{ flexShrink: 0 }}>
                {badge.icon}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {node.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
