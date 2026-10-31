import childProcess from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runGit } from "../git";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("REQ-01-011: refuses writes before spawning, including write-like options", () => {
  const spy = vi.spyOn(childProcess, "execFileSync");
  for (const args of [
    ["commit"],
    ["push"],
    ["checkout", "main"],
    ["worktree", "add", "x"],
    ["branch", "-D", "x"],
    ["diff", "--output=x"],
    ["log", "--output", "x"],
    ["log", "--ext-diff"],
    ["log", "--textconv"],
    ["log", "--exec=touch x"],
    ["log", "-c", "alias.x=!touch x"],
    ["log", "-C", "/tmp"],
    ["log", "--git-dir=/tmp"],
    ["log", "--work-tree=/tmp"],
    ["log", "--config-env=alias.x=COMMAND"],
    ["diff", "--no-index"],
  ]) {
    expect(() => runGit(args)).toThrow(expect.objectContaining({ kind: "disallowed" }));
  }
  expect(spy).not.toHaveBeenCalled();
});
it("REQ-01-011: runs bounded reads with optional locks disabled; classifies timeouts", () => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined);
  const dir = mkdtempSync(path.join(os.tmpdir(), "mc-git-"));
  try {
    childProcess.execFileSync("git", ["init", dir], { stdio: "ignore" });
    const spy = vi.spyOn(childProcess, "execFileSync");
    expect(runGit(["status", "--porcelain"], dir)).toBe("");
    expect(spy).toHaveBeenLastCalledWith(
      "git",
      ["status", "--porcelain"],
      expect.objectContaining({
        timeout: 10000,
        maxBuffer: 256 * 1024 * 1024,
        env: expect.objectContaining({ GIT_OPTIONAL_LOCKS: "0" }),
      }),
    );
    spy.mockImplementation(() => {
      throw Object.assign(new Error("private output"), { code: "ETIMEDOUT" });
    });
    expect(() => runGit(["log"], dir)).toThrow(
      expect.objectContaining({ kind: "timeout", message: "Git read timed out" }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("REQ-01-011: the real CLI loader imports the git boundary without transpilation", () => {
  expect(() =>
    childProcess.execFileSync(
      process.execPath,
      [
        "--loader",
        "./scripts/read-model/ts-loader.mjs",
        "--input-type=module",
        "-e",
        'await import("./src/lib/git/git.ts")',
      ],
      { cwd: process.cwd(), stdio: "pipe", timeout: 5000 },
    ),
  ).not.toThrow();
});

it("REQ-01-011: permits bounded history and patch reads used by report consumers", () => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined);
  const spy = vi.spyOn(childProcess, "execFileSync").mockReturnValue("history");
  for (const args of [
    ["log", "--reverse", "--format=%x00%cI", "-p", "--", "docs/frds"],
    ["log", "-n", "400", "--format=%cI", "-p"],
    ["log", "-n", "4000", "--format=%s"],
  ]) {
    expect(runGit(args)).toBe("history");
    expect(spy).toHaveBeenLastCalledWith(
      "git",
      args,
      expect.objectContaining({
        maxBuffer: 256 * 1024 * 1024,
      }),
    );
  }
});
