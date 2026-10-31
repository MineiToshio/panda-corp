import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readServiceManualPages } from "../manual";
import type { ServicesDirectoryData } from "../types";
import { directoryAccountRows, projectServiceRows } from "../views";
import { servicesFixture } from "./fixture";

describe("account derivations", () => {
  it("AC-26-005.1: frozen prototype counts 7 active, 1 pending, 2 candidate, 0 reference", () => {
    const source = fs.readFileSync(path.resolve("docs/design/prototype/data/snapshot.js"), "utf8");
    const snapshot = JSON.parse(source.slice(source.indexOf("{")).trim().replace(/;$/, "")) as {
      services: ServicesDirectoryData;
    };
    const rows = directoryAccountRows(snapshot.services);
    expect(
      ["active", "pending", "candidate", "reference"].map(
        (state) => rows.filter((row) => row.state === state).length,
      ),
    ).toEqual([7, 1, 2, 0]);
  });
  it("AC-26-005.1 AC-26-006.1 AC-26-011.1: precedence, one row per allocation, state then name sorting", () => {
    const data = servicesFixture();
    const provider = data.providers[0];
    const allocation = data.allocations[0];
    if (!provider || !allocation) throw new Error("Missing fixture rows");
    provider.adoption = "reference";
    expect(
      directoryAccountRows(data)
        .filter((row) => row.provider.id === "neon")
        .every((row) => row.state === "reference"),
    ).toBe(true);
    data.allocations.push({
      ...allocation,
      integrationId: "extra",
      status: "configured",
    });
    expect(projectServiceRows(data, "demo").map((row) => row.allocation.integrationId)).toEqual([
      "extra",
      "database",
    ]);
  });
  it("AC-26-009.1: public Manual never reads identities", () => {
    const pages = readServiceManualPages(path.resolve("e2e/fixtures/factory-root"));
    expect(JSON.stringify(pages)).not.toMatch(
      /first@example.com|second@example.com|credential_ref/,
    );
  });
});
