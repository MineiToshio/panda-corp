// Real `git worktree` commands: the integration worktree, unit worktrees, healing, removal and moves (D22, A4).
import * as fsp from "node:fs/promises";
import path from "node:path";
import { worktreeRemovalReason } from "../../../scripts/worktree-sweep.mjs";
import { defaultExec, readJson } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { bootstrapIntegrationWorktree } from "./bootstrap.mjs";
import { err } from "./common.mjs";
import { abortPendingOperations, assertBranchCreatable, findRegistered, gitIn, listWorktrees, out, realOrResolved, refExists } from "./git.mjs";

/**
 * Create (or re-attach) the integration worktree `.pandacorp/run/build/integration` on `lane/<run_id>/integration`.
 * Idempotent: a registered worktree of that path on that branch is returned unchanged; an existing branch without
 * worktree is checked out; otherwise the branch is created at `baseRef`. Never deletes a stray directory.
 * @param {{project: string, runId: string, baseRef?: string}} input `baseRef` defaults to `HEAD` of the main checkout
 * @param {{exec?: Function, fs?: object, env?: object, homedir?: string}} [deps]
 * Every fresh checkout (`git worktree add`) is bootstrapped right away ({@link bootstrapIntegrationWorktree}); a failed
 * bootstrap does not fail the call: it is reported in `bootstrap` and the landing re-checks it before G3.
 * @returns {Promise<{branch: string, worktree: string, base_sha: string|null, created: boolean,
 *   bootstrap?: {ok: boolean, ran: boolean, cached: boolean, exit: number|null, tail: string}}>} `base_sha` is null on a re-attach;
 *   `bootstrap` is absent when the registered worktree was reused
 * @throws INVALID_STATE when the path holds something that is not this worktree; GIT_FAILED on a git error
 */
export async function createIntegrationWorktree({ project, runId, baseRef = "HEAD" }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const p = buildPaths(project, deps);
  const g = gitIn(exec, p.project);
  const branch = p.integrationBranch(runId);
  const worktree = p.integrationWorktree;
  const existing = await findRegistered(g, fs, worktree);
  if (existing) {
    // A detached HEAD is an integration step's rebase (live, or killed mid-way): the next write's prepareIntegration
    // aborts it and re-checks-out the branch, so a re-attach (`start --resume`) must not refuse it. Another branch is refused.
    if (existing.branch !== branch && !existing.detached) throw err("INVALID_STATE", `integration worktree ${worktree} is on ${existing.branch ?? "a detached HEAD"}, expected ${branch}`);
    return { branch, worktree, base_sha: null, created: false };
  }
  await g(["worktree", "prune"]);
  if (await fs.stat(worktree).then(() => true, () => false)) {
    throw err("INVALID_STATE", `${worktree} exists but is not a registered worktree; refusing to touch it`);
  }
  await fs.mkdir(path.dirname(worktree), { recursive: true });
  const base = out(await g(["rev-parse", "--verify", `${baseRef}^{commit}`]));
  if (await refExists(g, `refs/heads/${branch}`)) {
    await g(["worktree", "add", worktree, branch]);
    const base_sha = out(await g(["merge-base", branch, base]));
    return { branch, worktree, base_sha, created: false, bootstrap: await bootstrapIntegrationWorktree({ project, runId, force: true }, deps) };
  }
  await assertBranchCreatable(g, branch);
  await g(["worktree", "add", "-b", branch, worktree, base]);
  return { branch, worktree, base_sha: base, created: true, bootstrap: await bootstrapIntegrationWorktree({ project, runId, force: true }, deps) };
}

/**
 * Delete the bootstrap manifest entries (`<main checkout>/.pandacorp/run/worktrees/*.json`, written by worktree-bootstrap.sh,
 * read by Mission Control as pending worktrees) whose `path` is `worktree`. Only that untracked directory is touched (D1).
 * Best effort: an unreadable entry is left alone.
 * @param {string} project the project (any checkout of its repository)
 * @param {string} worktree the removed worktree's root
 * @returns {Promise<string[]>} the deleted entry files
 */
export async function dropBootstrapManifests(project, worktree, deps = {}) {
  const fs = deps.fs ?? fsp;
  const common = await gitIn(deps.exec ?? defaultExec, path.resolve(project))(["rev-parse", "--git-common-dir"], { allowFail: true });
  if (common.code !== 0) return [];
  const dir = path.join(path.dirname(path.resolve(project, out(common))), ".pandacorp", "run", "worktrees");
  if (await realOrResolved(fs, dir) !== path.resolve(dir)) return [];
  const wanted = new Set([path.resolve(worktree), await realOrResolved(fs, worktree)]);
  const dropped = [];
  for (const name of await fs.readdir(dir).catch(() => [])) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(dir, name);
    if (!(await fs.lstat(file).then(st => st.isFile() && !st.isSymbolicLink(), () => false))) continue;
    let entry;
    try { entry = JSON.parse(await fs.readFile(file, "utf8")); } catch { continue; }
    if (typeof entry?.path !== "string") continue;
    if (!wanted.has(path.resolve(entry.path)) && !wanted.has(await realOrResolved(fs, entry.path))) continue;
    await fs.rm(file, { force: true });
    dropped.push(file);
  }
  return dropped;
}

/**
 * Discard the uncommitted tracked changes of the integration worktree left by an engine write that died before its commit
 * (a `kill -9` of drive or of a session between a work-order write and `git commit`): every engine write there is one
 * commit and is re-run idempotently, so such a change is never work to keep, and leaving it would make every later write
 * and the landing refuse the worktree (INTEGRATION_DIRTY). Only for `start --resume`, under the lease, with no land job
 * running in it. A worktree on another branch or mid-rebase is left to the next write's own healing; untracked and
 * skip-worktree files (bootstrap-owned) are never touched.
 * @param {{project: string, runId: string}} input
 * A merge, cherry-pick or revert killed before its own abort (an assumption merge that conflicted) is aborted FIRST:
 * resetting its files would leave `MERGE_HEAD` behind and the next plain commit would record a phantom merge that makes
 * the unmerged branch look landed. The aborted branch stays unmerged and is retried by the next integration pass.
 * @returns {Promise<{healed: boolean, discarded: string[], aborted: string[]}>}
 * @throws GIT_FAILED on a git error (including a failed abort: the worktree is then left for the loud refusal)
 */
export async function healIntegrationWorktree({ project, runId }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const p = buildPaths(project, deps);
  const existing = await findRegistered(gitIn(exec, path.resolve(project)), fs, p.integrationWorktree);
  if (!existing || existing.branch !== p.integrationBranch(runId)) return { healed: false, discarded: [], aborted: [] };
  const g = gitIn(exec, existing.path);
  const aborted = await abortPendingOperations(g);
  const none = { healed: aborted.length > 0, discarded: [], aborted };
  const changed = out(await g(["diff", "--name-only", "--no-renames", "HEAD"])).split("\n").filter(Boolean);
  if (!changed.length) return none;
  const added = new Set(out(await g(["diff", "--name-only", "--no-renames", "--diff-filter=A", "HEAD"])).split("\n").filter(Boolean));
  await g(["reset", "--quiet", "--", ...changed]);
  const restore = changed.filter((f) => !added.has(f));
  if (restore.length) await g(["checkout", "--quiet", "HEAD", "--", ...restore]);
  return { healed: true, discarded: changed, aborted };
}

/**
 * Create (or re-attach) a unit worktree `.pandacorp/run/build/wt/<unit>[-a<n>]` on its unit branch, branched from
 * the integration tip (or `baseRef`). Idempotent like `createIntegrationWorktree`.
 * @param {{project: string, runId: string, unitId: string, attempt?: number, baseRef?: string, branch?: string}} input
 *   `branch` overrides the name from `paths.unitBranch`; `baseRef` defaults to the integration branch
 * @returns {Promise<{branch: string, worktree: string, base_sha: string|null, created: boolean}>}
 * @throws INVALID_STATE on a branch-namespace collision or a foreign directory at the path
 */
export async function createUnitWorktree({ project, runId, unitId, attempt = 1, baseRef, branch }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const p = buildPaths(project, deps);
  const g = gitIn(exec, p.project);
  const name = branch ?? p.unitBranch(runId, unitId, attempt);
  const worktree = p.unitWorktree(unitId, attempt);
  const existing = await findRegistered(g, fs, worktree);
  if (existing) {
    if (existing.branch !== name) throw err("INVALID_STATE", `unit worktree ${worktree} is on ${existing.branch ?? "a detached HEAD"}, expected ${name}`);
    return { branch: name, worktree, base_sha: null, created: false };
  }
  await g(["worktree", "prune"]);
  if (await fs.stat(worktree).then(() => true, () => false)) {
    throw err("INVALID_STATE", `${worktree} exists but is not a registered worktree; refusing to touch it`);
  }
  await fs.mkdir(path.dirname(worktree), { recursive: true });
  const base = out(await g(["rev-parse", "--verify", `${baseRef ?? p.integrationBranch(runId)}^{commit}`]));
  if (await refExists(g, `refs/heads/${name}`)) {
    await g(["worktree", "add", worktree, name]);
    return { branch: name, worktree, base_sha: out(await g(["merge-base", name, base])), created: false };
  }
  await assertBranchCreatable(g, name);
  await g(["worktree", "add", "-b", name, worktree, base]);
  return { branch: name, worktree, base_sha: base, created: true };
}

/**
 * Remove a registered worktree (`git worktree remove`), keeping its branch. A worktree that is not registered is a no-op.
 * @param {{project: string, worktree: string, state?: object}} input; `force` is ignored: every removal must pass the shared safety predicate
 * @returns {Promise<{removed: boolean, worktree: string}>}
 * @throws GIT_FAILED when git itself refuses a removal that passed the safety predicate
 */
export async function removeWorktree({ project, worktree, state = null }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const g = gitIn(exec, path.resolve(project));
  const existing = await findRegistered(g, fs, worktree);
  if (!existing) { await g(["worktree", "prune"]); return { removed: false, worktree }; }
  const current = state ?? await readJson(buildPaths(project, deps).stateFile, { fs }).catch(() => null);
  const runningPaths = runningWorktreePaths(current, deps);
  const reason = worktreeRemovalReason(existing.path, { runningPaths });
  if (reason) return { removed: false, worktree, reason };
  // --force is needed for proven generated ignored outputs and bootstrap overrides. The shared predicate
  // above has just rejected dirty/hidden changes, locks, owner state and every live cwd.
  await g(["worktree", "remove", "--force", "--", existing.path]);
  await g(["worktree", "prune"]);
  await dropBootstrapManifests(project, existing.path, deps).catch(() => []);
  return { removed: true, worktree };
}

/** Remove a unit worktree (alias of `removeWorktree` named for the call sites). */
export const removeUnitWorktree = removeWorktree;

/** Remove the integration worktree (alias of `removeWorktree`); the branch `lane/<run_id>/integration` stays. */
export const removeIntegrationWorktree = removeWorktree;

/**
 * Move every registered worktree that lives under `from` to the same relative path under `to`, with
 * `git worktree move` (never a plain rename, A4). Used for the `build/` -> `build-archive|build-suspended/<run>/` moves
 * and their reverse; the caller moves the remaining plain files afterwards.
 * @param {{project: string, from: string, to: string}} input absolute directories
 * @returns {Promise<{moved: {from: string, to: string}[]}>}
 * @throws INVALID_STATE for a locked worktree or an occupied destination; GIT_FAILED on a git error
 */
export async function moveWorktreesUnder({ project, from, to }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const g = gitIn(exec, path.resolve(project));
  const root = await realOrResolved(fs, from);
  const moved = [];
  for (const item of await listWorktrees(g)) {
    const real = await realOrResolved(fs, item.path);
    if (real !== root && !real.startsWith(`${root}${path.sep}`)) continue;
    if (item.locked) throw err("INVALID_STATE", `worktree ${item.path} is locked and cannot be moved`);
    const dest = path.join(path.resolve(to), path.relative(root, real));
    if (await fs.stat(dest).then(() => true, () => false)) throw err("INVALID_STATE", `${dest} already exists; refusing to move ${item.path} onto it`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await g(["worktree", "move", item.path, dest]);
    moved.push({ from: item.path, to: dest });
  }
  return { moved };
}

/** Running work always wins over reclamation, including a job's nested product cwd. */
export function runningWorktreePaths(state, deps = {}) {
  const alive = deps.isAlive ?? (pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } });
  const livePid = pid => Number.isInteger(pid) && pid > 0 && alive(pid);
  return [
    ...(state?.units ?? []).filter(u => u.state === "running" && (state.status === "active" || livePid(u.worker?.pid))).map(u => u.worktree),
    ...(state?.jobs ?? []).filter(j => j.state === "running" && (!Number.isInteger(j.pid) || livePid(j.pid))).map(j => j.cwd),
  ].filter(Boolean);
}

/** Reclaim this run's registered checkouts only. Every ref survives; protected work is reported and retained. */
export async function cleanupRunWorktrees({ project, state = null, mode = "close" }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  const current = state ?? await readJson(p.stateFile, { fs }).catch(() => null);
  if (!current?.run_id) return { removed: [], kept: [] };
  const g = gitIn(deps.exec ?? defaultExec, project);
  const root = await realOrResolved(fs, p.build);
  const integration = await realOrResolved(fs, p.integrationWorktree);
  const removed = [], kept = [];
  const waiting = mode === "waiting_gate" || (mode === "close" && current.status === "waiting_gate");
  for (const entry of await listWorktrees(g)) {
    const target = await realOrResolved(fs, entry.path);
    if (!target.startsWith(`${root}${path.sep}`)) continue;
    if (mode === "landed" && !target.startsWith(`${root}${path.sep}wt${path.sep}`)) continue;
    if (entry.branch && !entry.branch.startsWith(`lane/${current.run_id}/`)) { kept.push({ path: target, reason: "foreign-run" }); continue; }
    if (waiting && target === integration) {
      const reason = worktreeRemovalReason(entry.path, { runningPaths: runningWorktreePaths(current, deps) });
      if (!reason) {
        const prefix = out(await g(["rev-parse", "--show-prefix"]));
        const cache = path.join(target, prefix, ".next");
        if (await fs.lstat(cache).then(st => st.isDirectory() && !st.isSymbolicLink(), () => false)) await fs.rm(cache, { recursive: true });
      }
      kept.push({ path: target, reason: reason ?? "waiting-gate" });
      continue;
    }
    const result = await removeWorktree({ project, worktree: entry.path, state: current }, deps);
    if (result.removed) removed.push(target); else kept.push({ path: target, reason: result.reason ?? "not-removed" });
  }
  return { removed, kept };
}
