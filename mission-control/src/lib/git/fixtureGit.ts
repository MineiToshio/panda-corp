import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "../config/config";
import { type FixtureRepo, fixtureAnswer } from "./fixtureAnswers";
import { GitError } from "./gitError";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
function validRepo(value: unknown): value is FixtureRepo {
  if (
    !record(value) ||
    typeof value.root !== "string" ||
    !count(value.commits) ||
    !Array.isArray(value.branches) ||
    !Array.isArray(value.extraWorktrees)
  )
    return false;
  return (
    (value.pluginUncommitted === undefined || count(value.pluginUncommitted)) &&
    value.branches.every(
      (b: unknown) =>
        record(b) &&
        typeof b.name === "string" &&
        instant(b.lastCommitAt) &&
        count(b.ahead) &&
        typeof b.subject === "string" &&
        count(b.filesChanged) &&
        (b.worktree === null || typeof b.worktree === "string") &&
        count(b.uncommitted),
    ) &&
    value.extraWorktrees.every(
      (w: unknown) =>
        record(w) &&
        typeof w.path === "string" &&
        (w.locked === undefined || typeof w.locked === "boolean") &&
        (w.detached === undefined || typeof w.detached === "boolean"),
    )
  );
}

function snapshotAnswer(
  id: string,
  head: unknown,
  scenario: unknown,
  command: string,
): string | undefined {
  if (id === "funko-tracker" && typeof head === "string") {
    const stale = scenario === "snapshot-stale";
    const green = new Date(Date.parse(head) - (stale ? 26 : 5) * 3_600_000);
    const snapshot: Record<string, string> = {
      "rev-list --count a41c09e2..HEAD": stale ? "14" : "3",
      "log -1 --format=%ct HEAD": String(Math.floor(Date.parse(head) / 1000)),
      "log -1 --format=%ct a41c09e2": String(Math.floor(green.getTime() / 1000)),
      "log -1 --format=%cI HEAD": head,
      "log -1 --format=%cI a41c09e2": green.toISOString(),
      "log -1 --format=%s a41c09e2": "feat(catalog): verified catalog snapshot",
    };
    const answer = snapshot[command];
    if (answer !== undefined) return answer;
  }
  return undefined;
}

/** Dispatch fixture git without executing a process; malformed sources fail loudly. */
export function fixtureGit(file: string, args: readonly string[], cwd: string): string {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new GitError(
      "failed",
      "Cannot read git fixture; regenerate with node docs/design/prototype/scripts/make-fixtures.mjs",
    );
  }
  if (
    !record(data) ||
    !record(data.repos) ||
    !record(data.lastActivity) ||
    !Object.values(data.repos).every(validRepo) ||
    !Object.values(data.lastActivity).every(instant)
  )
    throw new GitError(
      "failed",
      "Malformed git fixture; regenerate with node docs/design/prototype/scripts/make-fixtures.mjs",
    );
  if (
    data.scenario !== undefined &&
    !["snapshot-stale", "worktrees-unreadable"].includes(String(data.scenario))
  )
    throw new GitError("failed", "Unknown git fixture scenario");
  const repos = data.repos;
  const entry = Object.entries(repos).find(
    ([, repo]) => validRepo(repo) && repo.branches.some((b) => b.worktree === cwd),
  );
  const id =
    path.resolve(cwd) === path.resolve(resolveFactoryRoot())
      ? "factory"
      : (entry?.[0] ?? path.basename(cwd));
  if (args.join(" ") === "log -1 --format=%cI" && typeof data.lastActivity[id] === "string")
    return data.lastActivity[id];
  if (
    data.scenario === "worktrees-unreadable" &&
    id === "pandasaga" &&
    args.join(" ") === "worktree list --porcelain"
  )
    throw new GitError("failed", "git worktree list terminó con error");
  const snapshot = snapshotAnswer(id, data.lastActivity[id], data.scenario, args.join(" "));
  if (snapshot !== undefined) return snapshot;
  const repo = repos[id];
  const answer = validRepo(repo) ? fixtureAnswer(repo, args, cwd) : undefined;
  if (answer === undefined)
    throw new GitError("no-fixture-answer", "Git fixture has no answer for this read");
  return answer;
}
