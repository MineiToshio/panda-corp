/**
 * DagNodeGroup — a single interactive work-order node in the WoDag graph.
 *
 * Extracted from WoDag.tsx so the orchestrator stays under the file-size limit
 * and the node's layout (the part that decides whether text fits the card) is
 * isolated and testable.
 *
 * Text fit (the reason this is a <foreignObject>, not bare <text>): SVG <text>
 * never wraps or clips to the rect, so a long title spilled past the card edge.
 * Here the title + id·FRD sub-line live in an HTML block that wraps the title to
 * 2 lines (line-clamp + ellipsis) and truncates the sub-line — text can never
 * escape the node again.
 *
 * a11y: the group is role="button" (an SVG <g> can't be a native <button>),
 * keyboard-operable, and state is conveyed by icon + dot + text, never colour
 * alone (AC-13-007.1).
 */

import type { WorkOrderState } from "@/lib/work-orders/work-orders";
import { NODE_H, NODE_W, type PositionedNode } from "./layout";

// ---------------------------------------------------------------------------
// State color/icon maps — mirrors prototype WOCOL / WOICON (tokens only)
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

// Strip a leading "WO-NN-MMM — " id prefix from the title: the id already shows
// in the mono sub-line, so repeating it just steals room from the description.
const ID_PREFIX_RE = /^WO-\d{1,3}-\d{1,4}\s*[—–-]\s*/;

/** Inner text block styles — kept out of JSX so the node markup stays lean. */
const TITLE_STYLE: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 600,
  lineHeight: 1.18,
  color: "var(--color-text)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const META_STYLE: React.CSSProperties = {
  fontSize: "9.5px",
  fontFamily: "ui-monospace, monospace",
  color: "var(--color-text3)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DagNodeGroupProps {
  node: PositionedNode;
  isActiveNode: boolean;
  isDimmed: boolean;
  isRunning: boolean;
  frd: string;
  onNodeClick: (id: string) => void;
}

// ---------------------------------------------------------------------------
// DagNodeGroup
// ---------------------------------------------------------------------------

/**
 * A single interactive DAG node rendered as an SVG `<g>`.
 * `<g>` cannot be a native `<button>` (not valid in SVG), so we use
 * `role="button"` + keyboard handler — the correct ARIA pattern for an
 * interactive SVG node.
 */
export function DagNodeGroup({
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
  const cleanTitle = node.title.replace(ID_PREFIX_RE, "").trim() || node.title;
  const metaLine = `${node.id} · ${frd}`;

  // Text block geometry: starts right of the icon, stops short of the state dot
  // so the wrapped title never collides with it.
  const textX = node.x + 27;
  const textW = NODE_W - 47;

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
      <foreignObject x={node.x + 9} y={node.y + 9} width="16" height="16">
        <span
          className={`ti ${stateIcon}`}
          style={{ fontSize: "12px", color: stateColor, display: "block", lineHeight: 1 }}
        />
      </foreignObject>

      {/* State dot (top-right, not color alone — pairs with the state icon) */}
      <circle
        data-testid={`dag-node-dot-${node.id}`}
        cx={node.x + NODE_W - 13}
        cy={node.y + 14}
        r="5"
        fill={stateColor}
      />

      {/* Title (wrapped, 2 lines) + id·FRD sub-line — HTML so it clips to the box */}
      <foreignObject x={textX} y={node.y + 8} width={textW} height={NODE_H - 14}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "3px",
            overflow: "hidden",
          }}
        >
          <span style={TITLE_STYLE}>{cleanTitle}</span>
          <span data-testid={`dag-node-meta-${node.id}`} style={META_STYLE}>
            {metaLine}
          </span>
        </div>
      </foreignObject>

      {/* "▶ paso activo" caption when follow is ON and this is the running WO */}
      {isRunning && (
        <text
          data-testid={`dag-node-active-caption-${node.id}`}
          x={node.x + NODE_W - 11}
          y={node.y + NODE_H - 6}
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
