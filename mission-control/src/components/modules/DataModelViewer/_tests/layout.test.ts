import { describe, expect, it } from "vitest";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../entityGeometry";
import { layoutModel } from "../layout";
import { modelFixture } from "./fixture";

describe("ERD layout", async () => {
  it("keeps isolated entities and every parallel/self relation, deterministically", async () => {
    const model = modelFixture();
    const result = await layoutModel(model);
    expect(result.nodes.map((node) => node.entity.id)).toEqual(["account", "entry", "audit"]);
    expect(result.edges.map((edge) => edge.relationship.id)).toEqual([
      "ownership",
      "review",
      "self",
    ]);
    expect(await layoutModel(model)).toEqual(result);
    const ownership = result.edges.find((edge) => edge.relationship.id === "ownership");
    const review = result.edges.find((edge) => edge.relationship.id === "review");
    expect(ownership?.points).not.toEqual(review?.points);
    expect(
      result.edges.find((edge) => edge.relationship.id === "self")?.points.length,
    ).toBeGreaterThan(2);
  });
  it("anchors mapped endpoint fields to their own attribute rows", async () => {
    const result = await layoutModel(modelFixture());
    const target = result.nodes.find((node) => node.entity.id === "entry");
    const edge = result.edges.find((edge) => edge.relationship.id === "review");
    expect(target).toBeDefined();
    expect(edge?.points.at(-1)?.y).toBe((target?.y ?? 0) + HEADER_HEIGHT + ROW_HEIGHT * 2.5);
  });
});
