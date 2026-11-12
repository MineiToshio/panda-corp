// git plumbing shared by the integration modules: a cwd-bound `git` runner, worktree listing and ref checks.
import path from "node:path";
import { err, tail } from "./common.mjs";

/** `git(args, opts)` bound to a cwd; throws GIT_FAILED on a non-zero exit unless `allowFail`. */
export function gitIn(exec, cwd) {
  return async (args, { allowFail = false } = {}) => {
    const res = await exec("git", args, { cwd });
    if (res.code !== 0 && !allowFail) {
      throw err("GIT_FAILED", `git ${args.slice(0, 3).join(" ")} failed (exit ${res.code}): ${tail(res.stderr || res.stdout)}`, { exit: res.code });
    }
    return res;
  };
}
export const out = (res) => res.stdout.trim();

export async function realOrResolved(fs, p) {
  try { return await fs.realpath(p); } catch { return path.resolve(p); }
}

/** Parse `git worktree list --porcelain` into `[{path, head, branch|null, locked, detached}]`. */
export async function listWorktrees(g) {
  const res = await g(["worktree", "list", "--porcelain"]);
  const items = [];
  for (const block of res.stdout.split(/\n\s*\n/)) {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) continue;
    const item = { path: "", head: null, branch: null, locked: false, detached: false };
    for (const line of lines) {
      if (line.startsWith("worktree ")) item.path = line.slice(9);
      else if (line.startsWith("HEAD ")) item.head = line.slice(5);
      else if (line.startsWith("branch ")) item.branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "detached") item.detached = true;
      else if (line === "locked" || line.startsWith("locked ")) item.locked = true;
    }
    if (item.path) items.push(item);
  }
  return items;
}

export async function findRegistered(g, fs, wanted) {
  const target = await realOrResolved(fs, wanted);
  for (const item of await listWorktrees(g)) if (await realOrResolved(fs, item.path) === target) return item;
  return null;
}

/** In-progress merge-like operations that leave a pending commit state (`<GIT_DIR>/<HEAD file>`), with their abort command. */
const PENDING_OPERATIONS = Object.freeze([
  { name: "merge", head: "MERGE_HEAD" },
  { name: "cherry-pick", head: "CHERRY_PICK_HEAD" },
  { name: "revert", head: "REVERT_HEAD" },
]);

/** Names of the merge/cherry-pick/revert operations still in progress in this worktree (a plain `git commit` would conclude them). */
export async function pendingOperations(g) {
  const found = [];
  for (const op of PENDING_OPERATIONS) {
    if ((await g(["rev-parse", "-q", "--verify", op.head], { allowFail: true })).code === 0) found.push(op.name);
  }
  return found;
}

/** Abort every in-progress merge/cherry-pick/revert (`git <name> --abort`); returns the names aborted. @throws GIT_FAILED */
export async function abortPendingOperations(g) {
  const names = await pendingOperations(g);
  for (const name of names) await g([name, "--abort"]);
  return names;
}

export const refExists = async (g, ref) => (await g(["show-ref", "--verify", "--quiet", ref], { allowFail: true })).code === 0;

/**
 * A branch ref cannot coexist with another ref that is one of its path prefixes (or lives under it) in git's
 * files backend: a branch and a branch nested under its name collide, as `lane/r1` and `lane/r1/u-x` would. Fail early with a clear message instead of git's.
 * @throws INVALID_STATE (`BRANCH_NAMESPACE`) on a collision
 */
export async function assertBranchCreatable(g, branch) {
  const parts = branch.split("/");
  for (let i = 1; i < parts.length; i += 1) {
    const prefix = parts.slice(0, i).join("/");
    if (await refExists(g, `refs/heads/${prefix}`)) {
      throw err("INVALID_STATE", `branch ${branch} cannot be created: the branch ${prefix} already exists and a ref cannot be both a file and a directory`, { hint: "BRANCH_NAMESPACE" });
    }
  }
  const under = out(await g(["for-each-ref", "--count=1", "--format=%(refname)", `refs/heads/${branch}/`]));
  if (under) throw err("INVALID_STATE", `branch ${branch} cannot be created: branches already live under ${branch}/`, { hint: "BRANCH_NAMESPACE" });
}
