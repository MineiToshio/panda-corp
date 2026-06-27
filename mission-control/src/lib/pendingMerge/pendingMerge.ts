/**
 * Pending-merge reader (FRD-21, WO-21-001) — surfaces un-merged parallel work so a forgotten
 * worktree is never silently stranded (factory DR-096 "Parallel manual sessions").
 *
 * The invariant: `merge-queue.sh` removes a worktree + its branch ONLY on a successful merge, so
 * anything that survives = work not yet in the default branch. We read it LIVE from git on the server
 * (like `build-track`), so there is **no snapshot file and no background job** to keep fresh — each
 * request reflects reality. Two signals, unioned by branch:
 *   1. surviving worktrees (`git worktree list`) — pending even with uncommitted work;
 *   2. un-merged branches (`git branch --no-merged`) — the branch outlives a swept worktree.
 *
 * Read-only: it shells `git` to READ repo state, never writes and never calls Claude (FRD-01 constraint).
 * Fail-loud (DR-078): an unreadable repo returns an explicit `error` result, never a silent empty list —
 * "no pending work" and "could not read" are distinct, distinctly-rendered states.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { resolveFactoryRoot } from "@/lib/config/config";

/** Hours of inactivity after which un-merged work is flagged stale (owner-tunable, shared with the check). */
const PENDING_STALE_HOURS: number = Number(process.env.PANDACORP_STALE_HOURS ?? 3);

/** Status of a pending item — a discriminated literal so the UI switch is exhaustive (typescript.md). */
type PendingStatus = "in-progress" | "ready" | "stale";

export interface PendingItem {
  readonly branch: string;
  readonly worktree: string | null;
  readonly ahead: number;
  readonly ageHours: number;
  readonly status: PendingStatus;
  readonly task: string | null;
}

/** Parse-don't-validate result (DR-078): empty (truly none) and error (unreadable) are NOT the same. */
export type PendingResult =
  | { readonly kind: "ok"; readonly items: readonly PendingItem[] }
  | { readonly kind: "empty" }
  | { readonly kind: "error"; readonly reason: string };

/** Runs a git subcommand in a repo, returning trimmed stdout. Injectable so tests fake git, not the module. */
export type GitRunner = (args: readonly string[]) => string;
function realGit(repoRoot: string): GitRunner {
  return (args) => execFileSync("git", [...args], { cwd: repoRoot, encoding: "utf8" }).trim();
}

/** Map a branch → its worktree path from `git worktree list --porcelain`. */
function worktreeByBranch(porcelain: string): Map<string, string> {
  const map = new Map<string, string>();
  let wt = "";
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) wt = line.slice("worktree ".length);
    else if (line.startsWith("branch refs/heads/"))
      map.set(line.slice("branch refs/heads/".length), wt);
  }
  return map;
}

/** Read the manifest task label written by worktree-bootstrap.sh, if present. */
function readTask(repoRoot: string, branch: string): string | null {
  const slug = branch.replace(/\//g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const file = path.join(repoRoot, ".pandacorp", "run", "worktrees", `${slug}.json`);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { task?: unknown };
    return typeof raw.task === "string" && raw.task !== "" ? raw.task : null;
  } catch {
    return null;
  }
}

function deriveStatus(ageHours: number, hasWorktree: boolean): PendingStatus {
  if (ageHours >= PENDING_STALE_HOURS) return "stale";
  return hasWorktree ? "in-progress" : "ready";
}

/**
 * Read pending (un-merged) work for one repo. Returns an explicit result — `error` when git can't be
 * read (so the UI shows an error state, never a misleading "al día"), `empty` when there is genuinely
 * none, `ok` with the items otherwise.
 */
export function readPending(
  repoRoot: string,
  now: number = Date.now(),
  run: GitRunner = realGit(repoRoot),
): PendingResult {
  let defaultBranch: string;
  let unmerged: string;
  let porcelain: string;
  try {
    defaultBranch =
      run(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).replace(
        /^origin\//,
        "",
      ) || "main";
  } catch {
    defaultBranch = "main";
  }
  try {
    porcelain = run(["worktree", "list", "--porcelain"]);
    unmerged = run(["branch", "--no-merged", defaultBranch, "--format=%(refname:short)"]);
  } catch (err) {
    return {
      kind: "error",
      reason: `git read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const wtByBranch = worktreeByBranch(porcelain);
  const branches = unmerged
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b !== "" && b !== defaultBranch);

  const items: PendingItem[] = [];
  for (const branch of branches) {
    let ahead = 0;
    let lastTs = now;
    try {
      ahead = Number(run(["rev-list", "--count", `${defaultBranch}..${branch}`]) || "0");
      lastTs = Number(run(["log", "-1", "--format=%ct", branch]) || "0") * 1000 || now;
    } catch {
      // a branch we can count nothing for is still pending; keep defaults.
    }
    const worktree = wtByBranch.get(branch) ?? null;
    const ageHours = Math.max(0, Math.floor((now - lastTs) / 3_600_000));
    items.push({
      branch,
      worktree,
      ahead,
      ageHours,
      status: deriveStatus(ageHours, worktree !== null),
      task: readTask(repoRoot, branch),
    });
  }

  if (items.length === 0) return { kind: "empty" };
  const order: Record<PendingStatus, number> = { stale: 0, ready: 1, "in-progress": 2 };
  items.sort((a, b) => order[a.status] - order[b.status] || b.ahead - a.ahead);
  return { kind: "ok", items };
}

/**
 * Cross-surface single source (DR-092): the pending-merge state for the factory repo (where Mission
 * Control's own worktrees live). Request-scoped via `React.cache` so the shell indicator and any
 * per-project view read the SAME derivation. Returns the full result so callers can distinguish
 * empty from error.
 */
export const getPendingMerge = cache((): PendingResult => readPending(resolveFactoryRoot()));
