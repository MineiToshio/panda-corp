import { describe, expect, it } from "vitest";
import { dataModelFixture } from "@/test/dataModelFixture";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../entityGeometry";
import { layoutModel } from "../layout";

describe("independent field-level layout", async () => {
  it("keeps an isolated entity, parallel edges and a self edge finite and deterministic", async () => {
    const model = dataModelFixture();
    const layout = await layoutModel(model);
    expect(await layoutModel(model)).toEqual(layout);
    expect(layout.nodes.map((node) => node.entity.id)).toEqual(["person", "task", "isolated"]);
    expect(layout.edges.map((edge) => edge.relationship.id)).toEqual([
      "authored",
      "reviewed",
      "managed",
    ]);
    expect(new Set(layout.edges.map((edge) => JSON.stringify(edge.points))).size).toBe(3);
    for (const edge of layout.edges) {
      expect(edge.points.length).toBeGreaterThan(1);
      for (const point of edge.points) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it("connects scalar mappings to their actual field rows, independent of stable field IDs", async () => {
    const layout = await layoutModel(dataModelFixture());
    const person = layout.nodes.find((node) => node.entity.id === "person");
    const self = layout.edges.find((edge) => edge.relationship.id === "managed");
    if (!person || !self) throw new Error("Fixture must contain the self relation");
    expect(self.points[0]?.y).toBe(person.y + HEADER_HEIGHT + ROW_HEIGHT * 2.5);
    expect(self.points.at(-1)?.y).toBe(person.y + HEADER_HEIGHT + ROW_HEIGHT * 1.5);
    expect(self.points[0]?.y).not.toBe(self.points.at(-1)?.y);
  });
});
