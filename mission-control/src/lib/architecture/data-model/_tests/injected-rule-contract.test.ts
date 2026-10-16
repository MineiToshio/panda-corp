import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDataModel } from "../model";

// The portable producer instructions must publish models the real viewer can consume.
const rule = readFileSync(
  resolve(process.cwd(), "../plugin/templates/rules/logical-data-model.md"),
  "utf8",
);
const examples = Array.from(rule.matchAll(/```json\n([\s\S]*?)\n```/g), (match) =>
  JSON.parse(match[1] ?? ""),
);

describe("injected logical-model publishing contract", () => {
  it("keeps the factory rule and the project copy identical and always applicable", () => {
    expect(readFileSync("docs/rules/logical-data-model.md", "utf8")).toBe(rule);
    expect(rule.split("---")[1]).toMatch(/^applies_when: always$/m);
  });

  it("publishes both no-database and mapped relational examples the actual reader accepts", () => {
    expect(examples).toHaveLength(2);
    expect(validateDataModel(examples[0])).toEqual({ kind: "none" });
    const result = validateDataModel(examples[1]);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("Publisher contract does not match viewer");
    const relationship = result.model.relationships[0];
    expect(relationship?.from).toEqual({
      entity: "user",
      attributes: ["id"],
      min: 1,
      max: 1,
    });
    expect(relationship?.to).toEqual({
      entity: "profile",
      attributes: ["userId"],
      min: 0,
      max: 1,
    });
  });
});
