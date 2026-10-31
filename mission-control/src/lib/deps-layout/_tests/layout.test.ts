import { describe, expect, it } from "vitest";
import { dependencyChain } from "../chain";
import { frdLayout } from "../frd-layout";
import { workOrderLayout } from "../work-order-layout";

const orders = [
  { id: "WO-01-001", frd: "frd-01-a", dependsOn: [] },
  { id: "WO-01-002", frd: "frd-01-a", dependsOn: ["WO-01-001"] },
  { id: "WO-02-001", frd: "frd-02-b", dependsOn: ["WO-01-002", "unknown"] },
  { id: "WO-02-002", frd: "frd-02-b", dependsOn: [] },
];
const frds = [
  { slug: "frd-01-a", code: "FRD-01", title: "A" },
  { slug: "frd-02-b", code: "FRD-02", title: "B" },
];
describe("dependency geometry", () => {
  it("AC-12-004.1 AC-12-004.7: natural depth columns, real edges only, no invented sequential chain", () => {
    const result = workOrderLayout(orders);
    expect(result.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "WO-01-001", x: 16, y: 16 },
      { id: "WO-01-002", x: 256, y: 16 },
      { id: "WO-02-001", x: 496, y: 16 },
      { id: "WO-02-002", x: 16, y: 74 },
    ]);
    expect(result.edges.map((edge) => [edge.from, edge.to])).toEqual([
      ["WO-01-001", "WO-01-002"],
      ["WO-01-002", "WO-02-001"],
    ]);
    expect(result.width).toBe(688);
    expect(result.height).toBe(136);
  });
  it("AC-12-004.8: byte-deterministic from structure only; two FRD boxes with chain-ranked mini nodes", () => {
    const result = frdLayout(orders, frds);
    expect(result.boxes.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: 20, y: 20, width: 322, height: 110 },
      { x: 552, y: 20, width: 322, height: 110 },
    ]);
    expect(result.items.map((item) => [item.id, item.x, item.y])).toEqual([
      ["WO-01-001", 32, 78],
      ["WO-01-002", 186, 78],
      ["WO-02-001", 564, 78],
      ["WO-02-002", 718, 78],
    ]);
    expect(
      JSON.stringify(
        frdLayout(
          orders.map((order) => ({ ...order, state: "done" })),
          frds,
        ),
      ),
    ).toBe(JSON.stringify(result));
  });
  it("AC-12-004.2: full chains, scope includes direct neighbours, unknown focus ignored and cycles terminate", () => {
    expect(dependencyChain(orders, "WO-01-002")).toEqual({
      upstream: ["WO-01-001"],
      downstream: ["WO-02-001"],
    });
    expect(dependencyChain(orders, "missing")).toEqual({ upstream: [], downstream: [] });
    const scoped = workOrderLayout(orders, "frd-02-b");
    expect(scoped.nodes.find((node) => node.id === "WO-01-002")?.outOfScope).toBe(true);
    const first = orders[0],
      second = orders[1];
    if (!first || !second) throw new Error("Missing fixture orders");
    const cyclic = [{ ...first, dependsOn: ["WO-01-002"] }, second];
    const cycleLayout = workOrderLayout(cyclic);
    expect(cycleLayout.nodes).toHaveLength(2);
    expect(Number.isFinite(cycleLayout.height)).toBe(true);
    expect(dependencyChain(cyclic, "WO-01-001").upstream).not.toContain("WO-01-001");
  });
  it("AC-12-004.8: aggregates dominant direction with minority back count", () => {
    const a = orders[0],
      b = orders[2],
      c = orders[3];
    if (!a || !b || !c) throw new Error("Fixture missing");
    const result = frdLayout(
      [
        { ...a, dependsOn: [b.id] },
        { ...b, dependsOn: [a.id] },
        { ...c, dependsOn: [a.id] },
      ],
      frds,
    );
    expect(result.links.map((link) => [link.from, link.to, link.count, link.backCount])).toEqual([
      ["frd-01-a", "frd-02-b", 2, 1],
    ]);
  });
});
