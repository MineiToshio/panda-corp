/**
 * WoDag layout tests — the pure, deterministic 2D COMPOUND (cluster) layout +
 * the dependency derivation.
 *
 * Covers the contract the 2D port must hold:
 *   - deriveDeps: explicit `dependsOn` wins, no fabricated chain (DR-087).
 *   - computeLayout: FRD clusters positioned with NO overlap, DETERMINISTIC
 *     (same input twice → identical output), cards placed by intra-FRD rank,
 *     intra edges at WO level, cross edges AGGREGATED to one FRD→FRD line.
 */

import { describe, expect, it } from "vitest";
import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import { deriveDeps } from "../deps";
import { CARD_COL_W, computeLayout, type DagLayout } from "../layout";

interface Wo {
  id: string;
  frd: string;
  dependsOn?: string[];
}

// ---------------------------------------------------------------------------
// deriveDeps (unchanged behavior — real deps only)
// ---------------------------------------------------------------------------

describe("deriveDeps", () => {
  it("keeps explicit dependsOn verbatim (real data wins)", () => {
    const wos: Wo[] = [
      { id: "WO-01-001", frd: "FRD-01" },
      { id: "WO-01-002", frd: "FRD-01", dependsOn: ["WO-01-001"] },
    ];
    const out = deriveDeps(wos);
    expect(out.find((w) => w.id === "WO-01-002")?.dependsOn).toEqual(["WO-01-001"]);
  });

  it("does NOT fabricate a chain: WOs with no explicit deps are independent (DR-087)", () => {
    const wos: Wo[] = [
      { id: "WO-02-001", frd: "FRD-02" },
      { id: "WO-02-002", frd: "FRD-02" },
      { id: "WO-02-003", frd: "FRD-02" },
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-02-001"]).toEqual([]);
    expect(byId["WO-02-002"]).toEqual([]);
    expect(byId["WO-02-003"]).toEqual([]);
  });

  it("keeps real cross-dependencies verbatim (fan-in + non-sequential)", () => {
    const wos: Wo[] = [
      { id: "WO-06-001", frd: "FRD-06", dependsOn: ["WO-06-012"] },
      { id: "WO-06-012", frd: "FRD-06" },
      { id: "WO-06-005", frd: "FRD-06", dependsOn: ["WO-06-001", "WO-06-012"] },
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-06-001"]).toEqual(["WO-06-012"]);
    expect(byId["WO-06-005"]?.sort()).toEqual(["WO-06-001", "WO-06-012"]);
    expect(byId["WO-06-012"]).toEqual([]);
  });

  it("drops a dangling or self explicit dep (no fabricated fallback)", () => {
    const wos: Wo[] = [
      { id: "WO-05-001", frd: "FRD-05" },
      { id: "WO-05-002", frd: "FRD-05", dependsOn: ["WO-99-999", "WO-05-002"] },
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-05-002"]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeLayout — 2D compound model
// ---------------------------------------------------------------------------

/** A small multi-FRD graph used across the layout cases. */
const NODES: DagNode[] = [
  { id: "WO-01-001", title: "a", state: "done", frd: "frd-01-data" },
  { id: "WO-01-002", title: "b", state: "todo", frd: "frd-01-data" },
  { id: "WO-02-001", title: "c", state: "todo", frd: "frd-02-board" },
  { id: "WO-03-001", title: "d", state: "todo", frd: "frd-03-other" },
];
const EDGES: DagEdge[] = [
  { from: "WO-01-001", to: "WO-01-002" }, // intra FRD-01
  { from: "WO-01-002", to: "WO-02-001" }, // cross FRD-01 → FRD-02
  { from: "WO-01-001", to: "WO-02-001" }, // cross FRD-01 → FRD-02 (aggregates)
];

/** AABB overlap test between two positioned clusters. */
function overlaps(a: DagLayout["clusters"][number], b: DagLayout["clusters"][number]): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("computeLayout — 2D clusters", () => {
  it("returns an empty layout for no nodes (defensive)", () => {
    expect(computeLayout([], [])).toEqual({
      clusters: [],
      cards: [],
      intraEdges: [],
      crossEdges: [],
      crossWoLinks: [],
      width: 0,
      height: 0,
    });
  });

  it("produces one cluster box per FRD with a derived label", () => {
    const { clusters } = computeLayout(NODES, EDGES);
    expect(clusters.map((c) => c.frd).sort()).toEqual([
      "frd-01-data",
      "frd-02-board",
      "frd-03-other",
    ]);
    const frd01 = clusters.find((c) => c.frd === "frd-01-data");
    expect(frd01?.label).toMatch(/FRD-01/);
  });

  it("never lets two cluster boxes overlap (AABB no-overlap pass)", () => {
    const { clusters } = computeLayout(NODES, EDGES);
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        if (a && b) expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it("is DETERMINISTIC: same input twice → byte-identical layout (no jitter)", () => {
    const first = computeLayout(NODES, EDGES);
    const second = computeLayout(NODES, EDGES);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("places cards inside their cluster box", () => {
    const { clusters, cards } = computeLayout(NODES, EDGES);
    const byFrd = new Map(clusters.map((c) => [c.frd, c]));
    for (const card of cards) {
      const box = byFrd.get(card.clusterFrd);
      expect(box).toBeDefined();
      if (!box) continue;
      expect(card.x).toBeGreaterThanOrEqual(box.x);
      expect(card.y).toBeGreaterThanOrEqual(box.y);
      expect(card.x + card.width).toBeLessThanOrEqual(box.x + box.w + 0.001);
      expect(card.y + card.height).toBeLessThanOrEqual(box.y + box.h + 0.001);
    }
  });

  it("lays out a cluster's cards by intra-FRD rank (dependent one column right)", () => {
    const { cards } = computeLayout(NODES, EDGES);
    const xOf = (id: string) => cards.find((c) => c.id === id)?.x ?? -1;
    // WO-01-002 depends on WO-01-001 (intra) → one CARD_COL_W to the right.
    expect(xOf("WO-01-002") - xOf("WO-01-001")).toBe(CARD_COL_W);
  });

  it("keeps intra edges at the WO level (one per intra dependency)", () => {
    const { intraEdges } = computeLayout(NODES, EDGES);
    expect(intraEdges).toHaveLength(1);
    expect(intraEdges[0]).toMatchObject({ from: "WO-01-001", to: "WO-01-002" });
    expect(intraEdges[0]?.points).toHaveLength(4); // cubic bezier
  });

  it("AGGREGATES cross edges to ONE line per directed FRD pair (weight counts WOs)", () => {
    const { crossEdges } = computeLayout(NODES, EDGES);
    // Two WO deps cross FRD-01 → FRD-02, aggregated into a single directed line.
    expect(crossEdges).toHaveLength(1);
    expect(crossEdges[0]).toMatchObject({
      fromFrd: "frd-01-data",
      toFrd: "frd-02-board",
      weight: 2,
    });
    // Stroke width grows with weight (prototype: 1.1 + n*0.22, capped 3).
    expect(crossEdges[0]?.strokeWidth).toBeCloseTo(1.1 + 2 * 0.22, 5);
  });

  it("keeps each underlying cross WO dep addressable (crossWoLinks)", () => {
    const { crossWoLinks } = computeLayout(NODES, EDGES);
    const keys = crossWoLinks.map((l) => `${l.from}-${l.to}`).sort();
    expect(keys).toEqual(["WO-01-001-WO-02-001", "WO-01-002-WO-02-001"]);
  });

  it("sizes the canvas to enclose every cluster plus the outer margin", () => {
    const { clusters, width, height } = computeLayout(NODES, EDGES);
    for (const c of clusters) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(width);
      expect(c.y + c.h).toBeLessThanOrEqual(height);
    }
  });

  it("does not loop on a cyclic intra graph (renders a degraded layout)", () => {
    const cyclic: DagEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];
    const { cards } = computeLayout(
      [
        { id: "A", title: "A", state: "todo", frd: "frd-01" },
        { id: "B", title: "B", state: "todo", frd: "frd-01" },
      ],
      cyclic,
    );
    expect(cards).toHaveLength(2);
  });
});
