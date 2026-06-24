/**
 * WoDag layout tests — the pure layered-layout + dependency-derivation module.
 *
 * Covers the two reasons the DAG now reads as a dependency graph (and stays
 * compact) regardless of the input:
 *   - deriveDeps: explicit `dependsOn` wins; otherwise a sequential chain within
 *     each FRD (from the WO-NN-MMM id sequence).
 *   - computeLayout: topological columns (rank = longest dependency path),
 *     compact fixed-size nodes, a canvas sized exactly to its content.
 */

import { describe, expect, it } from "vitest";
import type { DagNode } from "@/app/_observability/dag/dag/dag";
import { COL_STEP, computeLayout, deriveDeps, NODE_W, PAD } from "../layout";

interface Wo {
  id: string;
  frd: string;
  dependsOn?: string[];
}

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
    expect(byId["WO-02-002"]).toEqual([]); // no fabricated edge to 001
    expect(byId["WO-02-003"]).toEqual([]);
  });

  it("keeps real cross-dependencies verbatim (fan-in + non-sequential)", () => {
    const wos: Wo[] = [
      { id: "WO-06-001", frd: "FRD-06", dependsOn: ["WO-06-012"] }, // dep on a LATER id
      { id: "WO-06-012", frd: "FRD-06" },
      { id: "WO-06-005", frd: "FRD-06", dependsOn: ["WO-06-001", "WO-06-012"] }, // fan-in
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-06-001"]).toEqual(["WO-06-012"]);
    expect(byId["WO-06-005"]?.sort()).toEqual(["WO-06-001", "WO-06-012"]);
    expect(byId["WO-06-012"]).toEqual([]);
  });

  it("does not chain across different FRDs", () => {
    const wos: Wo[] = [
      { id: "WO-03-001", frd: "FRD-03" },
      { id: "WO-04-001", frd: "FRD-04" },
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-03-001"]).toEqual([]);
    expect(byId["WO-04-001"]).toEqual([]);
  });

  it("drops a dangling or self explicit dep (no fabricated fallback)", () => {
    const wos: Wo[] = [
      { id: "WO-05-001", frd: "FRD-05" },
      // points at a non-existent WO and at itself → both dropped → no deps left
      { id: "WO-05-002", frd: "FRD-05", dependsOn: ["WO-99-999", "WO-05-002"] },
    ];
    const byId = Object.fromEntries(deriveDeps(wos).map((w) => [w.id, w.dependsOn]));
    expect(byId["WO-05-002"]).toEqual([]); // dropped, NOT chained to 001
  });
});

describe("computeLayout", () => {
  const nodes: DagNode[] = [
    { id: "A", title: "A", state: "done" },
    { id: "B", title: "B", state: "todo" },
    { id: "C", title: "C", state: "todo" },
  ];
  const edges = [
    { from: "A", to: "B" },
    { from: "B", to: "C" },
  ];

  it("places nodes in topological columns (A=0, B=1, C=2)", () => {
    const { nodes: out } = computeLayout(nodes, edges);
    const xOf = (id: string) => out.find((n) => n.id === id)?.x ?? -1;
    expect(xOf("A")).toBe(PAD + 0 * COL_STEP);
    expect(xOf("B")).toBe(PAD + 1 * COL_STEP);
    expect(xOf("C")).toBe(PAD + 2 * COL_STEP);
  });

  it("sizes the canvas exactly to the column grid (no giant empty area)", () => {
    const { width } = computeLayout(nodes, edges);
    // 3 ranks (0..2) → width = pad*2 + maxRank*COL_STEP + NODE_W
    expect(width).toBe(PAD * 2 + 2 * COL_STEP + NODE_W);
  });

  it("returns an empty layout for no nodes (defensive)", () => {
    expect(computeLayout([], [])).toEqual({ nodes: [], edges: [], lanes: [], width: 0, height: 0 });
  });

  it("groups nodes into FRD swimlanes, ordered by FRD number (DR-087 follow-up)", () => {
    const nodes: DagNode[] = [
      { id: "WO-02-001", title: "b", state: "todo", frd: "frd-02-ideas-board" },
      { id: "WO-01-001", title: "a", state: "done", frd: "frd-01-data-reading" },
      { id: "WO-01-002", title: "a2", state: "done", frd: "frd-01-data-reading" },
    ];
    const out = computeLayout(nodes, [{ from: "WO-01-001", to: "WO-01-002" }]);
    expect(out.lanes.map((l) => l.frd)).toEqual(["frd-01-data-reading", "frd-02-ideas-board"]);
    expect(out.lanes[0]?.label).toMatch(/FRD-01/);
    // The frd-02 node sits in a band BELOW frd-01's nodes (swimlanes stack vertically).
    const yOf = (id: string) => out.nodes.find((n) => n.id === id)?.y ?? -1;
    expect(yOf("WO-02-001")).toBeGreaterThan(yOf("WO-01-001"));
    // Within frd-01, the dependent is one column to the right of its dependency.
    const xOf = (id: string) => out.nodes.find((n) => n.id === id)?.x ?? -1;
    expect(xOf("WO-01-002")).toBeGreaterThan(xOf("WO-01-001"));
  });

  it("flags a cross-FRD edge as crossFrd", () => {
    const nodes: DagNode[] = [
      { id: "WO-01-001", title: "a", state: "done", frd: "frd-01-data-reading" },
      { id: "WO-02-001", title: "b", state: "todo", frd: "frd-02-ideas-board" },
    ];
    const out = computeLayout(nodes, [{ from: "WO-01-001", to: "WO-02-001" }]);
    expect(out.edges[0]?.crossFrd).toBe(true);
  });

  it("orders FRD bands by dependency (prerequisite before dependent), not by number", () => {
    const nodes: DagNode[] = [
      { id: "WO-02-001", title: "dependent", state: "todo", frd: "frd-02-x" },
      { id: "WO-05-001", title: "prereq", state: "done", frd: "frd-05-y" },
    ];
    // WO-02-001 depends on WO-05-001 ⇒ FRD-05 (prereq) must sit ABOVE FRD-02 despite its higher number.
    const out = computeLayout(nodes, [{ from: "WO-05-001", to: "WO-02-001" }]);
    expect(out.lanes.map((l) => l.frd)).toEqual(["frd-05-y", "frd-02-x"]);
  });

  it("places a dependent FRD adjacent to its prerequisite (DFS-contiguous chain)", () => {
    // FRD-18 depends on FRD-01; FRD-02 + FRD-03 are unrelated. FRD-18 must land right after FRD-01.
    const nodes: DagNode[] = [
      { id: "WO-01-001", title: "root", state: "done", frd: "frd-01-data" },
      { id: "WO-02-001", title: "other", state: "todo", frd: "frd-02-ideas" },
      { id: "WO-03-001", title: "other2", state: "todo", frd: "frd-03-portfolio" },
      { id: "WO-18-001", title: "dependent", state: "todo", frd: "frd-18-inicio" },
    ];
    const out = computeLayout(nodes, [{ from: "WO-01-001", to: "WO-18-001" }]);
    const order = out.lanes.map((l) => l.frd);
    expect(order.indexOf("frd-18-inicio")).toBe(order.indexOf("frd-01-data") + 1);
  });

  it("does not loop on a cyclic graph (renders a degraded layout)", () => {
    const cyclic = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];
    const { nodes: out } = computeLayout(
      [
        { id: "A", title: "A", state: "todo" },
        { id: "B", title: "B", state: "todo" },
      ],
      cyclic,
    );
    expect(out).toHaveLength(2);
  });
});
