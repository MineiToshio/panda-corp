/**
 * WoDag layout — pure, deterministic 2D COMPOUND (cluster) layout.
 *
 * Ported from the approved prototype `docs/design/prototype/dag-2d.generator.mjs`.
 * Replaces the earlier FRD-swimlane layout with a 2D dependency map:
 *   - Each FRD is an opaque rounded BOX (a cluster), positioned by a seeded,
 *     deterministic force simulation over the FRD super-graph + an AABB
 *     no-overlap pass (see ./forceLayout.ts).
 *   - Each box holds its work-order CARDS, laid out by intra-FRD dependency rank
 *     (longest-path columns), and is sized to fit its card grid.
 *   - Edges at two levels: intra-FRD WO→WO lines (drawn over the boxes) and
 *     cross-FRD lines AGGREGATED to one FRD→FRD line per directed pair (drawn
 *     behind the opaque boxes).
 *
 * PURE + DETERMINISTIC: no I/O, no React, no Date.now/Math.random. Same input →
 * byte-identical output (the layout runs in an RSC read AND must not jitter).
 * Layout depends on STRUCTURE ONLY (the set of WO ids + deps + frd) — never on
 * live state. Never throws; empty input → empty layout.
 */

import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import { type ForceBox, type ForceLink, solveForceLayout } from "./forceLayout";

// ---------------------------------------------------------------------------
// Card + cluster spacing constants (verbatim from the prototype generator)
// ---------------------------------------------------------------------------

/** Card width in px. */
export const CARD_W = 164;
/** Card height in px. */
export const CARD_H = 54;
/** Horizontal step between card columns (intra-FRD rank). */
export const CARD_COL_W = 182;
/** Vertical step between card rows within a column. */
export const CARD_ROW_H = 66;
/** Header band height reserved at the top of each cluster box for its label. */
export const CLUSTER_HEAD = 28;
/** Inner padding inside a cluster box. */
export const CLUSTER_PAD = 12;
/** Outer canvas margin around the whole packed graph. */
export const CANVAS_MARGIN = 80;
/** Backwards-compatible alias (some consumers/tests import PAD). */
export const PAD = CLUSTER_PAD;

// ---------------------------------------------------------------------------
// Positioned output
// ---------------------------------------------------------------------------

/** A positioned work-order card (absolute coords on the canvas). */
export interface PositionedCard extends DagNode {
  /** Absolute top-left x of the card. */
  x: number;
  /** Absolute top-left y of the card. */
  y: number;
  width: number;
  height: number;
  /** The owning FRD slug (always set; "" for the no-FRD bucket). */
  clusterFrd: string;
}

/** A positioned FRD cluster box. */
export interface PositionedCluster {
  frd: string;
  /** Display label, e.g. "FRD-01 · Data reading". */
  label: string;
  /** Absolute top-left x of the box. */
  x: number;
  /** Absolute top-left y of the box. */
  y: number;
  w: number;
  h: number;
}

/** An intra-FRD WO→WO edge with its cubic-bezier path points. */
export interface IntraEdge {
  from: string;
  to: string;
  /** [start, cp1, cp2, end]. */
  points: ReadonlyArray<{ x: number; y: number }>;
}

/** An aggregated cross-FRD edge: one straight line per directed FRD pair. */
export interface CrossEdge {
  /** Source FRD slug. */
  fromFrd: string;
  /** Target FRD slug. */
  toFrd: string;
  /** Number of underlying WO→WO dependencies aggregated into this line. */
  weight: number;
  /** Stroke width derived from the weight (matches the prototype). */
  strokeWidth: number;
  /** Center-to-center line endpoints. */
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * An individual cross-FRD WO→WO dependency. The graph aggregates these into one
 * visible line per FRD pair (CrossEdge), but each underlying WO link is kept so
 * the render can emit a per-WO `data-edge` marker (the integration contract that
 * every WO→WO dependency is addressable) without drawing a spiderweb.
 */
export interface CrossWoLink {
  from: string;
  to: string;
  fromFrd: string;
  toFrd: string;
}

export interface DagLayout {
  clusters: PositionedCluster[];
  cards: PositionedCard[];
  intraEdges: IntraEdge[];
  crossEdges: CrossEdge[];
  /** Per-WO cross-FRD deps (aggregated visually into crossEdges). */
  crossWoLinks: CrossWoLink[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Label + grouping helpers
// ---------------------------------------------------------------------------

/** Lane label: "frd-01-data-reading" → "FRD-01 · Data reading"; "" → "Sin FRD". */
function clusterLabel(frd: string): string {
  if (frd === "") return "Sin FRD";
  const num = /^(frd-\d+)/i.exec(frd);
  const head = num?.[1] !== undefined ? num[1].toUpperCase() : frd;
  const rest = frd
    .replace(/^frd-\d+-?/i, "")
    .replace(/-/g, " ")
    .trim();
  return rest === "" ? head : `${head} · ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/** Group WO nodes by their FRD slug (first-seen order preserved within each group). */
function groupNodesByFrd(nodes: DagNode[]): Map<string, DagNode[]> {
  const groups = new Map<string, DagNode[]>();
  for (const n of nodes) {
    const frd = n.frd ?? "";
    const bucket = groups.get(frd);
    if (bucket) bucket.push(n);
    else groups.set(frd, [n]);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Per-cluster internal layout (cards by intra-FRD longest-path rank)
// ---------------------------------------------------------------------------

/** A cluster before its box is positioned: its cards' offsets + computed size. */
interface ClusterShape {
  frd: string;
  nodes: DagNode[];
  /** Card-local offset (relative to the box top-left) by node id. */
  offsets: Map<string, { dx: number; dy: number }>;
  w: number;
  h: number;
}

/** Intra-FRD edges of a cluster (both endpoints inside the cluster). */
function intraEdgesOf(nodeIds: Set<string>, edges: DagEdge[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const e of edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) out.push([e.from, e.to]);
  }
  return out;
}

/** Successor adjacency + in-degree from a cluster's intra edges. */
function intraGraph(
  nodes: DagNode[],
  intra: Array<[string, string]>,
): { succ: Map<string, string[]>; indeg: Map<string, number> } {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const succ = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const [a, b] of intra) {
    succ.get(a)?.push(b);
    indeg.set(b, (indeg.get(b) ?? 0) + 1);
  }
  return { succ, indeg };
}

/**
 * Longest-path rank (column index) of each card within a cluster, via a Kahn
 * relaxation over the intra-FRD edges only. Cycle-safe (a node in a cycle keeps
 * rank 0 rather than looping forever).
 */
function intraRanks(nodes: DagNode[], intra: Array<[string, string]>): Map<string, number> {
  const rank = new Map(nodes.map((n) => [n.id, 0]));
  const { succ, indeg } = intraGraph(nodes, intra);
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  while (queue.length > 0) {
    const n = queue.shift();
    if (n === undefined) break;
    const here = rank.get(n) ?? 0;
    for (const m of succ.get(n) ?? []) {
      if (here + 1 > (rank.get(m) ?? 0)) rank.set(m, here + 1);
      const left = (indeg.get(m) ?? 0) - 1;
      indeg.set(m, left);
      if (left === 0) queue.push(m);
    }
  }
  return rank;
}

/** Build one cluster's card-offset grid + box size from its nodes + edges. */
function shapeCluster(frd: string, nodes: DagNode[], edges: DagEdge[]): ClusterShape {
  const ids = new Set(nodes.map((n) => n.id));
  const intra = intraEdgesOf(ids, edges);
  const rank = intraRanks(nodes, intra);

  const byRank = new Map<number, DagNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const bucket = byRank.get(r);
    if (bucket) bucket.push(n);
    else byRank.set(r, [n]);
  }

  const offsets = new Map<string, { dx: number; dy: number }>();
  let maxRows = 1;
  let maxRank = 0;
  for (const [r, bucket] of byRank) {
    maxRank = Math.max(maxRank, r);
    maxRows = Math.max(maxRows, bucket.length);
    bucket.forEach((node, i) => {
      offsets.set(node.id, {
        dx: CLUSTER_PAD + r * CARD_COL_W,
        dy: CLUSTER_HEAD + i * CARD_ROW_H,
      });
    });
  }

  const w = CLUSTER_PAD * 2 + maxRank * CARD_COL_W + CARD_W;
  const h = CLUSTER_HEAD + CLUSTER_PAD + (maxRows - 1) * CARD_ROW_H + CARD_H;
  return { frd, nodes, offsets, w, h };
}

// ---------------------------------------------------------------------------
// FRD super-graph (cross deps aggregated to FRD level)
// ---------------------------------------------------------------------------

/** Directed FRD→FRD pair with the count of underlying WO deps. */
interface SuperDirected {
  a: string;
  b: string;
  weight: number;
}

/** Count cross-FRD WO deps per directed "A>B" FRD pair. */
function countCrossPairs(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const frdOf = new Map<string, string>();
  for (const n of nodes) frdOf.set(n.id, n.frd ?? "");
  const counts = new Map<string, number>();
  for (const e of edges) {
    const a = frdOf.get(e.from);
    const b = frdOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    counts.set(`${a}>${b}`, (counts.get(`${a}>${b}`) ?? 0) + 1);
  }
  return counts;
}

/**
 * Aggregate cross-FRD WO edges into the FRD super-graph: directed pairs (for the
 * cross lines) + undirected links (for the force-sim springs).
 */
function buildSuperGraph(
  nodes: DagNode[],
  edges: DagEdge[],
): { directed: SuperDirected[]; links: ForceLink[] } {
  const counts = countCrossPairs(nodes, edges);
  const directed: SuperDirected[] = [];
  const undirected = new Set<string>();
  for (const [key, weight] of counts) {
    const [a, b] = key.split(">");
    if (a === undefined || b === undefined) continue;
    directed.push({ a, b, weight });
    undirected.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }

  const links: ForceLink[] = [];
  for (const key of undirected) {
    const [a, b] = key.split("|");
    if (a !== undefined && b !== undefined) links.push({ a, b });
  }
  return { directed, links };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Cubic-bezier control points for an intra LR edge between two cards. */
function intraBezier(
  from: PositionedCard,
  to: PositionedCard,
): ReadonlyArray<{ x: number; y: number }> {
  const x1 = from.x + CARD_W;
  const y1 = from.y + CARD_H / 2;
  const x2 = to.x;
  const y2 = to.y + CARD_H / 2;
  const mx = (x1 + x2) / 2;
  return [
    { x: x1, y: y1 },
    { x: mx, y: y1 },
    { x: mx, y: y2 },
    { x: x2, y: y2 },
  ];
}

/** Cross-edge stroke width from its weight (matches the prototype: 1.1 + n*0.22, capped 3). */
function crossStrokeWidth(weight: number): number {
  return Math.min(3, 1.1 + weight * 0.22);
}

// ---------------------------------------------------------------------------
// Public entry: computeLayout
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic 2D compound layout for a work-order DAG.
 *
 * STRUCTURE-ONLY: callers must key any memo on the WO ids + deps + frd, never on
 * live state — recomputing here on a state change would make boxes jump.
 */
export function computeLayout(nodes: DagNode[], edges: DagEdge[]): DagLayout {
  if (nodes.length === 0) {
    return {
      clusters: [],
      cards: [],
      intraEdges: [],
      crossEdges: [],
      crossWoLinks: [],
      width: 0,
      height: 0,
    };
  }

  const groups = groupNodesByFrd(nodes);
  const shapes = [...groups.entries()].map(([frd, ns]) => shapeCluster(frd, ns, edges));
  const { directed, links } = buildSuperGraph(nodes, edges);

  // Solve box centers deterministically (seeded circle + force sim + AABB).
  const boxes: ForceBox[] = shapes.map((s) => ({ frd: s.frd, w: s.w, h: s.h, x: 0, y: 0 }));
  solveForceLayout(boxes, links);

  // Translate solved centers to a positive top-left coordinate space + margin.
  const bounds = boundsOf(boxes);
  const positioned = positionClusters(shapes, boxes, bounds);

  const cards = layoutCards(shapes, positioned);
  const cardById = new Map(cards.map((c) => [c.id, c]));

  return {
    clusters: [...positioned.values()],
    cards,
    intraEdges: buildIntraEdges(nodes, edges, cardById),
    crossEdges: buildCrossEdges(directed, positioned),
    crossWoLinks: buildCrossWoLinks(nodes, edges),
    width: bounds.maxX - bounds.minX + CANVAS_MARGIN * 2,
    height: bounds.maxY - bounds.minY + CANVAS_MARGIN * 2,
  };
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** AABB bounds of the solved cluster centers (center ± half-size). */
function boundsOf(boxes: ForceBox[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const b of boxes) {
    minX = Math.min(minX, b.x - b.w / 2);
    minY = Math.min(minY, b.y - b.h / 2);
    maxX = Math.max(maxX, b.x + b.w / 2);
    maxY = Math.max(maxY, b.y + b.h / 2);
  }
  return { minX, minY, maxX, maxY };
}

/** Place each cluster box at its solved center, shifted into the positive canvas. */
function positionClusters(
  shapes: ClusterShape[],
  boxes: ForceBox[],
  bounds: Bounds,
): Map<string, PositionedCluster> {
  const byFrd = new Map(boxes.map((b) => [b.frd, b]));
  const out = new Map<string, PositionedCluster>();
  for (const shape of shapes) {
    const box = byFrd.get(shape.frd);
    if (!box) continue;
    out.set(shape.frd, {
      frd: shape.frd,
      label: clusterLabel(shape.frd),
      x: box.x - box.w / 2 - bounds.minX + CANVAS_MARGIN,
      y: box.y - box.h / 2 - bounds.minY + CANVAS_MARGIN,
      w: shape.w,
      h: shape.h,
    });
  }
  return out;
}

/** Resolve every card's absolute position from its cluster box + local offset. */
function layoutCards(
  shapes: ClusterShape[],
  positioned: Map<string, PositionedCluster>,
): PositionedCard[] {
  const cards: PositionedCard[] = [];
  for (const shape of shapes) {
    const box = positioned.get(shape.frd);
    if (!box) continue;
    for (const node of shape.nodes) {
      const off = shape.offsets.get(node.id);
      if (!off) continue;
      cards.push({
        ...node,
        x: box.x + off.dx,
        y: box.y + off.dy,
        width: CARD_W,
        height: CARD_H,
        clusterFrd: shape.frd,
      });
    }
  }
  return cards;
}

/** Build the intra-FRD WO→WO bezier edges (both endpoints in the same cluster). */
function buildIntraEdges(
  nodes: DagNode[],
  edges: DagEdge[],
  cardById: Map<string, PositionedCard>,
): IntraEdge[] {
  const frdOf = new Map<string, string>();
  for (const n of nodes) frdOf.set(n.id, n.frd ?? "");
  const out: IntraEdge[] = [];
  for (const e of edges) {
    if (frdOf.get(e.from) !== frdOf.get(e.to)) continue;
    const from = cardById.get(e.from);
    const to = cardById.get(e.to);
    if (!from || !to) continue;
    out.push({ from: e.from, to: e.to, points: intraBezier(from, to) });
  }
  return out;
}

/** Build the aggregated cross-FRD lines (center-to-center per directed pair). */
function buildCrossEdges(
  directed: SuperDirected[],
  positioned: Map<string, PositionedCluster>,
): CrossEdge[] {
  const out: CrossEdge[] = [];
  for (const { a, b, weight } of directed) {
    const ca = positioned.get(a);
    const cb = positioned.get(b);
    if (!ca || !cb) continue;
    out.push({
      fromFrd: a,
      toFrd: b,
      weight,
      strokeWidth: crossStrokeWidth(weight),
      start: { x: ca.x + ca.w / 2, y: ca.y + ca.h / 2 },
      end: { x: cb.x + cb.w / 2, y: cb.y + cb.h / 2 },
    });
  }
  return out;
}

/** Collect the individual cross-FRD WO dependencies (for per-WO data markers). */
function buildCrossWoLinks(nodes: DagNode[], edges: DagEdge[]): CrossWoLink[] {
  const frdOf = new Map<string, string>();
  for (const n of nodes) frdOf.set(n.id, n.frd ?? "");
  const out: CrossWoLink[] = [];
  for (const e of edges) {
    const a = frdOf.get(e.from);
    const b = frdOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    out.push({ from: e.from, to: e.to, fromFrd: a, toFrd: b });
  }
  return out;
}
