// review-record git helpers (integration worktree only): command wrapper, commits, repository prefix, staged changes.
import path from "node:path";
import { err } from "./common.mjs";

export async function git(exec, cwd, args) {
  const r = await exec("git", args, { cwd });
  if (r.code !== 0) throw err("INVALID_STATE", `git ${args[0]} failed in ${cwd}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
  return r.stdout.trim();
}

export async function commitStaged(exec, cwd, subject, trailers) {
  if ((await exec("git", ["diff", "--cached", "--quiet"], { cwd })).code === 0) return null;
  await git(exec, cwd, ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", subject, "-m", trailers.join("\n")]);
  return git(exec, cwd, ["rev-parse", "HEAD"]);
}

/**
 * Git reports paths relative to the repository top-level, but a nested project (Mission Control inside the factory
 * repo) runs every command with the product root as cwd. The prefix of the product root inside its repository
 * (`mission-control/`, "" for a top-level project) translates between the two spellings.
 * @param {Function} exec injected command runner
 * @param {string} root the product root (`state.integration.worktree`)
 * @returns {Promise<string>} "" or `dir/` with a trailing slash, posix separators
 */
export async function repoPrefix(exec, root) {
  const prefix = (await git(exec, root, ["rev-parse", "--show-prefix"])).replace(/\\/g, "/").replace(/\/+$/, "");
  return prefix === "" ? "" : `${prefix}/`;
}

/** Repository-top-relative path (as git prints it) to product-root-relative; a path outside the product stays as is. */
export const fromRepoPath = (prefix, p) => (prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p);

/** Product-root-relative path to repository-top-relative. */
export const toRepoPath = (prefix, p) => `${prefix}${p}`;

/** The product root inside a git worktree root (`state.units[].worktree` stores the worktree root, not the product root). */
export const productRootIn = (worktree, prefix) => (prefix ? path.join(worktree, prefix) : worktree);

// `--relative` makes git print (and limit itself to) paths relative to the cwd, which is the product root, so the
// `git add` pathspecs below resolve from that same cwd in a nested project.
export async function stageTrackedChanges(exec, cwd) {
  const changed = (await git(exec, cwd, ["diff", "--name-only", "--relative", "-z"])).split("\0").filter((f) => f && !f.startsWith(".pandacorp/run/"));
  if (changed.length > 0) await git(exec, cwd, ["add", "--", ...changed]);
}
