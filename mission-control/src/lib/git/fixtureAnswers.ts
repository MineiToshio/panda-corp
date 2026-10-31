import { readFileSync } from "node:fs";
import path from "node:path";
import { GitError } from "./gitError";

/** Serialized branch facts in the prototype oracle. */
interface FixtureBranch {
  name: string;
  lastCommitAt: string;
  ahead: number;
  subject: string;
  filesChanged: number;
  worktree: string | null;
  uncommitted: number;
}
/** Serialized repository facts; root is a display path, never the repository lookup key. */
export interface FixtureRepo {
  root: string;
  name?: string;
  commits: number;
  pluginUncommitted?: number;
  branches: FixtureBranch[];
  extraWorktrees: { path: string; detached?: boolean; locked?: boolean }[];
}
const changedFiles = (count: number, file: string) =>
  Array.from({ length: count }, (_, i) => ` M ${file}${i + 1}.ts`).join("\n");

/** Answer the base read families; undefined means this fixture has no answer. */
export function fixtureAnswer(
  repo: FixtureRepo,
  args: readonly string[],
  cwd: string,
): string | undefined {
  const command = args.join(" ");
  const defaultBranch = "main";
  const answers: Record<string, () => string> = {
    "symbolic-ref --quiet --short refs/remotes/origin/HEAD": () => `origin/${defaultBranch}`,
    "rev-list --count HEAD": () => String(repo.commits),
    "rev-parse --is-inside-work-tree": () => "true",
    [`branch --no-merged ${defaultBranch} --format=%(refname:short)`]: () =>
      repo.branches.map((b) => b.name).join("\n"),
    [`branch --no-merged ${defaultBranch} --format=%(refname)`]: () =>
      repo.branches.map((b) => `refs/heads/${b.name}`).join("\n"),
    "status --porcelain -- plugin": () => changedFiles(repo.pluginUncommitted ?? 0, "plugin/file-"),
    "status --porcelain": () =>
      changedFiles(repo.branches.find((b) => b.worktree === cwd)?.uncommitted ?? 0, "src/file-"),
    "worktree list --porcelain": () =>
      [
        `worktree ${repo.root}\nHEAD ${"0".repeat(40)}\nbranch refs/heads/${defaultBranch}`,
        ...repo.branches
          .filter((b) => b.worktree)
          .map(
            (b) => `worktree ${b.worktree}\nHEAD ${"1".repeat(40)}\nbranch refs/heads/${b.name}`,
          ),
        ...repo.extraWorktrees.map((w) =>
          [
            `worktree ${w.path}`,
            `HEAD ${"2".repeat(40)}`,
            ...(w.detached ? ["detached"] : []),
            ...(w.locked ? ["locked"] : []),
          ].join("\n"),
        ),
      ].join("\n\n"),
  };
  if (answers[command]) return answers[command]();
  for (const branch of repo.branches) {
    const branchAnswers: Record<string, string> = {
      [`rev-list --count main..${branch.name}`]: String(branch.ahead),
      [`log -1 --format=%ct refs/heads/${branch.name}`]: String(
        Math.floor(Date.parse(branch.lastCommitAt) / 1000),
      ),
      [`log -1 --format=%s refs/heads/${branch.name}`]: branch.subject,
      [`log -1 --format=%ct ${branch.name}`]: String(
        Math.floor(Date.parse(branch.lastCommitAt) / 1000),
      ),
      [`log -1 --format=%s ${branch.name}`]: branch.subject,
      [`log -1 --format=%ct|%s ${branch.name}`]: `${Math.floor(Date.parse(branch.lastCommitAt) / 1000)}|${branch.subject}`,
      [`diff --shortstat main...${branch.name}`]: ` ${branch.filesChanged} files changed, ${branch.filesChanged * 9} insertions(+), ${branch.filesChanged * 2} deletions(-)`,
    };
    if (command in branchAnswers) return branchAnswers[command];
  }
  return historyAnswer(repo, args, cwd);
}

function historyAnswer(
  repo: FixtureRepo,
  args: readonly string[],
  cwd: string,
): string | undefined {
  const file = process.env.MC_GIT_FIXTURE;
  if (file === undefined) return undefined;
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isRecord(data)) throw new GitError("no-fixture-answer", "Invalid history fixture");
  const command = args.join(" ");
  if (command.startsWith("log -1 --format=%H -- ")) return "f".repeat(40);
  if (command === "log --reverse --format=%x00%cI -p -- docs/frds") {
    return verifiedEntries(data.verifiedAt)
      .map(([file, date]) => `\0${date}\n+++ b/${file}\n+implementation_status: VERIFIED`)
      .join("\n");
  }
  if (command === "log -n 400 --reverse --format=%x00%cI -p -- .pandacorp/status.yaml") {
    const name =
      path.basename(cwd) === "mission-control" || path.basename(repo.root) === "panda-corp"
        ? "Pandacorp (Mission Control)"
        : repo.name;
    const history = isRecord(data.phaseHistory) ? data.phaseHistory[name ?? ""] : undefined;
    if (!Array.isArray(history)) throw new GitError("no-fixture-answer", "Missing phase history");
    return history
      .map((obs) => {
        if (!isRecord(obs) || typeof obs.date !== "string" || typeof obs.phase !== "string")
          throw new GitError("no-fixture-answer", "Invalid phase history");
        return `\0${obs.date}T00:00:00Z\n+phase: ${obs.phase}`;
      })
      .join("\n");
  }
  if (command === "log -n 4000 --format=%cI%x09%s -- .") {
    return verifiedEntries(data.verifiedAt)
      .map(([file, date]) => {
        const id = /wo-(\d+-\d+)/.exec(file)?.[1];
        if (!id) throw new GitError("no-fixture-answer", "Invalid work-order history");
        return `${date}\tfeat(build): verify WO-${id}`;
      })
      .join("\n");
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function verifiedEntries(value: unknown): [string, string][] {
  if (!isRecord(value)) throw new GitError("no-fixture-answer", "Missing verified history");
  return Object.entries(value).map(([file, date]) => {
    if (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
      throw new GitError("no-fixture-answer", "Invalid verified history");
    return [file, date];
  });
}
