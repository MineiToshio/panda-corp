import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { getLastCommit } from "../lastCommit";

afterEach(() => vi.unstubAllEnvs());
it("AC-03-008.1: callable git resolver reads committed fixture activity without host git", () => {
  vi.stubEnv("MC_GIT_FIXTURE", path.resolve("docs/design/prototype/fixtures/git-state.json"));
  expect(getLastCommit("/fixture/projects/funko-tracker")).toEqual({
    at: "2026-10-20T18:40:11-05:00",
  });
});
