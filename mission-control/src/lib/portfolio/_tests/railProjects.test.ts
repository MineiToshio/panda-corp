/**
 * railProjects() — the Portfolio rail membership rule (FRD-03 REQ-03-001).
 *
 * The rail lists ONLY projects that have started development: `implementation` (building) and
 * `release` (shipped). `architecture` projects stay OUT of the rail, yet `activeProjects()` (the
 * dashboard cards, REQ-18-016, and the workspace route lookup) keeps them.
 */

import { describe, expect, it } from "vitest";
import { FIXTURE_FULL, withFactoryRoot } from "../../../tests/fixtures";
import { activeProjects, railProjects } from "../portfolio";

const PORTFOLIO = [
  "| Name | Path | Phase |",
  "| --- | --- | --- |",
  "| in-product | /nope/product | product |",
  "| in-design | /nope/design | design |",
  "| in-architecture | /nope/architecture | architecture |",
  "| in-build | /nope/build | implementation |",
  "| is-shipped | /nope/shipped | shipped |",
].join("\n");

describe("railProjects — REQ-03-001 membership", () => {
  it("excludes product, design and architecture projects (advisory phase cell)", () => {
    const names = railProjects(PORTFOLIO).map((p) => p.name);

    expect(names).toEqual(["in-build", "is-shipped"]);
  });

  it("excludes a project whose status.yaml declares phase architecture", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = railProjects().map((p) => p.name);

      expect(names).not.toContain("proj-architecture");
      expect(names).toEqual(
        expect.arrayContaining(["proj-a", "proj-release", "proj-operation", "proj-broken-path"]),
      );
    });
  });

  it("keeps architecture projects in activeProjects (dashboard cards + workspace lookup)", () => {
    const names = activeProjects(PORTFOLIO).map((p) => p.name);

    expect(names).toEqual(["in-architecture", "in-build", "is-shipped"]);
  });
});
