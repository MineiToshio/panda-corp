import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { currentSeal } from "@/lib/achievements/read-model/seal";
import { now } from "@/lib/clock/clock";
import { runGit } from "@/lib/git/git";
import { woVerifiedSeries } from "../flowSeries";
import { phaseTransitions } from "../phaseTransitions";

const fixtures = path.resolve("docs/design/prototype/fixtures");
beforeEach(() => {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.join(fixtures, "factory-root"));
  vi.stubEnv("MC_GIT_FIXTURE", path.join(fixtures, "git-state.json"));
  vi.stubEnv("MC_CLOCK", "2026-10-20T23:20:00Z");
});
afterEach(() => vi.unstubAllEnvs());

it("REQ-01-008 / REQ-01-011: frozen clock and fixture history feed the kept readers", () => {
  const project = path.join(fixtures, "projects/mission-control");
  expect(now().toISOString()).toBe("2026-10-20T23:20:00.000Z");
  expect(currentSeal(project)).toBe("f".repeat(40));
  const series = woVerifiedSeries(project);
  expect(series.ok).toBe(true);
  if (!series.ok) throw new Error("Missing fixture series");
  expect(series.value.peakWeek).toBe(76);
  expect(series.value.woVerified.find((bucket) => bucket.isoWeek === "2026-25")?.count).toBe(76);
  const transitions = phaseTransitions();
  expect(transitions.ok).toBe(true);
  if (!transitions.ok) throw new Error("Missing fixture transitions");
  expect(transitions.value).toContainEqual({
    project: "Pandacorp (Mission Control)",
    date: "2026-06-19",
    from: "release",
    to: "implementation",
    isReopen: true,
  });
  expect(runGit(["log", "-n", "4000", "--format=%cI%x09%s", "--", "."], project)).toContain(
    "WO-01-001",
  );
});

it("REQ-01-011: missing fixture answers preserve the unavailable result", () => {
  vi.stubEnv("MC_GIT_FIXTURE", path.join(fixtures, "missing.json"));
  expect(currentSeal(path.join(fixtures, "projects/mission-control"))).toBeNull();
  expect(woVerifiedSeries(path.join(fixtures, "projects/mission-control"))).toEqual({
    ok: false,
    reason: "git-unavailable",
  });
});
