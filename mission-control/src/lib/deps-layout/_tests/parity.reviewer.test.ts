import { describe, expect, it } from "vitest";
import { dependencyChain } from "../chain";
import { frdLayout } from "../frd-layout";
import { aggregateFrdLinks } from "../frd-links";
import { workOrderLayout } from "../work-order-layout";

const o = (id: string, frd: string, ...dependsOn: string[]) => ({ id, frd, dependsOn });
const frds = ["a", "b", "c"].map((s, i) => ({
  slug: `frd-0${i + 1}-${s}`,
  code: `FRD-0${i + 1}`,
  title: s,
}));
const [A = "", B = "", C = ""] = frds.map((frd) => frd.slug);

describe("layout boundaries", () => {
  it("AC-12-004.8: input order and state never change a byte of geometry", () => {
    const orders = [
      o("WO-01-001", A),
      o("WO-01-002", A, "WO-01-001"),
      o("WO-02-001", B, "WO-01-002"),
    ];
    const reversed = [...orders].reverse();
    expect(
      JSON.stringify(workOrderLayout(reversed).nodes.sort((x, y) => x.id.localeCompare(y.id))),
    ).toBe(JSON.stringify(workOrderLayout(orders).nodes.sort((x, y) => x.id.localeCompare(y.id))));
    expect(frdLayout(reversed, frds).boxes.map((b) => b.ids)).toEqual(
      frdLayout(orders, frds).boxes.map((b) => b.ids),
    );
  });
  it("AC-12-004.7: no dependsOn, no edge; duplicate and dangling ids draw nothing extra", () => {
    const orders = [
      o("WO-01-001", A),
      o("WO-01-002", A),
      o("WO-01-003", A, "WO-01-001", "WO-01-001", "WO-99-999"),
    ];
    expect(workOrderLayout(orders).edges.map((e) => [e.from, e.to])).toEqual([
      ["WO-01-001", "WO-01-003"],
    ]);
    expect(frdLayout(orders, frds).links).toEqual([]);
  });
  it("AC-12-004.8: tied opposite directions go to the lower code and keep the back count", () => {
    const orders = [
      o("WO-01-001", A, "WO-02-002"),
      o("WO-02-001", B, "WO-01-002"),
      o("WO-01-002", A),
      o("WO-02-002", B),
    ];
    expect(aggregateFrdLinks(orders, frds)).toEqual([{ from: A, to: B, count: 1, backCount: 1 }]);
  });
  it("AC-12-004.1: boxes hold two per row and a 4-item box wraps to a second row of three", () => {
    const orders = [
      ...["1", "2", "3", "4"].map((n) => o(`WO-01-00${n}`, A)),
      o("WO-02-001", B),
      o("WO-03-001", C),
    ];
    const { boxes } = frdLayout(orders, frds);
    expect(boxes.map((b) => [b.x, b.y === boxes[0]?.y])).toEqual([
      [20, true],
      [552, true],
      [20, false],
    ]);
    expect(boxes[0]?.height).toBe(46 + 24 + 2 * 48 - 8);
  });
  it("AC-12-004.2: a cycle terminates and the chain excludes the focus itself", () => {
    const orders = [o("WO-01-001", A, "WO-01-002"), o("WO-01-002", A, "WO-01-001")];
    expect(dependencyChain(orders, "WO-01-001")).toEqual({
      upstream: ["WO-01-002"],
      downstream: ["WO-01-002"],
    });
    expect(dependencyChain(orders, "WO-99-999")).toEqual({ upstream: [], downstream: [] });
  });
  it("AC-12-004.7: an FRD filter keeps direct neighbours dashed and nothing further", () => {
    const orders = [
      o("WO-01-001", A),
      o("WO-02-001", B, "WO-01-001"),
      o("WO-03-001", C, "WO-02-001"),
    ];
    const { nodes } = workOrderLayout(orders, B);
    expect(nodes.map((n) => [n.id, n.outOfScope])).toEqual([
      ["WO-01-001", true],
      ["WO-02-001", false],
      ["WO-03-001", true],
    ]);
    const edge = workOrderLayout(orders, A).nodes.map((n) => n.id);
    expect(edge).toEqual(["WO-01-001", "WO-02-001"]);
  });
  it("AC-12-004.7: an unknown FRD filter is ignored", () => {
    const orders = [o("WO-01-001", A)];
    expect(workOrderLayout(orders, "frd-99-nope")).toEqual(workOrderLayout(orders));
  });
});
