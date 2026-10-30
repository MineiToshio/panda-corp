/**
 * Reviewer-authored (DR-080, FRD-21 gate): pointing the Mission Control folder at the factory repository must
 * not take away the folder's own frozen activity stamp, which other surfaces read from the same seam.
 */
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fixtureGit } from "../fixtureGit";

const FIXTURES = path.resolve("docs/design/prototype/fixtures");
const FILE = path.join(FIXTURES, "git-state.json");

beforeEach(() => {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.join(FIXTURES, "factory-root"));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

it("REQ-21-006: the Mission Control folder keeps its own last activity in the oracle seed", () => {
  const cwd = path.join(FIXTURES, "projects", "mission-control");
  expect(fixtureGit(FILE, ["log", "-1", "--format=%cI"], cwd)).toBe("2026-10-20T16:10:24-05:00");
});

it("AC-21-007.1: the Mission Control folder answers as the factory repository for the worktree read", () => {
  const cwd = path.join(FIXTURES, "projects", "mission-control");
  expect(fixtureGit(FILE, ["worktree", "list", "--porcelain"], cwd)).toContain(
    "worktree /workspace/panda-corp",
  );
});
