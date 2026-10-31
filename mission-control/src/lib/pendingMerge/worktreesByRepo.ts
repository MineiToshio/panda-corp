import path from "node:path";
import { cache } from "react";
import { now } from "@/lib/clock/clock";
import { resolveFactoryRoot, resolveProjectPath } from "@/lib/config/config";
import { type CopyKey, t } from "@/lib/copy/copy";
import { pathExists } from "@/lib/fs-utils/fs-utils";
import { runGit, runGitAsync } from "@/lib/git/git";
import { GitError } from "@/lib/git/gitError";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { type RepoState, repoState } from "./repoState";

interface WorktreeBranch {
  readonly name: string;
  readonly subject: string;
  readonly origin: "lane" | "claude" | "codex" | "manual";
  readonly ageHours: number;
  readonly ahead: number;
  readonly uncommitted: number;
  readonly worktree: string | null;
}
interface Repository {
  /** Stable UI identity, independent of the display name; legacy callers fall back to the path. */
  readonly id?: string;
  readonly name: string;
  readonly path: string;
}
/** Repository facts or an explicit unreadable result for the card and pill. */
export type WorktreesRepo = Repository &
  (
    | {
        readonly kind: "ok";
        readonly branches: readonly WorktreeBranch[];
        readonly leftovers: number;
        readonly locked: number;
        readonly state: RepoState;
      }
    | {
        readonly kind: "error";
        readonly reason: string;
        /** An unreadable row may carry an empty collection, never branch facts. */
        readonly branches?: readonly never[];
      }
  );
/** Repository rows ordered by cleanup priority. */
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
type GitRead = Generator<{ args: readonly string[]; cwd: string }, WorktreesByRepo, string>;

function* gitRead(
  args: readonly string[],
  cwd: string,
): Generator<{ args: readonly string[]; cwd: string }, string, string> {
  return yield { args, cwd };
}

function* readBranch(
  name: string,
  repo: string,
  worktrees: readonly Worktree[],
  instant: number,
): Generator<{ args: readonly string[]; cwd: string }, WorktreeBranch, string> {
  const worktree = worktrees.find((w) => w.branch === name)?.path ?? null;
  // A failed optional branch metric keeps the known unmerged branch visible.
  let ahead = 0;
  let subject = name;
  let uncommitted = 0;
  try {
    ahead = natural(yield* gitRead(["rev-list", "--count", `main..${name}`], repo));
  } catch {
    /* known pending branch retained */
  }
  // Age is required for an honest priority; a failed read makes the repository unreadable.
  const seconds = natural(
    yield* gitRead(["log", "-1", "--format=%ct", `refs/heads/${name}`], repo),
  );
  const ageHours = Math.max(0, (instant - seconds * 1000) / 3_600_000);
  try {
    subject = (yield* gitRead(["log", "-1", "--format=%s", `refs/heads/${name}`], repo)) || name;
  } catch {
    /* branch name is the honest fallback */
  }
  if (worktree) {
    try {
      uncommitted = (yield* gitRead(["status", "--porcelain"], worktree))
        .split("\n")
        .filter(Boolean).length;
    } catch {
      /* optional dirty count */
    }
  }
  return { name, subject, origin: branchOrigin(name), ageHours, ahead, uncommitted, worktree };
}
function branchNames(raw: string): string[] {
  const names = (raw === "" ? [] : raw.split("\n"))
    .filter((ref) => {
      if (/^\(.*\)$/.test(ref)) return false;
      if (ref.startsWith("refs/heads/")) return true;
      throw new Error("Malformed git branch list");
    })
    .map((ref) => ref.slice("refs/heads/".length));
  if (names.some((name) => /\s|^[-+*]|\.\.|[~^:?*[\\]/.test(name)))
    throw new Error("Malformed git branch list");
  return names;
}
/** Single resolver for both the card and pill (LESSON-0077). Repositories may be injected for isolated tests. */
function* worktreesRead(repositories: readonly Repository[], instant: number): GitRead {
  const seen = new Set<string>();
  const rows: WorktreesRepo[] = [];
  for (const repository of repositories) {
    let errorKey: CopyKey = "inicio.worktrees.readError";
    try {
      const source = yield* gitRead(["worktree", "list", "--porcelain"], repository.path);
      errorKey = "inicio.worktrees.worktreeFormatError";
      const worktrees = parseWorktrees(source);
      const first = worktrees[0];
      if (!first) throw new Error("Empty git worktree list");
      const identity = first.path;
      if (seen.has(identity)) continue;
      seen.add(identity);
      errorKey = "inicio.worktrees.branchReadError";
      const raw = yield* gitRead(
        ["branch", "--no-merged", "main", "--format=%(refname)"],
        repository.path,
      );
      const names = branchNames(raw);
      errorKey = "inicio.worktrees.branchAgeReadError";
      const branches: WorktreeBranch[] = [];
      for (const name of new Set(names))
        branches.push(yield* readBranch(name, repository.path, worktrees, instant));
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
        reason: t(
          error instanceof GitError && error.kind === "timeout"
            ? "inicio.worktrees.readTimeout"
            : errorKey,
        ),
      });
    }
  }
  const rank = { cleanNow: 3, reviewSoon: 2, upToDate: 1, clean: 0 };
  return rows.sort((a, b) => {
    const ar = a.kind === "error" ? 0.5 : rank[a.state];
    const br = b.kind === "error" ? 0.5 : rank[b.state];
    return (
      br - ar ||
      (b.kind === "ok" ? b.branches.length + b.leftovers : 0) -
        (a.kind === "ok" ? a.branches.length + a.leftovers : 0)
    );
  });
}
/** Resolve repository facts synchronously for existing non-streaming callers. */
export function readWorktreesByRepo(
  repositories: readonly Repository[],
  instant = now().getTime(),
): WorktreesByRepo {
  const reader = worktreesRead(repositories, instant);
  let step = reader.next();
  while (!step.done) {
    try {
      step = reader.next(runGit(step.value.args, step.value.cwd));
    } catch (error) {
      step = reader.throw(error);
    }
  }
  return step.value;
}

async function readAsync(repositories: readonly Repository[]): Promise<WorktreesByRepo> {
  const reader = worktreesRead(repositories, now().getTime());
  let step = reader.next();
  while (!step.done) {
    try {
      step = reader.next(await runGitAsync(step.value.args, step.value.cwd));
    } catch (error) {
      step = reader.throw(error);
    }
  }
  return step.value;
}

function repositoriesToRead(): Repository[] {
  return [
    { id: "factory", name: "Fábrica", path: resolveFactoryRoot() },
    ...readPortfolio()
      .map((entry) => ({
        id: path.basename(entry.path),
        name: entry.name,
        path: resolveProjectPath(entry.path),
      }))
      .filter((entry) => pathExists(entry.path)),
  ];
}

/** Synchronous compatibility entry point for non-streaming mounts. */
export const getWorktreesByRepoSync = cache(
  (): WorktreesByRepo => readWorktreesByRepo(repositoriesToRead()),
);

const WORKTREES_CACHE_MS = 5_000;
let recentRead: { key: string; expires: number; value: Promise<WorktreesByRepo> } | undefined;
/** Async repository traversal, deduplicated across server refreshes for five seconds. */
export const getWorktreesByRepo = cache((): Promise<WorktreesByRepo> => {
  const repositories = repositoriesToRead();
  const key = JSON.stringify([repositories, process.env.MC_GIT_FIXTURE, process.env.MC_CLOCK]);
  if (recentRead?.key === key && Date.now() < recentRead.expires) return recentRead.value;
  const value = readAsync(repositories);
  const entry = { key, expires: Number.POSITIVE_INFINITY, value };
  recentRead = entry;
  void value.then(
    () => {
      entry.expires = Date.now() + WORKTREES_CACHE_MS;
    },
    () => {
      if (recentRead === entry) recentRead = undefined;
    },
  );
  return value;
});
