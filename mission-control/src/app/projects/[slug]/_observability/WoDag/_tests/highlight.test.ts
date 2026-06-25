/**
 * highlight tests — the color-on-select model (computeHighlight).
 *
 * Asserts the prototype's light() semantics: a selected WO lights its intra
 * transitive chain (within its FRD) + its FRD's IMMEDIATE neighbors (1 hop, not
 * transitive), and assigns each highlighted line a distinct trace-palette color.
 */

import { describe, expect, it } from "vitest";
import type { DagEdge, DagNode } from "@/app/_observability/dag/dag/dag";
import { computeHighlight, crossKey, intraKey } from "../highlight";
import { computeLayout } from "../layout";

const NODES: DagNode[] = [
  { id: "WO-01-001", title: "a", state: "done", frd: "frd-01" },
  { id: "WO-01-002", title: "b", state: "todo", frd: "frd-01" }, // intra dep on 001
  { id: "WO-02-001", title: "c", state: "todo", frd: "frd-02" }, // dep on 002 (cross 01→02)
  { id: "WO-03-001", title: "d", state: "todo", frd: "frd-03" }, // dep on 02-001 (cross 02→03)
];
const EDGES: DagEdge[] = [
  { from: "WO-01-001", to: "WO-01-002" },
  { from: "WO-01-002", to: "WO-02-001" },
  { from: "WO-02-001", to: "WO-03-001" },
];

function highlightFor(id: string) {
  const layout = computeLayout(NODES, EDGES);
  return computeHighlight({
    selectedId: id,
    nodes: NODES,
    edges: EDGES,
    intraEdges: layout.intraEdges,
    crossEdges: layout.crossEdges,
  });
}

describe("computeHighlight", () => {
  it("returns null for an unknown WO id", () => {
    expect(highlightFor("WO-99-999")).toBeNull();
  });

  it("lights the selected WO's intra transitive chain within its FRD", () => {
    const h = highlightFor("WO-01-002");
    expect(h?.chain.has("WO-01-002")).toBe(true);
    expect(h?.chain.has("WO-01-001")).toBe(true); // intra ancestor
    // A WO in another FRD is NOT on the intra chain.
    expect(h?.chain.has("WO-02-001")).toBe(false);
  });

  it("lights the FRD + its IMMEDIATE neighbors only (not transitive across FRDs)", () => {
    const h = highlightFor("WO-01-002");
    expect(h?.frds.has("frd-01")).toBe(true); // own FRD
    expect(h?.frds.has("frd-02")).toBe(true); // immediate neighbor (01→02)
    // frd-03 is two hops away (01→02→03) → NOT lit (immediate-only, by design).
    expect(h?.frds.has("frd-03")).toBe(false);
  });

  it("colors each highlighted line with a distinct trace token", () => {
    const h = highlightFor("WO-01-002");
    // The intra edge 001→002 is on the chain → gets a trace color.
    expect(h?.intraColor.get(intraKey("WO-01-001", "WO-01-002"))).toMatch(/--color-trace-/);
    // The cross edge 01→02 touches the selected FRD → gets a trace color.
    expect(h?.crossColor.get(crossKey("frd-01", "frd-02"))).toMatch(/--color-trace-/);
    // The cross edge 02→03 does NOT touch frd-01 → no trace color.
    expect(h?.crossColor.get(crossKey("frd-02", "frd-03"))).toBeUndefined();
  });

  it("is deterministic for the same selection (stable color assignment)", () => {
    const a = highlightFor("WO-01-002");
    const b = highlightFor("WO-01-002");
    expect([...(b?.intraColor ?? [])]).toEqual([...(a?.intraColor ?? [])]);
    expect([...(b?.crossColor ?? [])]).toEqual([...(a?.crossColor ?? [])]);
  });
});
