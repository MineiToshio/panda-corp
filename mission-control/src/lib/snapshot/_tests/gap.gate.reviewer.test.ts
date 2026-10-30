/**
 * FRD-14 gate (reviewer-authored, DR-015): readSnapshotGap against a REAL git repository, not the
 * fixture runner or a mocked runGit. The builder's suite never crosses the execFileSync boundary, so
 * stdout framing, the read-only allowlist and real committer times stay unproven without this file.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as git from "@/lib/git/git";
import { readSnapshotGap } from "../gap";

const T0 = 1_700_000_000;
let repo: string;

function gitIn(args: readonly string[], at = T0): string {
  const stamp = `${at} +0000`;
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "gate",
      GIT_AUTHOR_EMAIL: "gate@example.com",
      GIT_COMMITTER_NAME: "gate",
      GIT_COMMITTER_EMAIL: "gate@example.com",
      GIT_AUTHOR_DATE: stamp,
      GIT_COMMITTER_DATE: stamp,
    },
  }).trim();
}

function commit(subject: string, at: number): string {
  writeFileSync(path.join(repo, "f.txt"), `${subject}-${at}`);
  gitIn(["add", "f.txt"], at);
  gitIn(["commit", "-m", subject], at);
  return gitIn(["rev-parse", "HEAD"], at);
}

beforeEach(() => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined);
  repo = mkdtempSync(path.join(os.tmpdir(), "snapshot-gap-gate-"));
  gitIn(["init", "--quiet"]);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("FRD-14 gate: readSnapshotGap on a real repository", () => {
  it("AC-14-002.1: HEAD on the green commit reads 0 commits, 0 hours, never stale", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    expect(readSnapshotGap(repo, green)).toEqual({
      status: "ok",
      commitsBehind: 0,
      hoursBehind: 0,
      stale: false,
      verified: { wo: "WO-07-002", frd: "FRD-07" },
    });
  });

  it("AC-14-002.1: one second below the 24 h threshold floors to 23 h and stays fresh", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    commit("feat: next", T0 + 24 * 3600 - 1);
    expect(readSnapshotGap(repo, green)).toMatchObject({
      commitsBehind: 1,
      hoursBehind: 23,
      stale: false,
    });
  });

  it("AC-14-002.1: exactly 24 h is stale while the commit distance is below its own threshold", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    commit("feat: next", T0 + 24 * 3600);
    expect(readSnapshotGap(repo, green)).toMatchObject({ hoursBehind: 24, stale: true });
  });

  it("AC-14-002.1: 9 commits stays fresh and the 10th turns stale inside one hour", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    for (let i = 1; i <= 9; i += 1) commit(`feat: c${i}`, T0 + i);
    expect(readSnapshotGap(repo, green)).toMatchObject({ commitsBehind: 9, stale: false });
    commit("feat: c10", T0 + 10);
    expect(readSnapshotGap(repo, green)).toMatchObject({ commitsBehind: 10, stale: true });
  });

  it("a rebased HEAD older than the green commit clamps to 0 hours instead of going negative", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    commit("feat: older clock", T0 - 7200);
    expect(readSnapshotGap(repo, green)).toMatchObject({ commitsBehind: 1, hoursBehind: 0 });
  });

  it("a subject with no work order omits verified; two ids resolve to the first", () => {
    const plain = commit("chore: no id here", T0);
    const none = readSnapshotGap(repo, plain);
    expect(none).toMatchObject({ status: "ok" });
    expect(none).not.toHaveProperty("verified");
    const two = commit("fix: WO-11-003 after WO-02-001", T0 + 1);
    expect(readSnapshotGap(repo, two)).toMatchObject({
      verified: { wo: "WO-11-003", frd: "FRD-11" },
    });
    const malformed = commit("fix: WO-7-2 and XWO-07-002 and WO-07-0021", T0 + 2);
    expect(readSnapshotGap(repo, malformed)).not.toHaveProperty("verified");
  });

  it("AC-14-002.1: an unknown sha and a folder that is not a repository are unavailable", () => {
    commit("feat: WO-07-002 verified", T0);
    expect(readSnapshotGap(repo, "deadbeefdeadbeef")).toMatchObject({ status: "unavailable" });
    const notRepo = mkdtempSync(path.join(os.tmpdir(), "snapshot-gap-norepo-"));
    try {
      expect(readSnapshotGap(notRepo, "deadbeef")).toMatchObject({ status: "unavailable" });
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  it("never hands a non-sha ref or an option to git", () => {
    const spy = vi.spyOn(git, "runGit");
    for (const sha of ["--all", "HEAD", "main", "abc", "a41c09e2..HEAD", `${"a".repeat(41)}`, ""]) {
      expect(readSnapshotGap(repo, sha)).toMatchObject({ status: "unavailable" });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("is read-only: HEAD, refs and the index are untouched by a probe", () => {
    const green = commit("feat: WO-07-002 verified", T0);
    const before = gitIn(["status", "--porcelain=v2", "--branch"]);
    readSnapshotGap(repo, green);
    expect(gitIn(["status", "--porcelain=v2", "--branch"])).toBe(before);
    expect(gitIn(["worktree", "list", "--porcelain"]).split("\n\n")).toHaveLength(1);
  });
});
