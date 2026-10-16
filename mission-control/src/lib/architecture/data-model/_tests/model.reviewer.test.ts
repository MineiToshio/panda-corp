import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataModelFixture } from "@/test/dataModelFixture";
import { validateDataModel } from "../model";

describe("independent artifact boundary", () => {
  it("reads the actual Mission Control artifact as explicit filesystem persistence absence", () => {
    const raw: unknown = JSON.parse(readFileSync("docs/product/data-model.json", "utf8"));
    expect(validateDataModel(raw)).toEqual({ kind: "none" });
  });

  it("keeps foreign-language labels and all independent references intact", () => {
    const raw = dataModelFixture();
    expect(validateDataModel(raw)).toEqual({
      kind: "ready",
      model: raw,
      source: "docs/product/data-model.json",
    });
  });

  it("rejects a repeated reference within a composite mapping rather than silently deduplicating", () => {
    const model = dataModelFixture();
    const relationship = model.relationships[0];
    if (!relationship) throw new Error("Missing fixture relation");
    expect(
      validateDataModel({
        ...model,
        relationships: [
          { ...relationship, from: { ...relationship.from, attributes: ["tenant", "tenant"] } },
        ],
      }).kind,
    ).toBe("error");
  });

  it.each([
    { entities: Array(101).fill(null) },
    { relationships: Array(401).fill(null) },
    { entities: [{ id: "large", name: "Large", attributes: Array(101).fill(null) }] },
    { entities: [{ id: "long", name: "x".repeat(201), attributes: [] }] },
    { persistence: "none", entities: [], relationships: [{ id: "invented" }] },
    { schemaVersion: 1, persistence: "none", entities: [], relationships: [], typo: true },
  ])("fails loudly for malformed or excessive model %j", (override) => {
    expect(validateDataModel({ ...dataModelFixture(), ...override }).kind).toBe("error");
  });
});
