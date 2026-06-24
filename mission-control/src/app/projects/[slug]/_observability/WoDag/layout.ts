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
}

export interface DagLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
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

/**
 * Lay out the DAG into compact topological columns.
 *
 * Columns flow left-to-right by dependency depth; rows stack within a column.
 * The canvas is sized exactly to its content (capped by the node grid), so it
 * fits the tab and never produces a giant empty area.
 */
export function computeLayout(nodes: DagNode[], edges: DagEdge[]): DagLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const rank = assignRanks(nodes, edges);
  const byRank = groupByRank(nodes, rank);
  const maxRank = Math.max(...[...byRank.keys()]);
  const maxRows = Math.max(...[...byRank.values()].map((b) => b.length));

  const posById = new Map<string, PositionedNode>();
  for (const [r, bucket] of byRank) {
    // Vertically centre each column's rows against the tallest column so the
    // graph reads as a balanced ladder rather than top-anchored ragged rows.
    const colHeight = bucket.length * ROW_STEP;
    const fullHeight = maxRows * ROW_STEP;
    const yOffset = (fullHeight - colHeight) / 2;
    bucket.forEach((node, row) => {
      posById.set(node.id, {
        ...node,
        x: PAD + r * COL_STEP,
        y: PAD + yOffset + row * ROW_STEP,
        width: NODE_W,
        height: NODE_H,
      });
    });
  }

  const positionedNodes = nodes.map((n) => posById.get(n.id)).filter(isPositioned);

  const positionedEdges: PositionedEdge[] = [];
  for (const e of edges) {
    const from = posById.get(e.from);
    const to = posById.get(e.to);
    if (!from || !to) continue;
    positionedEdges.push({ ...e, points: bezierPoints(from, to) });
  }

  const width = PAD * 2 + maxRank * COL_STEP + NODE_W;
  const height = PAD * 2 + maxRows * ROW_STEP - (ROW_STEP - NODE_H);

  return { nodes: positionedNodes, edges: positionedEdges, width, height };
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
