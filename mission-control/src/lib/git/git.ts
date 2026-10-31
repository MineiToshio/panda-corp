import childProcess from "node:child_process";
import { resolveFactoryRoot } from "../config/config";
import { fixtureGit } from "./fixtureGit";
import { GitError } from "./gitError";

function isReadOnly(args: readonly string[]): boolean {
  const [command, ...rest] = args;
  if (
    rest.some((arg) =>
      /^(?:--(?:output|ext-diff|textconv|exec|config-env|git-dir|work-tree|no-index)(?:=|$)|-[cC]$)/.test(
        arg,
      ),
    )
  )
    return false;
  if (command === "worktree")
    return rest.length === 2 && rest[0] === "list" && rest[1] === "--porcelain";
  if (command === "branch")
    return (
      rest.some((arg) => /^(--list|--no-merged|--merged)$/.test(arg)) &&
      rest.every(
        (arg) => !arg.startsWith("-") || /^(--list|--no-merged|--merged|--format=.+)$/.test(arg),
      )
    );
  if (command === "symbolic-ref")
    return rest.join(" ") === "--quiet --short refs/remotes/origin/HEAD";
  if (command === "status")
    return rest[0] === "--porcelain" && (rest.length === 1 || rest[1] === "--");
  return (
    ["log", "rev-parse", "rev-list", "diff", "show"].includes(command ?? "") &&
    rest.every(
      (arg) =>
        !arg.startsWith("-") ||
        /^(?:-1|-n|-p|--(?:count|short|verify|show-toplevel|abbrev-ref|is-inside-work-tree|shortstat|stat|name-only|name-status|numstat|no-patch|oneline|reverse|all|date-order|first-parent)|--(?:format|pretty|since|until|max-count|date)=.+|--)$/.test(
          arg,
        ),
    )
  );
}

/** Run an allowlisted read-only git command, or answer solely from MC_GIT_FIXTURE. */
export function runGit(args: readonly string[], cwd = resolveFactoryRoot()): string {
  if (!isReadOnly(args))
    throw new GitError("disallowed", "Git command is not an approved read-only operation");
  if (process.env.MC_GIT_FIXTURE !== undefined)
    return fixtureGit(process.env.MC_GIT_FIXTURE, args, cwd).trim();
  try {
    return childProcess
      .execFileSync("git", [...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
        maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "cat" },
      })
      .trim();
  } catch (error) {
    const timeout = error instanceof Error && "code" in error && error.code === "ETIMEDOUT";
    throw new GitError(
      timeout ? "timeout" : "failed",
      timeout ? "Git read timed out" : "Git read failed",
    );
  }
}

const MAX_ASYNC_GIT_READS = 4;
let activeReads = 0;
const waitingReads: (() => void)[] = [];

/** Run the same read-only git boundary without blocking rendering; at most four children run at once. */
export async function runGitAsync(
  args: readonly string[],
  cwd = resolveFactoryRoot(),
): Promise<string> {
  if (!isReadOnly(args))
    throw new GitError("disallowed", "Git command is not an approved read-only operation");
  if (process.env.MC_GIT_FIXTURE !== undefined)
    return fixtureGit(process.env.MC_GIT_FIXTURE, args, cwd).trim();
  if (activeReads >= MAX_ASYNC_GIT_READS)
    await new Promise<void>((resolve) => waitingReads.push(resolve));
  else activeReads += 1;
  try {
    return await new Promise<string>((resolve, reject) => {
      childProcess.execFile(
        "git",
        [...args],
        {
          cwd,
          encoding: "utf8",
          timeout: 10_000,
          maxBuffer: 256 * 1024 * 1024,
          env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "cat" },
        },
        (error, stdout) => {
          if (!error) return resolve(stdout.trim());
          const timeout = error.killed || String(error.code) === "ETIMEDOUT";
          reject(
            new GitError(
              timeout ? "timeout" : "failed",
              timeout ? "Git read timed out" : "Git read failed",
            ),
          );
        },
      );
    });
  } finally {
    const next = waitingReads.shift();
    if (next) next();
    else activeReads -= 1;
  }
}
