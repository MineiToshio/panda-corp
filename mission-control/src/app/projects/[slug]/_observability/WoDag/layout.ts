/**
 * WoDag layout — pure, compact, layered (topological) DAG layout.
 *
 * Replaces the Dagre dependency for the work-order DAG: a hand-rolled
 * longest-path layering (Kahn-style) that mirrors the prototype's static
 * `col` / `rowIn` placement (docs/design/prototype/index.html ~L1172-1177)
 * but generalised to any work-order set.
 *
 * Why hand-rolled, not Dagre: in production the work orders carry NO explicit
 * `dependsOn` (lib/work-orders reads the on-disk markdown, which has no deps
 * field), so Dagre laid every node in its own rank → a sprawling, illegible
 * canvas. Here we (1) derive sensible edges when none are explicit and
 * (2) lay the graph out in tight, fixed-size topological columns so it always
 * reads as a left-to-right dependency graph and never balloons.
 *
 * Pure module: no I/O, no React, no side-effects. Never throws.
 */

import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";

// ---------------------------------------------------------------------------
// Node + spacing constants
//
// Sized for legibility: a node fits a state icon, a 2-line wrapped title and a
// mono id·FRD sub-line WITHOUT the text spilling past the card edge. The canvas
// renders at natural size (no auto-shrink) and the view is zoom/pan-able, so a
// larger node is a feature, not a cost — see WoDag's ZoomControls.
// ---------------------------------------------------------------------------

/** Node width in px. */
export const NODE_W = 170;
/** Node height in px — room for a 2-line title + the id·FRD sub-line. */
export const NODE_H = 62;
/** Horizontal step between column origins (node + gap). */
export const COL_STEP = 212;
/** Vertical step between row origins within a column (node + gap). */
export const ROW_STEP = 84;
/** Canvas inner padding. */
export const PAD = 16;
/** Height reserved above each FRD swimlane's nodes for its label. */
export const LANE_HEADER_H = 28;
/** Vertical gap between FRD swimlanes. */
export const LANE_GAP = 20;

// ---------------------------------------------------------------------------
// Positioned output
// ---------------------------------------------------------------------------

export interface PositionedNode extends DagNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedEdge extends DagEdge {
  /** Cubic-bezier control + end points: [start, cp1, cp2, end]. */
  points: ReadonlyArray<{ x: number; y: number }>;
  /** True when the edge connects two different FRDs (rendered as a distinct, dashed link). */
  crossFrd?: boolean;
}

/** A horizontal FRD swimlane: a labeled band that contains that FRD's work-order nodes. */
export interface DagLane {
  frd: string;
  /** Display label, e.g. "FRD-01 · Data reading". */
  label: string;
  /** Top y of the band (the header sits here; nodes start LANE_HEADER_H below). */
  y: number;
  /** Full band height (header + node grid). */
  height: number;
}

export interface DagLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  /** FRD swimlanes (grouping bands), top-to-bottom by FRD number. */
  lanes: DagLane[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Rank assignment (longest-path layering, cycle-safe)
// ---------------------------------------------------------------------------

/** Successor adjacency + in-degree for each node, ignoring edges to unknown ids. */
function buildGraph(
  nodes: DagNode[],
  edges: DagEdge[],
): { successors: Map<string, string[]>; indegree: Map<string, number> } {
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const n of nodes) {
    successors.set(n.id, []);
    indegree.set(n.id, 0);
  }
  for (const e of edges) {
    if (!successors.has(e.from) || !indegree.has(e.to)) continue;
    successors.get(e.from)?.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  return { successors, indegree };
}

/** Mutable state threaded through the Kahn relaxation. */
interface KahnState {
  rank: Map<string, number>;
  remaining: Map<string, number>;
  queue: string[];
}

/**
 * Relax one node's outgoing edges: lift each successor's rank and enqueue it
 * once all its predecessors have been processed.
 */
function relaxNode(id: string, successors: Map<string, string[]>, st: KahnState): void {
  const here = st.rank.get(id) ?? 0;
  for (const next of successors.get(id) ?? []) {
    if (here + 1 > (st.rank.get(next) ?? 0)) st.rank.set(next, here + 1);
    const left = (st.remaining.get(next) ?? 0) - 1;
    st.remaining.set(next, left);
    if (left === 0) st.queue.push(next);
  }
}

/**
 * Assign each node a rank (column index) = longest dependency path from a root.
 *
 * Kahn's topological pass: a node's rank is one past its deepest predecessor.
 * Cycle-safe: nodes that are part of a cycle are simply never dequeued and keep
 * rank 0, so a malformed cyclic graph still renders instead of looping forever.
 */
function assignRanks(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const { successors, indegree } = buildGraph(nodes, edges);

  const rank = new Map<string, number>();
  for (const n of nodes) rank.set(n.id, 0);

  const st: KahnState = {
    rank,
    remaining: new Map(indegree),
    queue: nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id),
  };

  while (st.queue.length > 0) {
    const id = st.queue.shift();
    if (id === undefined) break;
    relaxNode(id, successors, st);
  }

  return rank;
}

// ---------------------------------------------------------------------------
// Position assignment
// ---------------------------------------------------------------------------

/** Group node ids by rank, preserving the incoming node order within each rank. */
function groupByRank(nodes: DagNode[], rank: Map<string, number>): Map<number, DagNode[]> {
  const byRank = new Map<number, DagNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const bucket = byRank.get(r);
    if (bucket) bucket.push(n);
    else byRank.set(r, [n]);
  }
  return byRank;
}

/** Build the 4-point cubic-bezier control points for an LR edge. */
function bezierPoints(
  from: PositionedNode,
  to: PositionedNode,
): ReadonlyArray<{ x: number; y: number }> {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return [
    { x: x1, y: y1 },
    { x: mx, y: y1 },
    { x: mx, y: y2 },
    { x: x2, y: y2 },
  ];
}

// ---------------------------------------------------------------------------
// Public entry: computeLayout
// ---------------------------------------------------------------------------

/** FRD sort key: the numeric part of "frd-NN-…" (unknown/empty sorts last). */
function frdOrderKey(frd: string): number {
  const m = /^frd-(\d+)/i.exec(frd);
  return m?.[1] !== undefined ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

/** Lane label: "frd-01-data-reading" → "FRD-01 · Data reading"; "" → "Sin FRD". */
function laneLabel(frd: string): string {
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

/**
 * FRD-level super-graph from the WO edges: a cross-FRD edge A→B ⇒ FRD(A) → FRD(B).
 * Returns each FRD's dependents + its cross-FRD in-degree (for root detection).
 */
function buildFrdSuperGraph(
  nodes: DagNode[],
  edges: DagEdge[],
  frds: string[],
): { dependents: Map<string, Set<string>>; indegree: Map<string, number> } {
  const frdOf = new Map<string, string>();
  for (const n of nodes) frdOf.set(n.id, n.frd ?? "");
  const dependents = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const frd of frds) {
    dependents.set(frd, new Set());
    indegree.set(frd, 0);
  }
  for (const e of edges) {
    const a = frdOf.get(e.from);
    const b = frdOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    if (!dependents.get(a)?.has(b)) {
      dependents.get(a)?.add(b);
      indegree.set(b, (indegree.get(b) ?? 0) + 1);
    }
  }
  return { dependents, indegree };
}

/**
 * Order FRD groups (Map frd → nodes) so RELATED FRDs sit ADJACENT, top-to-bottom
 * (DR-087 follow-up, red-team verdict 2026-06-24: swimlanes-ordered-by-dependency
 * over a force-directed/Obsidian layout, which would be non-deterministic and would
 * destroy the directional reading).
 *
 * Builds the FRD super-graph (a cross-FRD WO edge A→B ⇒ FRD(A) → FRD(B), i.e. "B's
 * FRD depends on A's FRD") and emits a **DFS pre-order from the prerequisite roots**:
 * each dependency chain is contiguous and a prerequisite FRD is immediately followed
 * by its dependents — so e.g. FRD-18 (which depends on FRD-01) lands right under
 * FRD-01 instead of 17 bands away, and cross-FRD edges become short + downward.
 * Deterministic (numeric FRD tie-break everywhere) and cycle-safe (a cross-FRD cycle
 * falls through to the numeric pass). No 2D packing, no new dependency.
 */
function orderedFrdGroups(nodes: DagNode[], edges: DagEdge[]): Array<[string, DagNode[]]> {
  const groups = groupNodesByFrd(nodes);
  const frds = [...groups.keys()];
  const { dependents, indegree } = buildFrdSuperGraph(nodes, edges, frds);

  const byNum = (x: string, y: string): number => {
    const kx = frdOrderKey(x);
    const ky = frdOrderKey(y);
    return kx !== ky ? kx - ky : x.localeCompare(y);
  };

  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (frd: string): void => {
    if (visited.has(frd)) return;
    visited.add(frd);
    order.push(frd);
    for (const dep of [...(dependents.get(frd) ?? [])].sort(byNum)) visit(dep);
  };
  // Prerequisite roots first (no cross-FRD dependency), in numeric order → each chain contiguous.
  for (const frd of frds.filter((f) => (indegree.get(f) ?? 0) === 0).sort(byNum)) visit(frd);
  // Anything left (caught in a cross-FRD cycle) → deterministic numeric fallback.
  for (const frd of [...frds].sort(byNum)) visit(frd);

  return order.map((frd) => [frd, groups.get(frd) ?? []]);
}

/**
 * Lay out the DAG as **FRD swimlanes** (DR-087 follow-up).
 *
 * Each FRD is a labeled horizontal band; within a band, its work orders flow
 * left-to-right by the band's INTERNAL dependency depth (only intra-FRD edges
 * rank the columns), and rows stack within a column. Bands are ordered top-to-
 * bottom by FRD number. This replaces the single global layered layout, whose
 * rank-0 column piled up every dependency-free work order into one giant column.
 *
 * Cross-FRD edges still render (flagged `crossFrd` for a distinct style); the
 * canvas is sized exactly to its content. Empty input → empty layout.
 */
export function computeLayout(nodes: DagNode[], edges: DagEdge[]): DagLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], lanes: [], width: 0, height: 0 };
  }

  const posById = new Map<string, PositionedNode>();
  const lanes: DagLane[] = [];
  let cursorY = PAD;
  let maxWidth = 0;

  for (const [frd, laneNodes] of orderedFrdGroups(nodes, edges)) {
    const laneIds = new Set(laneNodes.map((n) => n.id));
    // Rank by INTRA-FRD edges only — the band's internal dependency depth.
    const intraEdges = edges.filter((e) => laneIds.has(e.from) && laneIds.has(e.to));
    const rank = assignRanks(laneNodes, intraEdges);
    const byRank = groupByRank(laneNodes, rank);
    const maxRows = Math.max(...[...byRank.values()].map((b) => b.length));
    const maxRank = Math.max(...[...byRank.keys()]);

    const nodesTop = cursorY + LANE_HEADER_H;
    for (const [r, bucket] of byRank) {
      bucket.forEach((node, row) => {
        posById.set(node.id, {
          ...node,
          x: PAD + r * COL_STEP,
          y: nodesTop + row * ROW_STEP,
          width: NODE_W,
          height: NODE_H,
        });
      });
    }

    const laneHeight = LANE_HEADER_H + (maxRows * ROW_STEP - (ROW_STEP - NODE_H));
    lanes.push({ frd, label: laneLabel(frd), y: cursorY, height: laneHeight });
    maxWidth = Math.max(maxWidth, PAD + maxRank * COL_STEP + NODE_W);
    cursorY += laneHeight + LANE_GAP;
  }

  const positionedNodes = nodes.map((n) => posById.get(n.id)).filter(isPositioned);

  const positionedEdges: PositionedEdge[] = [];
  for (const e of edges) {
    const from = posById.get(e.from);
    const to = posById.get(e.to);
    if (!from || !to) continue;
    const crossFrd = (from.frd ?? "") !== (to.frd ?? "");
    positionedEdges.push({ ...e, points: bezierPoints(from, to), crossFrd });
  }

  const width = maxWidth + PAD;
  const height = cursorY - LANE_GAP + PAD;

  return { nodes: positionedNodes, edges: positionedEdges, lanes, width, height };
}

/** Type guard: a defined PositionedNode (drops any lookup miss). */
function isPositioned(n: PositionedNode | undefined): n is PositionedNode {
  return n !== undefined;
}

// ---------------------------------------------------------------------------
// Edge derivation — make the graph read as a dependency graph even when the
// work orders carry no explicit `dependsOn`.
// ---------------------------------------------------------------------------

/** WorkOrder shape this module needs for edge derivation. */
export interface DepSource {
  id: string;
  frd: string;
  dependsOn?: string[];
}

/**
 * Build the `dependsOn` map used to construct the DAG.
 *
 * Dependencies are REAL (DR-087): each work order's `dependsOn` is read from its
 * frontmatter — the machine-readable source of truth. We keep only entries that
 * resolve to a known work order and drop self-references; a work order with no
 * declared dependencies becomes an INDEPENDENT node. There is no fabricated
 * fallback: the old "depends on the previous WO in its FRD" chain drew edges
 * that did not exist (a linear chain that misrepresented the real graph).
 *
 * Returns a new list of `{ ...wo, dependsOn }` ready for `toDag`.
 */
export function deriveDeps<T extends DepSource>(
  workOrders: readonly T[],
): Array<T & { dependsOn: string[] }> {
  const idSet = new Set(workOrders.map((w) => w.id.trim()));

  return workOrders.map((wo) => {
    const deps = (wo.dependsOn ?? [])
      .map((d) => d.trim())
      .filter((d) => idSet.has(d) && d !== wo.id.trim());
    return { ...wo, dependsOn: [...new Set(deps)] };
  });
}
