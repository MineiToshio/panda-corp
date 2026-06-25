/**
 * DagCanvas — the SVG render of the 2D compound WoDag.
 *
 * Render order is load-bearing (ported from the prototype): cross FRD→FRD lines
 * BEHIND the opaque cluster boxes (so they hide where they cross a box and
 * emerge from the borders), then the boxes, then intra WO→WO lines ON TOP of the
 * boxes (visible inside), then the cards.
 *
 * Color-on-select: `selectedId` (pinned or hovered) drives computeHighlight; at
 * rest every edge is uniform accent, on select the chain/neighbor lines each take
 * a distinct trace-palette color and everything else dims.
 */

import { useMemo } from "react";
import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import type { WorkOrderState } from "@/lib/work-orders/work-orders";
import { DagCard } from "./DagCard";
import { computeHighlight, crossKey, type Highlight, intraKey } from "./highlight";
import type { CrossEdge, DagLayout, IntraEdge } from "./layout";

export interface DagCanvasProps {
  layout: DagLayout;
  nodes: DagNode[];
  edges: DagEdge[];
  liveStateById: Map<string, WorkOrderState>;
  selectedId: string | null;
  followActive: boolean;
  runningId: string | null;
  scale: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onBackgroundClick: () => void;
}

/** Build the cubic-bezier `d` string for an intra edge's 4 control points. */
function intraPath(points: IntraEdge["points"]): string {
  const [s, c1, c2, e] = points;
  if (!s || !c1 || !c2 || !e) return "";
  return `M${s.x} ${s.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
}

const REST_EDGE = "var(--color-accent)";
const DIM_OPACITY = 0.08;

/** The whole SVG canvas. */
export function DagCanvas(props: DagCanvasProps): React.JSX.Element {
  const { layout, nodes, edges, selectedId, scale } = props;
  const { width, height } = layout;

  const highlight = useMemo<Highlight | null>(
    () =>
      selectedId === null
        ? null
        : computeHighlight({
            selectedId,
            nodes,
            edges,
            intraEdges: layout.intraEdges,
            crossEdges: layout.crossEdges,
          }),
    [selectedId, nodes, edges, layout.intraEdges, layout.crossEdges],
  );

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>): void => {
    if (e.key === "Escape") props.onBackgroundClick();
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      style={{ display: "block" }}
      aria-label="Grafo de dependencias entre work orders"
      role="img"
      onClick={props.onBackgroundClick}
      onKeyDown={handleKeyDown}
    >
      <CrossLayer
        crossEdges={layout.crossEdges}
        crossWo={layout.crossWoLinks}
        highlight={highlight}
      />
      <ClusterLayer layout={layout} highlight={highlight} />
      <IntraLayer intraEdges={layout.intraEdges} highlight={highlight} />
      <CardLayer
        cards={layout.cards}
        liveStateById={props.liveStateById}
        selectedId={selectedId}
        followActive={props.followActive}
        runningId={props.runningId}
        highlight={highlight}
        onSelect={props.onSelect}
        onHover={props.onHover}
      />
    </svg>
  );
}

// --- Cross layer (behind boxes) ---------------------------------------------

interface CrossLayerProps {
  crossEdges: CrossEdge[];
  crossWo: DagLayout["crossWoLinks"];
  highlight: Highlight | null;
}

function CrossLayer({ crossEdges, crossWo, highlight }: CrossLayerProps): React.JSX.Element {
  return (
    <g>
      {crossEdges.map((ce) => {
        const key = crossKey(ce.fromFrd, ce.toFrd);
        const traced = highlight?.crossColor.get(key);
        const on = highlight === null || traced !== undefined;
        return (
          <line
            key={key}
            data-cross-frd-edge={key}
            x1={ce.start.x}
            y1={ce.start.y}
            x2={ce.end.x}
            y2={ce.end.y}
            stroke={traced ?? REST_EDGE}
            strokeWidth={traced ? ce.strokeWidth + 1.4 : ce.strokeWidth}
            strokeDasharray="5 4"
            opacity={on ? (highlight ? 1 : 0.4) : DIM_OPACITY}
            fill="none"
          />
        );
      })}
      {/* Per-WO cross deps: invisible markers carrying the WO-level data-edge so
          every dependency stays addressable without redrawing the spiderweb. */}
      {crossWo.map((link) => (
        <line
          key={`${link.from}-${link.to}`}
          data-edge={`${link.from}-${link.to}`}
          data-cross-frd="true"
          data-chain={
            highlight?.crossColor.has(crossKey(link.fromFrd, link.toFrd)) ? "true" : "false"
          }
          x1={0}
          y1={0}
          x2={0}
          y2={0}
          stroke="none"
        />
      ))}
    </g>
  );
}

// --- Cluster layer (the opaque boxes) ---------------------------------------

function ClusterLayer({
  layout,
  highlight,
}: {
  layout: DagLayout;
  highlight: Highlight | null;
}): React.JSX.Element {
  return (
    <g>
      {layout.clusters.map((c) => {
        const selected = highlight?.frds.has(c.frd) ?? false;
        return (
          <g key={c.frd} data-testid={`dag-cluster-${c.frd}`}>
            <rect
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              rx="12"
              fill="var(--color-panel)"
              stroke={selected ? "var(--color-accent)" : "var(--color-border)"}
              strokeWidth={selected ? 2.4 : 1.2}
            />
            <text
              x={c.x + 10}
              y={c.y + 18}
              fontSize="12"
              fontWeight={700}
              fill="var(--color-text2)"
              fontFamily="ui-monospace, monospace"
            >
              {c.label.slice(0, 32)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// --- Intra layer (WO→WO lines on top of boxes) ------------------------------

function IntraLayer({
  intraEdges,
  highlight,
}: {
  intraEdges: IntraEdge[];
  highlight: Highlight | null;
}): React.JSX.Element {
  return (
    <g>
      {intraEdges.map((ie) => {
        const key = intraKey(ie.from, ie.to);
        const traced = highlight?.intraColor.get(key);
        const on = highlight === null || traced !== undefined;
        const d = intraPath(ie.points);
        if (!d) return null;
        return (
          <path
            key={key}
            data-edge={`${ie.from}-${ie.to}`}
            data-cross-frd="false"
            data-chain={traced ? "true" : "false"}
            d={d}
            fill="none"
            stroke={traced ?? REST_EDGE}
            strokeWidth={traced ? 2.6 : 1.1}
            opacity={on ? (highlight ? 1 : 0.5) : DIM_OPACITY}
          />
        );
      })}
    </g>
  );
}

// --- Card layer -------------------------------------------------------------

interface CardLayerProps {
  cards: DagLayout["cards"];
  liveStateById: Map<string, WorkOrderState>;
  selectedId: string | null;
  followActive: boolean;
  runningId: string | null;
  highlight: Highlight | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function CardLayer({
  cards,
  liveStateById,
  selectedId,
  followActive,
  runningId,
  highlight,
  onSelect,
  onHover,
}: CardLayerProps): React.JSX.Element {
  return (
    <g>
      {cards.map((card) => {
        const liveState = liveStateById.get(card.id) ?? card.state;
        const inChain = highlight?.chain.has(card.id) ?? false;
        const inFrds = highlight?.frds.has(card.clusterFrd) ?? true;
        return (
          <DagCard
            key={card.id}
            card={{ ...card, state: liveState }}
            isSelected={card.id === selectedId}
            isInChain={inChain && card.id !== selectedId}
            isDimmed={highlight !== null && !inFrds}
            isRunning={followActive && runningId === card.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}
    </g>
  );
}
