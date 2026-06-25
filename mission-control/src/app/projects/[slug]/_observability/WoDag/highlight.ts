/**
 * highlight — the color-on-select model for the 2D WoDag.
 *
 * Ported from the prototype's light()/unlight() (dag-2d.generator.mjs). Given a
 * selected (pinned or hovered) WO, it computes:
 *   - its intra transitive WO chain WITHIN its FRD (undirected BFS, bounded),
 *   - its FRD's IMMEDIATE FRD neighbors (1 hop) — cross transitive was rejected
 *     because it lights the whole graph,
 *   - per-line trace colors so crossing highlighted lines stay traceable.
 *
 * Pure + deterministic. No React, no I/O.
 */

import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import type { CrossEdge, IntraEdge } from "./layout";

/** The categorical trace palette — references the --color-trace-N design tokens. */
const TRACE_TOKENS: readonly string[] = [
  "var(--color-trace-1)",
  "var(--color-trace-2)",
  "var(--color-trace-3)",
  "var(--color-trace-4)",
  "var(--color-trace-5)",
  "var(--color-trace-6)",
  "var(--color-trace-7)",
  "var(--color-trace-8)",
  "var(--color-trace-9)",
  "var(--color-trace-10)",
];

/** The resolved highlight state for one selection. */
export interface Highlight {
  /** WO ids on the selected WO's intra transitive chain (incl. itself). */
  readonly chain: ReadonlySet<string>;
  /** FRD slugs to outline: the selected FRD + its immediate neighbors. */
  readonly frds: ReadonlySet<string>;
  /** Trace color (a --color-trace-N var) per intra edge, keyed "from→to". */
  readonly intraColor: ReadonlyMap<string, string>;
  /** Trace color per cross edge, keyed "fromFrd→toFrd". */
  readonly crossColor: ReadonlyMap<string, string>;
}

/** Undirected key for an intra edge. */
export function intraKey(from: string, to: string): string {
  return `${from}→${to}`;
}

/** Undirected key for a cross edge. */
export function crossKey(fromFrd: string, toFrd: string): string {
  return `${fromFrd}→${toFrd}`;
}

/** Build the FRD-of map + the two undirected adjacencies the highlight needs. */
function buildAdjacency(
  nodes: DagNode[],
  edges: DagEdge[],
): {
  frdOf: Map<string, string>;
  intraAdj: Map<string, Set<string>>;
  frdAdj: Map<string, Set<string>>;
} {
  const frdOf = new Map<string, string>();
  for (const n of nodes) frdOf.set(n.id, n.frd ?? "");

  const intraAdj = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]));
  const frdAdj = new Map<string, Set<string>>();
  for (const n of nodes) frdAdj.set(n.frd ?? "", new Set<string>());

  for (const e of edges) {
    const a = frdOf.get(e.from);
    const b = frdOf.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (a === b) {
      intraAdj.get(e.from)?.add(e.to);
      intraAdj.get(e.to)?.add(e.from);
    } else {
      frdAdj.get(a)?.add(b);
      frdAdj.get(b)?.add(a);
    }
  }
  return { frdOf, intraAdj, frdAdj };
}

/** Undirected BFS over an adjacency map, including the start node. */
function bfs(start: string, adj: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const n = queue.shift();
    if (n === undefined) continue;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        queue.push(m);
      }
    }
  }
  return seen;
}

/** Inputs for {@link computeHighlight}. */
export interface HighlightInput {
  selectedId: string;
  nodes: DagNode[];
  edges: DagEdge[];
  intraEdges: IntraEdge[];
  crossEdges: CrossEdge[];
}

/**
 * Compute the highlight for a selected WO id. Returns `null` if the id is not in
 * the graph. Edges are colored in their layout order so the assignment is stable.
 */
export function computeHighlight(input: HighlightInput): Highlight | null {
  const { selectedId, nodes, edges, intraEdges, crossEdges } = input;
  const { frdOf, intraAdj, frdAdj } = buildAdjacency(nodes, edges);
  const selectedFrd = frdOf.get(selectedId);
  if (selectedFrd === undefined) return null;

  const chain = bfs(selectedId, intraAdj);
  const frds = new Set<string>([selectedFrd]);
  for (const nb of frdAdj.get(selectedFrd) ?? []) frds.add(nb);

  // Trace colors: cross + intra each cycle the palette independently (mirrors
  // the prototype's two counters ci / ii).
  const crossColor = new Map<string, string>();
  let ci = 0;
  for (const ce of crossEdges) {
    if (ce.fromFrd === selectedFrd || ce.toFrd === selectedFrd) {
      crossColor.set(crossKey(ce.fromFrd, ce.toFrd), token(ci++));
    }
  }
  const intraColor = new Map<string, string>();
  let ii = 0;
  for (const ie of intraEdges) {
    if (chain.has(ie.from) && chain.has(ie.to)) {
      intraColor.set(intraKey(ie.from, ie.to), token(ii++));
    }
  }

  return { chain, frds, intraColor, crossColor };
}

/** Trace token at a cycling index. */
function token(i: number): string {
  return TRACE_TOKENS[i % TRACE_TOKENS.length] ?? "var(--color-accent)";
}
