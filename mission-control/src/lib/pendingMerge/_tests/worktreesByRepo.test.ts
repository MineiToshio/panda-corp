import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { type FixtureRepo, fixtureAnswer } from "@/lib/git/fixtureAnswers";
import { runGit } from "@/lib/git/git";
import { GitError } from "@/lib/git/gitError";
import { summarizeWorktrees } from "../pillSummary";
import { repoState } from "../repoState";
import { parseWorktrees, readWorktreesByRepo } from "../worktreesByRepo";

vi.mock("@/lib/git/git", () => ({ runGit: vi.fn() }));
const instant = Date.parse("2026-10-22T12:00:00Z");
const repo = { name: "Proyecto", path: "/fixture/project" };
const porcelain =
  "worktree /fixture/project\nHEAD " +
  "0".repeat(40) +
  "\nbranch refs/heads/main\n\nworktree /fixture/old\nHEAD " +
  "1".repeat(40) +
  "\ndetached\n\nworktree /fixture/locked\nHEAD " +
  "2".repeat(40) +
  "\ndetached\nlocked";
describe("Worktrees resolver", () => {
  it("AC-21-007.1: strict legend thresholds at both boundaries", () => {
    const state = (ageHours: number, leftovers = 0, count = 1) =>
      repoState({ branches: Array.from({ length: count }, () => ({ ageHours })), leftovers });
    expect(state(24)).toBe("upToDate");
    expect(state(24.01)).toBe("reviewSoon");
    expect(state(168)).toBe("reviewSoon");
    expect(state(168.01)).toBe("cleanNow");
    expect(state(0, 2)).toBe("reviewSoon");
    expect(state(0, 3)).toBe("cleanNow");
    expect(state(0, 0, 2)).toBe("upToDate");
    expect(state(0, 0, 3)).toBe("cleanNow");
    expect(state(0, 0, 0)).toBe("clean");
  });
  it("AC-21-007.1: excludes locked leftovers and deduplicates shared repositories", () => {
    vi.mocked(runGit).mockImplementation((args) => (args[0] === "worktree" ? porcelain : ""));
    const rows = readWorktreesByRepo([repo, { name: "Alias", path: "/fixture/alias" }], instant);
    expect(rows).toEqual([
      { ...repo, kind: "ok", branches: [], leftovers: 1, locked: 1, state: "reviewSoon" },
    ]);
    expect(summarizeWorktrees(rows)).toEqual({
      count: 0,
      unreadable: 0,
      urgent: false,
      hidden: true,
    });
  });
  it("REQ-21-006: malformed porcelain and repository failures stay distinct from clean", () => {
    expect(() => parseWorktrees("not porcelain")).toThrow();
    vi.mocked(runGit).mockImplementation((_args, cwd) => {
      if (cwd === repo.path) return "broken";
      return _args[0] === "worktree" ? porcelain : "";
    });
    const rows = readWorktreesByRepo(
      [repo, { name: "Healthy", path: "/fixture/healthy" }],
      instant,
    );
    expect(rows.find((row) => row.name === "Proyecto")).toMatchObject({ kind: "error" });
    expect(rows.find((row) => row.name === "Healthy")).toMatchObject({ kind: "ok", leftovers: 1 });
    expect(summarizeWorktrees(rows)).toMatchObject({ hidden: false, unreadable: 1 });
  });
  it("REQ-21-006: an unreadable branch age cannot understate cleanup priority", () => {
    vi.mocked(runGit).mockImplementation((args) => {
      if (args[0] === "worktree") return porcelain;
      if (args[0] === "branch") return "refs/heads/docs";
      if (args[0] === "log") throw new Error("Age unavailable");
      return "1";
    });
    const rows = readWorktreesByRepo([repo], instant);
    expect(rows[0]).toMatchObject({ kind: "error" });
    expect(summarizeWorktrees(rows)).toMatchObject({ unreadable: 1, hidden: false });
  });
  it("REQ-21-006: localized detached HEAD descriptions do not become branch refs", () => {
    vi.mocked(runGit).mockImplementation((args) => {
      if (args[0] === "worktree") return porcelain;
      if (args[0] === "branch")
        return "(HEAD desacoplado de refs/heads/lane/kept)\nrefs/heads/lane/kept";
      if (args.includes("--format=%ct")) return String(instant / 1000 - 3600);
      if (args.includes("--format=%s")) return "kept work";
      return "1";
    });
    expect(readWorktreesByRepo([repo], instant)[0]).toMatchObject({
      kind: "ok",
      branches: [expect.objectContaining({ name: "lane/kept", subject: "kept work" })],
    });
  });
  it.each([
    ["worktree", "failed", "git worktree list terminó con error"],
    ["branch", "failed", "No se pudieron leer las ramas sin integrar respecto a main"],
    ["log", "failed", "No se pudo leer la fecha del último commit de una rama"],
    ["worktree", "timeout", "La lectura de git agotó el tiempo de espera"],
    ["branch", "timeout", "La lectura de git agotó el tiempo de espera"],
    ["log", "timeout", "La lectura de git agotó el tiempo de espera"],
  ] as const)("REQ-21-006: %s %s names the actual read failure", (command, kind, reason) => {
    vi.mocked(runGit).mockImplementation((args) => {
      if (args[0] === command) throw new GitError(kind, "Private process details");
      if (args[0] === "worktree") return porcelain;
      if (args[0] === "branch") return "refs/heads/lane/kept";
      return "1";
    });
    expect(readWorktreesByRepo([repo], instant)[0]).toMatchObject({ kind: "error", reason });
  });
  it("AC-21-007.2: production-shaped Spanish oracle yields subjects, origins, ages and one shared pill count", () => {
    const fixture = JSON.parse(
      readFileSync("docs/design/prototype/fixtures/git-state.json", "utf8"),
    ) as { repos: Record<string, FixtureRepo> };
    const data = fixture.repos.factory;
    if (!data) throw new Error("Missing factory fixture");
    vi.mocked(runGit).mockImplementation((args, cwd) => {
      const result = fixtureAnswer(data, args, cwd ?? repo.path);
      if (result === undefined) throw new Error("Unknown fixture read");
      return result;
    });
    const rows = readWorktreesByRepo([repo], instant);
    expect(rows[0]).toMatchObject({
      kind: "ok",
      branches: data.branches.map((b) =>
        expect.objectContaining({ name: b.name, subject: b.subject, ahead: b.ahead }),
      ),
    });
    expect(summarizeWorktrees(rows)).toMatchObject({
      count: data.branches.length,
      urgent: true,
      hidden: false,
    });
  });
});
it("AC-21-008.1, AC-21-008.2: shared pill hides only when readable and empty, and reports urgency separately from unreadable", () => {
  const clean = {
    ...repo,
    kind: "ok" as const,
    branches: [],
    leftovers: 0,
    locked: 0,
    state: "clean" as const,
  };
  expect(summarizeWorktrees([clean])).toEqual({
    count: 0,
    urgent: false,
    unreadable: 0,
    hidden: true,
  });
  const pending = {
    ...clean,
    state: "cleanNow" as const,
    branches: [
      {
        name: "lane/test",
        subject: "Fixture",
        origin: "lane" as const,
        ageHours: 200,
        ahead: 2,
        uncommitted: 0,
        worktree: null,
      },
    ],
  };
  expect(
    summarizeWorktrees([pending, { ...repo, path: "/bad", kind: "error", reason: "git failed" }]),
  ).toEqual({ count: 1, urgent: true, unreadable: 1, hidden: false });
});
