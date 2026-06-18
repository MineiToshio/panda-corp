/**
 * WO-12-006 — IF-12-dag: pure DAG functions
 *
 * Interfaces:
 *   toDag(workOrders)          → { nodes: DagNode[], edges: DagEdge[] }
 *   dagChain(id, nodes, edges) → { up: Set<string>, down: Set<string> }
 *   firstError(nodes, edges)   → string | null
 *
 * Traces: REQ-12-005, REQ-12-006, AC-12-005.1, AC-12-006.1
 *
 * Pure module — no I/O, no side-effects. Dagre layout lives in WorkOrderDag.tsx
 * (client-only). This module is NOT allowed to import ELK (REQ-12-006).
 *
 * Consumes: lib/work-orders (WorkOrder type + optional dependsOn field that
 * the DAG view augments onto the base type).
 */

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DagNode {
  /** Work order id — trimmed, whitespace-free. */
  id: string;
  title: string;
  state: WorkOrderState;
  /** CSS token reference for node color (from AGENT_COLOR or state-derived). */
  colorToken?: string;
}

export interface DagEdge {
  /** Source node id (dependency). */
  from: string;
  /** Target node id (dependent). */
  to: string;
}

export interface DagGraph {
  nodes: DagNode[];
  edges: DagEdge[];
}

export interface DagChainResult {
  /** Ids of all upstream nodes (transitive ancestors). */
  up: Set<string>;
  /** Ids of all downstream nodes (transitive descendants). */
  down: Set<string>;
}

// ---------------------------------------------------------------------------
// WorkOrder with optional dependency extension
// Agents may attach `dependsOn` to the WorkOrder at the call site.
// ---------------------------------------------------------------------------
type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

// ---------------------------------------------------------------------------
// toDag — build graph from WorkOrder list
// ---------------------------------------------------------------------------

/**
 * Convert a flat list of work orders into a DAG (nodes + directed edges).
 *
 * Edge direction: dependency → dependent  (i.e. from → to means "from" must
 * complete before "to" can start — topological order flows left-to-right).
 *
 * Dangling deps (dep id not present in the list) are silently dropped so
 * the graph never references a node that isn't rendered (I2 guard).
 *
 * Pure: no I/O, no side-effects, no Dagre call (layout lives in the client
 * component). Never throws — empty input → empty graph (I2).
 */
export function toDag(workOrders: WorkOrderWithDeps[]): DagGraph {
  if (workOrders.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Index by trimmed id for O(1) existence checks (dangling-dep guard).
  const idSet = new Set(workOrders.map((wo) => wo.id.trim()));

  const nodes: DagNode[] = workOrders.map((wo) => ({
    id: wo.id.trim(),
    title: wo.title.trim(),
    state: wo.state,
  }));

  const edges: DagEdge[] = [];
  for (const wo of workOrders) {
    const targetId = wo.id.trim();
    for (const depId of wo.dependsOn ?? []) {
      const fromId = depId.trim();
      // Drop dangling deps — dep must exist as a node in this graph.
      if (idSet.has(fromId)) {
        edges.push({ from: fromId, to: targetId });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// dagChain — upstream/downstream BFS for path-focus
// ---------------------------------------------------------------------------

/**
 * Compute the full upstream (ancestors) and downstream (descendants) sets
 * for a given node id in the DAG.
 *
 * Used by WorkOrderDag to highlight only the dependency chain of a hovered
 * node and dim the rest (AC-12-005.1).
 *
 * Pure BFS — no mutation of the input arrays.
 * Returns {up: Set, down: Set} with the focused node itself excluded from
 * both sets (it is the pivot, not part of its own chain).
 *
 * Unknown id or empty graph → {up: Set([]), down: Set([])} (B1' guard).
 */
export function dagChain(id: string, nodes: DagNode[], edges: DagEdge[]): DagChainResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const up = new Set<string>();
  const down = new Set<string>();

  if (!nodeIds.has(id) || nodes.length === 0) {
    return { up, down };
  }

  // Build adjacency for fast BFS.
  // predecessors: node → set of nodes that point TO it (upstream)
  // successors:   node → set of nodes it points TO (downstream)
  const predecessors = new Map<string, Set<string>>();
  const successors = new Map<string, Set<string>>();

  for (const n of nodes) {
    predecessors.set(n.id, new Set());
    successors.set(n.id, new Set());
  }

  for (const edge of edges) {
    successors.get(edge.from)?.add(edge.to);
    predecessors.get(edge.to)?.add(edge.from);
  }

  // BFS upstream (follow predecessor links).
  const upQueue: string[] = [...(predecessors.get(id) ?? [])];
  while (upQueue.length > 0) {
    const cur = upQueue.shift();
    if (cur === undefined || cur === id || up.has(cur)) continue;
    up.add(cur);
    for (const pred of predecessors.get(cur) ?? []) {
      if (!up.has(pred)) upQueue.push(pred);
    }
  }

  // BFS downstream (follow successor links).
  const downQueue: string[] = [...(successors.get(id) ?? [])];
  while (downQueue.length > 0) {
    const cur = downQueue.shift();
    if (cur === undefined || cur === id || down.has(cur)) continue;
    down.add(cur);
    for (const succ of successors.get(cur) ?? []) {
      if (!down.has(succ)) downQueue.push(succ);
    }
  }

  return { up, down };
}

// ---------------------------------------------------------------------------
// firstError — locate the upstream-most failed node
// ---------------------------------------------------------------------------

/**
 * Find the "first" (topologically earliest / most-upstream) node with
 * state "fail" in the DAG.
 *
 * Algorithm: prefer a failed node that has NO failed ancestor — i.e. the root
 * cause. If multiple such root-cause failures exist, return the one whose id
 * comes first alphabetically (deterministic for tests and UI).
 *
 * Returns null when no failed node exists (I2 guard).
 */
export function firstError(nodes: DagNode[], edges: DagEdge[]): string | null {
  if (nodes.length === 0) return null;

  const failed = nodes.filter((n) => n.state === "fail");
  if (failed.length === 0) return null;

  if (failed.length === 1) {
    return failed[0]?.id ?? null;
  }

  const failedIds = new Set(failed.map((n) => n.id));

  // For each failed node, check if any of its upstream nodes is also failed.
  // A root-cause failure has no failed ancestor.
  const rootFailures: string[] = [];
  for (const node of failed) {
    const { up } = dagChain(node.id, nodes, edges);
    const hasFailedAncestor = [...up].some((ancestorId) => failedIds.has(ancestorId));
    if (!hasFailedAncestor) {
      rootFailures.push(node.id);
    }
  }

  // Deterministic: sort alphabetically and return the first.
  rootFailures.sort();
  return rootFailures[0] ?? failed[0]?.id ?? null;
}
