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
        maxBuffer: 1048576,
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
