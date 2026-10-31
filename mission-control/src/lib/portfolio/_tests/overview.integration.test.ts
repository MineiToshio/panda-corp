import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { FIXTURE_FULL, withFactoryRoot } from "@/tests/fixtures";
import { getProjectOverview } from "../overview";

afterEach(() => vi.unstubAllEnvs());
it("AC-03-008.1 REQ-03-001: real readers compose the committed factory without dropping early or missing projects", async () => {
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  vi.stubEnv("MC_GIT_FIXTURE", path.resolve("docs/design/prototype/fixtures/git-state.json"));
  await withFactoryRoot(FIXTURE_FULL, () => {
    const projects = getProjectOverview();
    expect(projects).toHaveLength(7);
    expect(projects.find((p) => p.name === "proj-a")).toMatchObject({
      id: "proj-a",
      stageIndex: 5,
      pathMissing: false,
      counts: {
        ordersVerified: 0,
        ordersTotal: 1,
        frds: 1,
        docs: 7,
        adrs: 1,
        openChanges: 0,
        pendingDecisions: 2,
      },
      nextCommand: "/pandacorp:implement",
    });
    expect(projects.find((p) => p.name === "proj-product")?.phase).toBe("product");
    const missing = projects.find((p) => p.name === "proj-broken-path");
    expect(missing?.pathMissing).toBe(true);
    expect(Object.values(missing?.counts ?? {})).toEqual(Array(7).fill(null));
  });
});
