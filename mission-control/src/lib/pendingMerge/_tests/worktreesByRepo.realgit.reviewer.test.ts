/**
 * Reviewer-authored (DR-080, FRD-21 gate): the reader against REAL git in throwaway repositories, so the
 * porcelain and ref shapes are git's own and not a fake's dialect. No test touches the owner's repositories.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeWorktrees } from "../pillSummary";
import { readWorktreesByRepo } from "../worktreesByRepo";

const INSTANT = Date.parse("2026-10-22T12:00:00Z");
const DAY_MS = 86_400_000;
const sandbox: { root: string } = { root: "" };

function git(cwd: string, args: readonly string[], whenMs = INSTANT - 3_600_000): string {
  const date = new Date(whenMs).toISOString();
  return execFileSync("git", [...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  }).trim();
}

function commit(cwd: string, file: string, subject: string, whenMs?: number): void {
  writeFileSync(path.join(cwd, file), subject);
  git(cwd, ["add", "--", file]);
  git(cwd, ["commit", "-m", subject], whenMs);
}

function makeRepo(name: string, initialBranch = "main"): { name: string; path: string } {
  const repoPath = path.join(sandbox.root, name);
  mkdirSync(repoPath, { recursive: true });
  git(repoPath, ["init", `--initial-branch=${initialBranch}`]);
  commit(repoPath, "base.txt", "base");
  return { name, path: repoPath };
}

function unmerged(repoPath: string, branch: string, subject: string, whenMs?: number): void {
  git(repoPath, ["checkout", "-b", branch]);
  commit(repoPath, `${branch.replaceAll("/", "-")}.txt`, subject, whenMs);
  git(repoPath, ["checkout", "main"]);
}

beforeEach(() => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined as unknown as string);
  sandbox.root = realpathSync(mkdtempSync(path.join(tmpdir(), "wt-reviewer-")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(sandbox.root, { recursive: true, force: true });
});

describe("readWorktreesByRepo over real git", () => {
  it("AC-21-007.1: a merged branch is not pending and a repository with nothing reads clean", () => {
    const repo = makeRepo("merged");
    unmerged(repo.path, "feature/done", "done");
    git(repo.path, ["merge", "--ff-only", "feature/done"]);
    const rows = readWorktreesByRepo([repo], INSTANT);
    expect(rows).toEqual([
      { ...repo, kind: "ok", branches: [], leftovers: 0, locked: 0, state: "clean" },
    ]);
    expect(summarizeWorktrees(rows).hidden).toBe(true);
  });

  it("AC-21-007.1: a worktree on an unmerged branch is pending, not a leftover; a merged one is a leftover; locked ones are apart", () => {
    const repo = makeRepo("mixed");
    git(repo.path, ["worktree", "add", "-b", "codex/open", path.join(sandbox.root, "open")]);
    commit(path.join(sandbox.root, "open"), "open.txt", "open work");
    writeFileSync(path.join(sandbox.root, "open", "dirty.txt"), "dirty");
    git(repo.path, ["worktree", "add", "-b", "lane/done", path.join(sandbox.root, "left")]);
    git(repo.path, ["worktree", "add", "--detach", path.join(sandbox.root, "held")]);
    git(repo.path, [
      "worktree",
      "lock",
      "--reason",
      "gate in use",
      path.join(sandbox.root, "held"),
    ]);
    const [row] = readWorktreesByRepo([repo], INSTANT);
    expect(row).toMatchObject({ kind: "ok", leftovers: 1, locked: 1, state: "reviewSoon" });
    expect(row?.kind === "ok" ? row.branches : []).toEqual([
      expect.objectContaining({
        name: "codex/open",
        origin: "codex",
        ahead: 1,
        uncommitted: 1,
        subject: "open work",
        worktree: path.join(sandbox.root, "open"),
      }),
    ]);
  });

  it("AC-21-007.1: a linked worktree and its primary checkout collapse into one row, whichever is listed", () => {
    const repo = makeRepo("shared");
    const linked = path.join(sandbox.root, "linked");
    git(repo.path, ["worktree", "add", "-b", "claude/session", linked]);
    expect(readWorktreesByRepo([repo, { name: "Alias", path: linked }], INSTANT)).toHaveLength(1);
  });

  it("AC-21-007.1: a repository path holding spaces parses as one worktree", () => {
    const repo = makeRepo("with space");
    git(repo.path, ["worktree", "add", "--detach", path.join(sandbox.root, "left over")]);
    expect(readWorktreesByRepo([repo], INSTANT)[0]).toMatchObject({ kind: "ok", leftovers: 1 });
  });

  it("REQ-21-006: a folder that is not a repository is an error row and leaves the others intact", () => {
    const healthy = makeRepo("healthy");
    const plain = path.join(sandbox.root, "plain");
    mkdirSync(plain);
    // GIT_CEILING_DIRECTORIES keeps git from walking up into an enclosing repository of the host.
    vi.stubEnv("GIT_CEILING_DIRECTORIES", sandbox.root);
    const rows = readWorktreesByRepo([{ name: "Plain", path: plain }, healthy], INSTANT);
    expect(rows.map((row) => row.kind)).toEqual(["error", "ok"]);
    expect(summarizeWorktrees(rows)).toEqual({
      count: 0,
      urgent: false,
      unreadable: 1,
      hidden: false,
    });
  });

  it("REQ-21-006: a repository without main is reported as unreadable, never as clean", () => {
    const repo = makeRepo("legacy", "master");
    expect(readWorktreesByRepo([repo], INSTANT)[0]).toMatchObject({ kind: "error" });
  });

  it("REQ-21-006: the reason of an unreadable repository names what failed, not another command", () => {
    const repo = makeRepo("no-main", "master");
    const [row] = readWorktreesByRepo([repo], INSTANT);
    expect(row).toMatchObject({ kind: "error" });
    expect(row?.kind === "error" ? row.reason : "").not.toContain("git worktree list");
  });

  it("AC-21-007.1: the worked example orders Depurar ya, Revisar pronto, Al día, Limpio", () => {
    const upToDate = makeRepo("a-recent");
    unmerged(upToDate.path, "lane/recent", "recent", INSTANT - 2 * 3_600_000);
    const review = makeRepo("b-leftover");
    git(review.path, ["worktree", "add", "--detach", path.join(sandbox.root, "b-left")]);
    const urgent = makeRepo("c-urgent");
    unmerged(urgent.path, "lane/one", "one", INSTANT - 3_600_000);
    unmerged(urgent.path, "lane/old", "old", INSTANT - 9 * DAY_MS);
    const clean = makeRepo("d-clean");
    const rows = readWorktreesByRepo([upToDate, clean, review, urgent], INSTANT);
    expect(rows.map((row) => (row.kind === "ok" ? [row.name, row.state] : row.name))).toEqual([
      ["c-urgent", "cleanNow"],
      ["b-leftover", "reviewSoon"],
      ["a-recent", "upToDate"],
      ["d-clean", "clean"],
    ]);
    expect(summarizeWorktrees(rows)).toEqual({
      count: 3,
      urgent: true,
      unreadable: 0,
      hidden: false,
    });
  });

  it("REQ-21-006, AC-21-007.1: a primary checkout detached on unmerged work is readable, not a malformed repository", () => {
    const repo = makeRepo("detached");
    unmerged(repo.path, "lane/kept", "kept");
    commit(repo.path, "main.txt", "main moves on");
    git(repo.path, ["checkout", "--detach", "lane/kept"]);
    commit(repo.path, "loose.txt", "loose work");
    const [row] = readWorktreesByRepo([repo], INSTANT);
    expect(row).toMatchObject({ kind: "ok" });
    expect(row?.kind === "ok" ? row.branches.map((branch) => branch.name) : []).toContain(
      "lane/kept",
    );
  });

  it("AC-21-007.1: a branch named like a tracked folder keeps its real age, so it cannot read as recent", () => {
    const repo = makeRepo("ambiguous");
    mkdirSync(path.join(repo.path, "docs"));
    writeFileSync(path.join(repo.path, "docs", "a.md"), "a");
    git(repo.path, ["add", "--", "docs/a.md"]);
    git(repo.path, ["commit", "-m", "docs folder"]);
    unmerged(repo.path, "docs", "stale docs work", INSTANT - 30 * DAY_MS);
    const [row] = readWorktreesByRepo([repo], INSTANT);
    expect(row).toMatchObject({ kind: "ok", state: "cleanNow" });
    expect(row?.kind === "ok" ? row.branches[0]?.subject : "").toBe("stale docs work");
  });
});
