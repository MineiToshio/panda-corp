import { cache } from "react";
import { now } from "@/lib/clock/clock";
import { resolveFactoryRoot, resolveProjectPath } from "@/lib/config/config";
import { pathExists } from "@/lib/fs-utils/fs-utils";
import { runGit } from "@/lib/git/git";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { type RepoState, repoState } from "./repoState";

export interface WorktreeBranch {
  readonly name: string;
  readonly subject: string;
  readonly origin: "lane" | "claude" | "codex" | "manual";
  readonly ageHours: number;
  readonly ahead: number;
  readonly uncommitted: number;
  readonly worktree: string | null;
}
interface Repository {
  readonly name: string;
  readonly path: string;
}
export type WorktreesRepo = Repository &
  (
    | {
        readonly kind: "ok";
        readonly branches: readonly WorktreeBranch[];
        readonly leftovers: number;
        readonly locked: number;
        readonly state: RepoState;
      }
    | { readonly kind: "error"; readonly reason: string }
  );
export type WorktreesByRepo = readonly WorktreesRepo[];
interface Worktree {
  path: string;
  branch: string | null;
  locked: boolean;
}

/** Parse actual git porcelain; an unknown shape cannot become a clean repository (DR-078). */
export function parseWorktrees(source: string): Worktree[] {
  if (!source.trim()) throw new Error("Empty git worktree list");
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n");
      const root = lines.shift();
      if (!root?.startsWith("worktree ")) throw new Error("Malformed git worktree list");
      let branch: string | null = null;
      let locked = false;
      for (const line of lines) {
        if (line.startsWith("branch refs/heads/")) branch = line.slice(18);
        else if (line === "locked" || line.startsWith("locked ")) locked = true;
        else if (
          !/^HEAD [a-f0-9]{40,64}$/.test(line) &&
          line !== "detached" &&
          line !== "bare" &&
          !/^prunable(?: |$)/.test(line)
        )
          throw new Error("Malformed git worktree record");
      }
      return { path: root.slice(9), branch, locked };
    });
}
function natural(source: string): number {
  if (!/^\d+$/.test(source) || !Number.isSafeInteger(Number(source)))
    throw new Error("Invalid git count");
  return Number(source);
}
function branchOrigin(name: string): WorktreeBranch["origin"] {
  if (name.startsWith("lane/")) return "lane";
  if (name.startsWith("claude/")) return "claude";
  return name.startsWith("codex/") ? "codex" : "manual";
}
function readBranch(
  name: string,
  repo: string,
  worktrees: readonly Worktree[],
  instant: number,
): WorktreeBranch {
  const worktree = worktrees.find((w) => w.branch === name)?.path ?? null;
  // A failed optional branch metric keeps the known unmerged branch visible.
  let ahead = 0;
  let ageHours = 0;
  let subject = name;
  let uncommitted = 0;
  try {
    ahead = natural(runGit(["rev-list", "--count", `main..${name}`], repo));
  } catch {
    /* known pending branch retained */
  }
  try {
    const seconds = natural(runGit(["log", "-1", "--format=%ct", name], repo));
    ageHours = Math.max(0, (instant - seconds * 1000) / 3_600_000);
  } catch {
    /* unknown age retains default */
  }
  try {
    subject = runGit(["log", "-1", "--format=%s", name], repo) || name;
  } catch {
    /* branch name is the honest fallback */
  }
  if (worktree) {
    try {
      uncommitted = runGit(["status", "--porcelain"], worktree).split("\n").filter(Boolean).length;
    } catch {
      /* optional dirty count */
    }
  }
  return { name, subject, origin: branchOrigin(name), ageHours, ahead, uncommitted, worktree };
}
/** Single resolver for both the card and pill (LESSON-0077). Repositories may be injected for isolated tests. */
export function readWorktreesByRepo(
  repositories: readonly Repository[],
  instant = now().getTime(),
): WorktreesByRepo {
  const seen = new Set<string>();
  const rows: WorktreesRepo[] = [];
  for (const repository of repositories) {
    try {
      const worktrees = parseWorktrees(
        runGit(["worktree", "list", "--porcelain"], repository.path),
      );
      const first = worktrees[0];
      if (!first) throw new Error("Empty git worktree list");
      const identity = first.path;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const raw = runGit(
        ["branch", "--no-merged", "main", "--format=%(refname:short)"],
        repository.path,
      );
      const names = raw.split("\n").filter(Boolean);
      if (names.some((name) => /\s|^[-+*]|\.\.|[~^:?*[\\]/.test(name)))
        throw new Error("Malformed git branch list");
      const branches = [...new Set(names)].map((name) =>
        readBranch(name, repository.path, worktrees, instant),
      );
      const extras = worktrees.slice(1);
      const leftovers = extras.filter(
        (w) => !w.locked && !branches.some((b) => b.name === w.branch),
      ).length;
      rows.push({
        ...repository,
        kind: "ok",
        branches,
        leftovers,
        locked: extras.filter((w) => w.locked).length,
        state: repoState({ branches, leftovers }),
      });
    } catch (error) {
      rows.push({
        ...repository,
        kind: "error",
        reason: error instanceof Error ? error.message : "Git read failed",
      });
    }
  }
  const rank = { cleanNow: 3, reviewSoon: 2, upToDate: 1, clean: 0 };
  return rows.sort((a, b) => {
    const ar = a.kind === "error" ? 4 : rank[a.state];
    const br = b.kind === "error" ? 4 : rank[b.state];
    return (
      br - ar ||
      (b.kind === "ok" ? b.branches.length + b.leftovers : 0) -
        (a.kind === "ok" ? a.branches.length + a.leftovers : 0)
    );
  });
}
export const getWorktreesByRepo = cache((): WorktreesByRepo => {
  const repositories = [
    { name: "Fábrica", path: resolveFactoryRoot() },
    ...readPortfolio()
      .map((entry) => ({ name: entry.name, path: resolveProjectPath(entry.path) }))
      .filter((entry) => pathExists(entry.path)),
  ];
  return readWorktreesByRepo(repositories);
});
