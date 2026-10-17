import { describe, expect, it } from "vitest";
import { validateDataModel } from "@/lib/architecture/data-model/model";
import { layoutModel } from "../layout";

describe("opaque model identities", async () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "a:b.c/d",
    "árbol",
  ])("lays out valid opaque ID %s without dropping it", async (id) => {
    const result = validateDataModel({
      schemaVersion: 1,
      persistence: "document",
      entities: [{ id, name: "Modelo", attributes: [] }],
      relationships: [
        {
          id: "loop",
          from: { entity: id, min: 0, max: 1 },
          to: { entity: id, min: 0, max: "many" },
        },
      ],
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("Review fixture must be valid");
    const layout = await layoutModel(result.model);
    expect(layout.nodes.map((node) => node.entity.id)).toEqual([id]);
    expect(layout.edges).toHaveLength(1);
    expect(Number.isFinite(layout.width)).toBe(true);
  });
});
