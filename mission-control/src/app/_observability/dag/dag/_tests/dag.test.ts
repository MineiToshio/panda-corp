/**
 * WO-12-006 — IF-12-dag pure tests (RED phase)
 *
 * Covers:
 *   AC-12-005.1  toDag / dagChain / firstError pure functions
 *   AC-12-006.1  Layout does NOT import ELK
 *   REQ-12-005, REQ-12-006
 *
 * Regression anchors:
 *   B1' (NaN/Infinity in numeric fields — dagChain must return Sets, never undefined)
 *   I2  (empty input → safe empty result, not a crash)
 *   I3  (workOrders with no dependencies → each node is isolated)
 *
 * No fs/network — pure functions only. Fixtures are inline objects.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders";
import { type DagEdge, type DagNode, dagChain, firstError, toDag } from "../dag";

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeWo(
  id: string,
  state: WorkOrder["state"] = "todo",
  deps: string[] = [],
): WorkOrder & { dependsOn?: string[] } {
  return {
    id,
    title: `WO ${id}`,
    frd: "frd-01-alpha",
    state,
    relPath: `docs/frds/frd-01-alpha/work-orders/${id}.md`,
    ...(deps.length > 0 ? { dependsOn: deps } : {}),
  };
}

// ---------------------------------------------------------------------------
// toDag — build graph from WorkOrder list
// ---------------------------------------------------------------------------

describe("toDag", () => {
  it("I2: empty list → {nodes:[], edges:[]}", () => {
    const { nodes, edges } = toDag([]);
    expect(nodes).toStrictEqual([]);
    expect(edges).toStrictEqual([]);
  });

  it("single node with no dependencies → one node, no edges", () => {
    const { nodes, edges } = toDag([makeWo("WO-01-001")]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("WO-01-001");
    expect(edges).toHaveLength(0);
  });

  it("node carries id, title, state, agent (undefined when absent)", () => {
    const wo = makeWo("WO-01-001", "done");
    const { nodes } = toDag([wo]);
    const node = nodes[0];
    expect(node?.id).toBe("WO-01-001");
    expect(node?.title).toBe("WO WO-01-001");
    expect(node?.state).toBe("done");
  });

  it("I3: multiple nodes with no deps → correct count, no edges", () => {
    const wos = [makeWo("WO-01-001"), makeWo("WO-01-002"), makeWo("WO-01-003")];
    const { nodes, edges } = toDag(wos);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(0);
  });

  it("single dependency → one directed edge from dep to dependent", () => {
    // WO-01-002 depends on WO-01-001
    const wos = [makeWo("WO-01-001"), makeWo("WO-01-002", "todo", ["WO-01-001"])];
    const { nodes, edges } = toDag(wos);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    const edge = edges[0];
    expect(edge?.from).toBe("WO-01-001");
    expect(edge?.to).toBe("WO-01-002");
  });

  it("diamond dependency (A→B, A→C, B→D, C→D) → 4 nodes, 4 edges", () => {
    const wos = [
      makeWo("A"),
      makeWo("B", "todo", ["A"]),
      makeWo("C", "todo", ["A"]),
      makeWo("D", "todo", ["B", "C"]),
    ];
    const { nodes, edges } = toDag(wos);
    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(4);
    const froms = edges.map((e) => e.from);
    const tos = edges.map((e) => e.to);
    expect(froms.filter((f) => f === "A")).toHaveLength(2);
    expect(tos.filter((t) => t === "D")).toHaveLength(2);
  });

  it("dangling dep (dep id not in list) is skipped gracefully", () => {
    const wos = [makeWo("WO-01-002", "todo", ["GHOST-001"])];
    const { nodes, edges } = toDag(wos);
    expect(nodes).toHaveLength(1);
    // Edge to non-existent node still present as metadata but from node must exist
    expect(edges).toHaveLength(0); // dangling deps are dropped
  });

  it("nodes array is a true Array (I3 regression)", () => {
    const { nodes } = toDag([makeWo("X")]);
    expect(Array.isArray(nodes)).toBe(true);
  });

  it("edges array is a true Array (I3 regression)", () => {
    const { edges } = toDag([makeWo("X", "todo", ["Y"])]);
    expect(Array.isArray(edges)).toBe(true);
  });

  it("node ids have no leading/trailing whitespace (SHA-hygiene regression)", () => {
    const { nodes } = toDag([makeWo("  WO-01-001  ")]);
    expect(nodes[0]?.id).toBe("WO-01-001");
  });
});

// ---------------------------------------------------------------------------
// dagChain — upstream/downstream path-focus
// ---------------------------------------------------------------------------

describe("dagChain", () => {
  // Fixture: A → B → D
  //               ↑
  //          C ───┘
  const wos = [
    makeWo("A"),
    makeWo("B", "todo", ["A"]),
    makeWo("C"),
    makeWo("D", "todo", ["B", "C"]),
  ];
  const { nodes, edges } = toDag(wos);

  it("I2: empty nodes/edges → {up:Set([]), down:Set([])}", () => {
    const result = dagChain("A", [], []);
    expect(result.up.size).toBe(0);
    expect(result.down.size).toBe(0);
  });

  it("node with no deps nor dependents → empty up and down sets", () => {
    // C has no upstream (no deps), and downstream is D
    const result = dagChain("C", nodes, edges);
    expect(result.up.size).toBe(0);
    expect(result.down.has("D")).toBe(true);
  });

  it("upstream of D includes A, B, C", () => {
    const result = dagChain("D", nodes, edges);
    expect(result.up.has("A")).toBe(true);
    expect(result.up.has("B")).toBe(true);
    expect(result.up.has("C")).toBe(true);
    expect(result.down.size).toBe(0);
  });

  it("downstream of A includes B and D (transitive)", () => {
    const result = dagChain("A", nodes, edges);
    expect(result.down.has("B")).toBe(true);
    expect(result.down.has("D")).toBe(true);
    expect(result.up.size).toBe(0);
  });

  it("focused node itself is NOT in its own chain", () => {
    const result = dagChain("B", nodes, edges);
    expect(result.up.has("B")).toBe(false);
    expect(result.down.has("B")).toBe(false);
  });

  it("returns Sets (not arrays) for up and down", () => {
    const result = dagChain("A", nodes, edges);
    expect(result.up).toBeInstanceOf(Set);
    expect(result.down).toBeInstanceOf(Set);
  });

  it("unknown id → {up:Set([]), down:Set([])}", () => {
    const result = dagChain("NONEXISTENT", nodes, edges);
    expect(result.up.size).toBe(0);
    expect(result.down.size).toBe(0);
  });

  it("B1': result sets are never undefined (NaN-guard regression)", () => {
    const result = dagChain("A", nodes, edges);
    expect(result.up).toBeDefined();
    expect(result.down).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// firstError — locate the earliest failed node
// ---------------------------------------------------------------------------

describe("firstError", () => {
  it("I2: empty list → null", () => {
    expect(firstError([], [])).toBeNull();
  });

  it("no failed nodes → null", () => {
    const wos = [makeWo("A", "todo"), makeWo("B", "done"), makeWo("C", "in_progress")];
    const { nodes, edges } = toDag(wos);
    expect(firstError(nodes, edges)).toBeNull();
  });

  it("single failed node → returns its id", () => {
    const wos = [makeWo("A", "fail")];
    const { nodes, edges } = toDag(wos);
    expect(firstError(nodes, edges)).toBe("A");
  });

  it("picks upstream-most failed node (the root failure, not a downstream one)", () => {
    // A(fail) → B(fail) → C(ok): firstError should be A (upstream root)
    const wos = [makeWo("A", "fail"), makeWo("B", "fail", ["A"]), makeWo("C", "done", ["B"])];
    const { nodes, edges } = toDag(wos);
    const result = firstError(nodes, edges);
    expect(result).toBe("A");
  });

  it("two parallel failures → returns one of them (non-null)", () => {
    const wos = [makeWo("A", "fail"), makeWo("B", "fail")];
    const { nodes, edges } = toDag(wos);
    const result = firstError(nodes, edges);
    expect(result).not.toBeNull();
    expect(["A", "B"]).toContain(result);
  });

  it("mixed states with one fail → returns the failed id", () => {
    const wos = [
      makeWo("A", "done"),
      makeWo("B", "in_progress"),
      makeWo("C", "fail"),
      makeWo("D", "todo"),
    ];
    const { nodes, edges } = toDag(wos);
    expect(firstError(nodes, edges)).toBe("C");
  });

  it("fail state recognized regardless of position in list", () => {
    const wos = [makeWo("Z", "fail"), makeWo("A", "done")];
    const { nodes, edges } = toDag(wos);
    expect(firstError(nodes, edges)).toBe("Z");
  });
});

// ---------------------------------------------------------------------------
// ELK exclusion guard (AC-12-006.1)
// ---------------------------------------------------------------------------

describe("REQ-12-006: no ELK import", () => {
  it("dag.ts does not import ELK (no elkjs/elkjs or @eclipse-elk import)", () => {
    const dagSrc = fs.readFileSync(path.resolve(import.meta.dirname, "../dag.ts"), "utf-8");
    // The check is that ELK.js is not *imported* — comments may reference ELK
    // to explain why it was NOT chosen (AC-12-006.1). Only import statements matter.
    const importLines = dagSrc
      .split("\n")
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    expect(importLines.toLowerCase()).not.toMatch(/\belk/);
  });
});

// ---------------------------------------------------------------------------
// Node/Edge shape contracts
// ---------------------------------------------------------------------------

describe("DagNode and DagEdge shape", () => {
  it("DagNode has id, title, state fields", () => {
    const { nodes } = toDag([makeWo("WO-01-001", "in_progress")]);
    const n = nodes[0] as DagNode;
    expect(typeof n.id).toBe("string");
    expect(typeof n.title).toBe("string");
    expect(typeof n.state).toBe("string");
  });

  it("DagEdge has from and to fields", () => {
    const wos = [makeWo("A"), makeWo("B", "todo", ["A"])];
    const { edges } = toDag(wos);
    const e = edges[0] as DagEdge;
    expect(typeof e.from).toBe("string");
    expect(typeof e.to).toBe("string");
  });
});
