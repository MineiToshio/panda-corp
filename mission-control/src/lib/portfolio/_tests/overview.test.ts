import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_FULL, withFactoryRoot } from "@/tests/fixtures";
import { formatAgo } from "../formatAgo";
import { getLastCommit } from "../lastCommit";
import { activeProjects, allProjects } from "../portfolio";

vi.mock("@/lib/git/git", () => ({ runGit: vi.fn() }));

import { runGit } from "@/lib/git/git";

describe("portfolio composition", () => {
  it("REQ-03-001/006: includes every phase and unknown/missing projects; activeProjects keeps its live set", () => {
    const phases = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "producto",
      "diseño",
      "unknown",
    ];
    const content = [
      "| Name | Path | Phase |",
      "|---|---|---|",
      ...phases.map((p, i) => `| project-${i} | /missing/${i} | ${p} |`),
    ].join("\n");
    expect(allProjects(content).map((p) => p.stage)).toEqual([
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "product",
      "design",
      undefined,
    ]);
    expect(allProjects(content).every((p) => !p.exists)).toBe(true);
    expect(activeProjects(content).map((p) => p.stage)).toEqual([
      "architecture",
      "implementation",
      "release",
    ]);
  });
  it("REQ-03-001: real status is authoritative over advisory phases", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(allProjects().find((p) => p.name === "proj-product")?.stage).toBe("product");
      expect(allProjects().find((p) => p.name === "proj-a")?.stage).toBe("implementation");
    });
  });
});

describe("AC-03-008.1: last movement and relative ages", () => {
  beforeEach(() => vi.mocked(runGit).mockReset());
  afterEach(() => vi.unstubAllEnvs());
  it("uses the fixture-safe git seam and project cwd", () => {
    vi.stubEnv("MC_GIT_FIXTURE", "fixture.json");
    vi.mocked(runGit).mockReturnValue("2026-10-30T10:00:00Z");
    expect(getLastCommit("/project")).toEqual({ at: "2026-10-30T10:00:00Z" });
    expect(runGit).toHaveBeenCalledWith(["log", "-1", "--format=%cI"], "/project");
  });
  it("keeps failures explicit, including invalid git dates", () => {
    expect(getLastCommit("/missing/project")).toEqual({ at: null, reason: "no-repository" });
    vi.stubEnv("MC_GIT_FIXTURE", "fixture.json");
    vi.mocked(runGit).mockImplementation(() => {
      throw new Error("read failed");
    });
    expect(getLastCommit("/project")).toEqual({ at: null, reason: "unreadable" });
    vi.mocked(runGit).mockReturnValue("invalid");
    expect(getLastCommit("/project")).toEqual({ at: null, reason: "unreadable" });
  });
  it.each([
    [0, "hace menos de 1 h"],
    [1, "hace 1 h"],
    [47, "hace 47 h"],
    [48, "hace 2 días"],
  ])("formats %s hours through the frozen catalogue", (hours, expected) => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(formatAgo(new Date(now.getTime() - Number(hours) * 3600000).toISOString(), now)).toBe(
      expected,
    );
  });
});
