import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ClockConfigError, now } from "@/lib/clock/clock";
import { runGit } from "@/lib/git/git";
import { GitError } from "@/lib/git/gitError";
import { woVerifiedSeries } from "../flowSeries";
import { phaseTransitions } from "../phaseTransitions";

vi.mock("@/lib/git/git", async (original) => ({
  ...(await original<typeof import("@/lib/git/git")>()),
  runGit: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it.each([
  "failed",
  "timeout",
  "no-fixture-answer",
] as const)("REQ-01-011: a %s history read never becomes a successful empty series", (kind) => {
  vi.mocked(runGit).mockImplementation((args) => {
    if (args[0] === "rev-parse") return "true";
    throw new GitError(kind, "Unavailable history");
  });
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.resolve("docs/design/prototype/fixtures/factory-root"));
  expect(
    woVerifiedSeries(path.resolve("docs/design/prototype/fixtures/projects/mission-control")),
  ).toEqual({ ok: false, reason: "git-unavailable" });
  expect(phaseTransitions()).toEqual({ ok: false, reason: "git-unavailable" });
});
it("REQ-01-008: an invalid frozen clock never falls through to the owner wall clock", () => {
  vi.stubEnv("MC_CLOCK", "invalid");
  expect(() => now()).toThrow(ClockConfigError);
});
