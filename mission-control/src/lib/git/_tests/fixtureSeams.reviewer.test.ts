import childProcess from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPending } from "@/lib/pendingMerge/pendingMerge";
import { readWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { readSnapshotGap } from "@/lib/snapshot/gap";
import { runGit } from "../git";

/** Reviewer-authored (DR-080): the REAL frozen fixture and the REAL consumers, never a test double. */
const FIXTURES = path.resolve("docs/design/prototype/fixtures");
const GENERATOR = path.resolve("docs/design/prototype/scripts/make-fixtures.mjs");
const STATE = path.join(FIXTURES, "git-state.json");
const FACTORY_ROOT = path.join(FIXTURES, "factory-root");
const CLOCK = Date.parse("2026-10-21T00:20:00.000Z");
const project = (id: string) => path.join(FIXTURES, "projects", id);
const IDS = ["pandasaga", "funko-tracker", "pandacast", "personal-page-v2", "mission-control"];
const REPOSITORIES = IDS.map((id) => ({ id, name: id, path: project(id) }));

type PrototypeRepo = { root: string; branches: { name: string }[] };
type PrototypeGit = (repo: PrototypeRepo) => (args: readonly string[]) => string;

function withScenario(scenario: string): { file: string; dir: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mc-gate-scenario-"));
  const file = path.join(dir, "git-state.json");
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(STATE, "utf8")), scenario }));
  return { file, dir };
}

function repoWith(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mc-gate-repo-"));
  const git = (...args: string[]) =>
    childProcess.execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-b", "main");
  git("config", "user.email", "gate@example.invalid");
  git("config", "user.name", "gate");
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  git("add", "-A");
  git("commit", "-m", "seed");
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("WO-01-010 fixture mode against the real git-state.json and real readers", () => {
  beforeEach(() => {
    vi.stubEnv("MC_GIT_FIXTURE", STATE);
    vi.stubEnv("PANDACORP_FACTORY_ROOT", FACTORY_ROOT);
  });

  it("project-snapshot answers a41c09e2 as WO-07-002 of FRD-07 (3 commits, 5 h, not stale)", () => {
    expect(readSnapshotGap(project("funko-tracker"), "a41c09e2")).toEqual({
      status: "ok",
      commitsBehind: 3,
      hoursBehind: 5,
      stale: false,
      verified: { wo: "WO-07-002", frd: "FRD-07" },
    });
  });

  it("project-snapshot-stale keeps the commit row and answers 14 commits / 26 hours", () => {
    const { file, dir } = withScenario("snapshot-stale");
    vi.stubEnv("MC_GIT_FIXTURE", file);
    try {
      expect(readSnapshotGap(project("funko-tracker"), "a41c09e2")).toEqual({
        status: "ok",
        commitsBehind: 14,
        hoursBehind: 26,
        stale: true,
        verified: { wo: "WO-07-002", frd: "FRD-07" },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an unknown green SHA stays an honest unavailable gap, never a fabricated zero", () => {
    expect(readSnapshotGap(project("funko-tracker"), "deadbeef")).toMatchObject({
      status: "unavailable",
    });
  });

  it("worktrees-card: every portfolio repository reads without spawning a process", () => {
    const spawn = vi.spyOn(childProcess, "execFileSync");
    const rows = readWorktreesByRepo(
      [{ id: "factory", name: "factory", path: FACTORY_ROOT }, ...REPOSITORIES],
      CLOCK,
    );
    expect(rows.every((row) => row.kind === "ok")).toBe(true);
    // mission-control lives inside the factory repository, so it folds into the factory row.
    expect(rows.map((row) => row.id).sort()).toEqual([
      "factory",
      "funko-tracker",
      "pandacast",
      "pandasaga",
      "personal-page-v2",
    ]);
    const funko = rows.find((row) => row.id === "funko-tracker");
    expect(funko?.kind === "ok" && funko.branches.length).toBe(12);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("worktrees-unreadable fails pandasaga only, with the oracle's own sentence", () => {
    const { file, dir } = withScenario("worktrees-unreadable");
    vi.stubEnv("MC_GIT_FIXTURE", file);
    try {
      const rows = readWorktreesByRepo(REPOSITORIES, CLOCK);
      expect(rows.find((row) => row.id === "pandasaga")).toMatchObject({
        kind: "error",
        reason: "git worktree list terminó con error",
      });
      expect(rows.filter((row) => row.kind === "error")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the pending-merge reader takes its repository from the factory-root cwd", () => {
    const result = readPending(FACTORY_ROOT, CLOCK);
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && result.items.map((item) => item.branch)).toContain(
      "wt/stats-seal-refresh",
    );
  });

  it("every portfolio project answers its last-commit read, including mission-control", () => {
    const { lastActivity } = JSON.parse(readFileSync(STATE, "utf8"));
    for (const id of IDS)
      expect(runGit(["log", "-1", "--format=%cI"], project(id))).toBe(lastActivity[id]);
  });

  it("mission-control shares the factory repository's facts", () => {
    expect(runGit(["rev-list", "--count", "HEAD"], project("mission-control"))).toBe("1762");
  });

  it("matches the prototype's own fixtureGit() on every base family of every repository", async () => {
    const { fixtureGit } = (await import(/* @vite-ignore */ GENERATOR)) as {
      fixtureGit: PrototypeGit;
    };
    const { repos } = JSON.parse(readFileSync(STATE, "utf8")) as {
      repos: Record<string, PrototypeRepo>;
    };
    const normalize = (text: string) => text.trim().replace(/\n+/g, "\n");
    for (const [id, repo] of Object.entries(repos)) {
      const cwd = id === "factory" ? FACTORY_ROOT : project(id);
      const oracle = fixtureGit(repo);
      const families = [
        ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
        ["worktree", "list", "--porcelain"],
        ["branch", "--no-merged", "main", "--format=%(refname:short)"],
        ...repo.branches.flatMap((branch) => [
          ["rev-list", "--count", `main..${branch.name}`],
          ["log", "-1", "--format=%ct", branch.name],
          ["log", "-1", "--format=%s", branch.name],
          ["diff", "--shortstat", `main...${branch.name}`],
        ]),
      ];
      for (const args of families)
        expect(normalize(runGit(args, cwd))).toBe(normalize(oracle(args)));
    }
  });

  it("a write is refused before the fixture is consulted", () => {
    vi.stubEnv("MC_GIT_FIXTURE", "/does/not/exist.json");
    expect(() => runGit(["commit", "-m", "x"])).toThrow(
      expect.objectContaining({ kind: "disallowed" }),
    );
  });

  it("an empty MC_GIT_FIXTURE is set-but-unreadable, never a silent real git", () => {
    vi.stubEnv("MC_GIT_FIXTURE", "");
    const spawn = vi.spyOn(childProcess, "execFileSync");
    expect(() => runGit(["rev-list", "--count", "HEAD"])).toThrow(
      expect.objectContaining({ kind: "failed" }),
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("a repository without an entry answers no-fixture-answer", () => {
    expect(() => runGit(["rev-list", "--count", "HEAD"], "/nowhere/unknown-repo")).toThrow(
      expect.objectContaining({ kind: "no-fixture-answer" }),
    );
  });
});

describe("WO-01-010 real mode", () => {
  beforeEach(() => vi.stubEnv("MC_GIT_FIXTURE", undefined));

  it.each([
    [[]],
    [["stash"]],
    [["fetch"]],
    [["gc"]],
    [["merge", "main"]],
    [["update-ref", "refs/heads/x", "HEAD"]],
    [["-c", "core.pager=x", "log"]],
    [["-C", "/tmp", "log"]],
    [["--git-dir=/tmp/x", "log"]],
    [["worktree", "remove", "x"]],
    [["worktree", "prune"]],
    [["worktree", "list", "--porcelain", "extra"]],
    [["branch"]],
    [["branch", "created"]],
    [["branch", "--list", "-D", "x"]],
    [["branch", "--merged", "main", "-d", "x"]],
    [["branch", "--list", "--edit-description"]],
    [["symbolic-ref", "HEAD", "refs/heads/x"]],
    [["status", "--porcelain", "--ignored"]],
    [["log", "--outp=x"]],
    [["show", "--output=x"]],
    [["diff", "--no-index", "a", "b"]],
    [["diff", "--ext-diff"]],
    [["show", "--textconv"]],
    [["log", "-p", "--output=x"]],
    [["log", "-p", "--output", "x"]],
    [["log", "-n", "1", "--output=x"]],
    [["log", "-n", "--output=x"]],
    [["show", "-p", "--output=x"]],
    [["diff", "-p", "--output=x"]],
    [["diff", "-p", "--no-index", "a", "b"]],
    [["log", "-p", "--ext-diff"]],
    [["log", "-p", "--textconv"]],
    [["log", "-pn1"]],
    [["log", "-n1"]],
    [["log", "--patch"]],
    [["log", "-p", "-c", "x=y"]],
    [["branch", "-n"]],
    [["branch", "--list", "-p"]],
    [["worktree", "list", "-p"]],
    [["status", "--porcelain", "-n"]],
    [["symbolic-ref", "-n", "HEAD"]],
    [["commit", "-n"]],
    [["commit", "-p"]],
    [["push", "-n"]],
    [["checkout", "-p"]],
    [["add", "-p"]],
    [["stash", "-p"]],
    [["reset", "-p"]],
  ])("refuses %j before spawning", (args) => {
    const spawn = vi.spyOn(childProcess, "execFileSync");
    expect(() => runGit(args as string[], os.tmpdir())).toThrow(
      expect.objectContaining({ kind: "disallowed" }),
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("the allowed branch list forms never create a ref", () => {
    const dir = repoWith({ "a.txt": "a" });
    try {
      runGit(["branch", "--merged", "main", "created-a"], dir);
      runGit(["branch", "--no-merged", "main", "created-b"], dir);
      runGit(["branch", "--list", "created-c"], dir);
      const refs = childProcess.execFileSync("git", ["for-each-ref", "--format=%(refname)"], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(refs.trim()).toBe("refs/heads/main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("status leaves the index untouched", () => {
    const dir = repoWith({ "a.txt": "a" });
    try {
      const index = path.join(dir, ".git/index");
      const before = readFileSync(index);
      writeFileSync(path.join(dir, "a.txt"), "changed");
      expect(runGit(["status", "--porcelain"], dir)).toBe("M a.txt");
      expect(readFileSync(index).equals(before)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a failing git never echoes its stderr into the error", () => {
    const dir = repoWith({ "a.txt": "a" });
    try {
      expect(() => runGit(["log", "secret-ref-name"], dir)).toThrow(
        expect.objectContaining({ kind: "failed", message: "Git read failed" }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a missing cwd is a typed failure", () => {
    expect(() => runGit(["log"], "/no/such/mc-gate-dir")).toThrow(
      expect.objectContaining({ kind: "failed" }),
    );
  });

  /** The exact reads WO-01-011 must route through runGit; it may not edit the seam definition. */
  it.each([
    ["build-track", ["log", "-n", "4000", "--format=%cI%x09%s", "--", "."]],
    [
      "phaseTransitions",
      ["log", "-n", "400", "--reverse", "--format=%x00%cI", "-p", "--", "a.txt"],
    ],
    ["flowSeries", ["log", "--reverse", "--format=%x00%cI", "-p", "--", "a.txt"]],
  ])("the allowlisted subcommand `log` carries the %s history read", (_reader, args) => {
    const dir = repoWith({ "a.txt": "a" });
    try {
      expect(runGit(args, dir)).toContain("20");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the patch read carries the 20 MiB a flowSeries history reaches today, unclipped", () => {
    const body = `${"x".repeat(79)}\n`.repeat(262_144);
    const dir = repoWith({ "docs/frds/a.md": body });
    try {
      const read = runGit(["log", "--reverse", "--format=%x00%cI", "-p", "--", "docs/frds"], dir);
      expect(read.length).toBeGreaterThan(20 * 1024 * 1024);
      expect(read.endsWith(`+${"x".repeat(79)}`)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no allowed read leaves a file behind", () => {
    const dir = repoWith({ "a.txt": "a" });
    try {
      runGit(["log", "-n", "1", "-p"], dir);
      runGit(["show", "-p", "HEAD"], dir);
      const status = childProcess.execFileSync("git", ["status", "--porcelain"], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(status).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the output bound carries a history read above 1 MiB (flowSeries reads 19 MB today)", () => {
    const dir = repoWith({ "a.txt": `${"x".repeat(80)}\n`.repeat(30_000) });
    try {
      expect(runGit(["show", "HEAD"], dir).length).toBeGreaterThan(1024 * 1024);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
