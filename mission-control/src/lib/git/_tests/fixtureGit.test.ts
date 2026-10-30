import childProcess from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runGit } from "../git";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("REQ-01-011: answers real Spanish prototype facts without spawning", () => {
  vi.stubEnv("MC_GIT_FIXTURE", path.resolve("src/lib/git/_tests/git-state.json"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", "/fixture/factory-root");
  const spawn = vi.spyOn(childProcess, "execFileSync");
  const read = (args: string[]) => runGit(args, "/fixture/factory-root");
  expect(read(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])).toBe(
    "origin/main",
  );
  expect(read(["worktree", "list", "--porcelain"])).toContain("detached\nlocked");
  expect(read(["branch", "--no-merged", "main", "--format=%(refname:short)"])).toContain(
    "wt/prototype-fixture",
  );
  expect(read(["rev-list", "--count", "HEAD"])).toBe("1762");
  expect(read(["rev-list", "--count", "main..wt/prototype-fixture"])).toBe("2");
  expect(read(["log", "-1", "--format=%ct", "wt/prototype-fixture"])).toMatch(/^\d+$/);
  expect(read(["log", "-1", "--format=%s", "wt/prototype-fixture"])).toContain("fixture data");
  expect(read(["diff", "--shortstat", "main...wt/prototype-fixture"])).toContain(
    "12 files changed",
  );
  expect(read(["status", "--porcelain", "--", "plugin"])).toBe("");
  expect(
    runGit(
      ["status", "--porcelain"],
      "/workspace/panda-corp/.claude/worktrees/prototype-fixture",
    ).split("\n"),
  ).toHaveLength(3);
  expect(runGit(["log", "-1", "--format=%cI"], "/fixture/mission-control")).toBe(
    "2026-10-20T16:10:24-05:00",
  );
  expect(() => read(["show", "unknown"])).toThrow(
    expect.objectContaining({ kind: "no-fixture-answer" }),
  );
  expect(spawn).not.toHaveBeenCalled();
});
it("REQ-01-011: missing and malformed fixture sources fail loudly without leaking contents", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mc-fixture-"));
  const file = path.join(dir, "state.json");
  vi.stubEnv("MC_GIT_FIXTURE", file);
  try {
    for (const contents of [
      undefined,
      "private malformed",
      '{"repos":{"x":{}},"lastActivity":{}}',
    ]) {
      if (contents !== undefined) writeFileSync(file, contents);
      expect(() => runGit(["log"])).toThrow(expect.objectContaining({ kind: "failed" }));
      expect(() => runGit(["log"])).not.toThrow(/private malformed/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("REQ-01-008, REQ-01-011: snapshot and unreadable scenarios use temporary overlays", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mc-scenario-"));
  const file = path.join(dir, "git.json");
  const base = JSON.parse(readFileSync(path.resolve("src/lib/git/_tests/git-state.json"), "utf8"));
  vi.stubEnv("MC_GIT_FIXTURE", file);
  try {
    writeFileSync(file, JSON.stringify(base));
    expect(runGit(["rev-list", "--count", "a41c09e2..HEAD"], "/fixture/funko-tracker")).toBe("3");
    writeFileSync(file, JSON.stringify({ ...base, scenario: "snapshot-stale" }));
    expect(runGit(["rev-list", "--count", "a41c09e2..HEAD"], "/fixture/funko-tracker")).toBe("14");
    const time = (sha: string) =>
      Number(runGit(["log", "-1", "--format=%ct", sha], "/fixture/funko-tracker"));
    expect(time("HEAD") - time("a41c09e2")).toBe(26 * 3600);
    writeFileSync(file, JSON.stringify({ ...base, scenario: "worktrees-unreadable" }));
    expect(() => runGit(["worktree", "list", "--porcelain"], "/fixture/pandasaga")).toThrow(
      "git worktree list terminó con error",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
