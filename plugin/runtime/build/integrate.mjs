// Integration of committed unit chains into the run's integration branch `lane/<run_id>/integration` (D22, CLI doc 4.1),
// plus every tracked write of the engine that lands on that branch (D1): work-order transitions, `track.jsonl`
// lines, tracked project files. The main checkout is never written. All git work goes through an injected
// `exec(cmd, args, {cwd}) -> {code, stdout, stderr}` (default: fsx.defaultExec) with real `git worktree` commands.
//
// Conventions: `deps` is the LAST, optional argument; the caller holds the fence (these functions take no lease)
// and calls them one at a time; nothing here writes `state.json` or the journal except through the optional
// `appendEvent` hook of `integrateCommitted`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { defaultExec, nowIso, writeTarget } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const tail = (text, n = 240) => String(text ?? "").trim().slice(-n);

/** Unit kinds whose branches carry commits that reach the integration branch. */
export const INTEGRABLE_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
/** Kinds whose work orders move to IN_REVIEW when the chain is integrated. */
const WO_KINDS = new Set(["build", "patch"]);
/** Unit states that mean "already integrated or later" for FRD completeness. */
const INTEGRATED_OR_LATER = new Set(["integrated", "reviewing", "verified", "landed"]);

/** Legal work-order transitions (mirror of build-state.mjs `applyWoTransition`; that function still enforces them). */
const WO_TRANSITIONS = Object.freeze({
  PLANNED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["IN_REVIEW", "BLOCKED", "PLANNED"],
  IN_REVIEW: ["VERIFIED", "PLANNED", "BLOCKED"],
  BLOCKED: ["PLANNED"],
  VERIFIED: [],
});
/** Track line each reached status produces (shapes read by Mission Control, CLI doc section 10). */
const TRACK_FOR = Object.freeze({
  IN_PROGRESS: { kind: "wo_start" },
  IN_REVIEW: { kind: "wo_end", state: "in_review" },
  VERIFIED: { kind: "wo_end", state: "verified" },
  BLOCKED: { kind: "wo_end", state: "failed" },
});
/** Longest route the engine walks on its own (reopen and late-dispatch cases); VERIFIED is only ever reached directly. */
const MAX_ROUTE_STEPS = 2;
const GOVERNED_STATUS_YAML = ".pandacorp/status.yaml";
const TRACK_FILE = ".pandacorp/track.jsonl";

// ---------------------------------------------------------------------------------------------
// git plumbing
// ---------------------------------------------------------------------------------------------

/** `git(args, opts)` bound to a cwd; throws GIT_FAILED on a non-zero exit unless `allowFail`. */
function gitIn(exec, cwd) {
  return async (args, { allowFail = false } = {}) => {
    const res = await exec("git", args, { cwd });
    if (res.code !== 0 && !allowFail) {
      throw err("GIT_FAILED", `git ${args.slice(0, 3).join(" ")} failed (exit ${res.code}): ${tail(res.stderr || res.stdout)}`, { exit: res.code });
    }
    return res;
  };
}
const out = (res) => res.stdout.trim();

async function realOrResolved(fs, p) {
  try { return await fs.realpath(p); } catch { return path.resolve(p); }
}

/** Parse `git worktree list --porcelain` into `[{path, head, branch|null, locked, detached}]`. */
async function listWorktrees(g) {
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

async function findRegistered(g, fs, wanted) {
  const target = await realOrResolved(fs, wanted);
  for (const item of await listWorktrees(g)) if (await realOrResolved(fs, item.path) === target) return item;
  return null;
}

const refExists = async (g, ref) => (await g(["show-ref", "--verify", "--quiet", ref], { allowFail: true })).code === 0;

/**
 * A branch ref cannot coexist with another ref that is one of its path prefixes (or lives under it) in git's
 * files backend: a branch and a branch nested under its name collide, as `lane/r1` and `lane/r1/u-x` would. Fail early with a clear message instead of git's.
 * @throws INVALID_STATE (`BRANCH_NAMESPACE`) on a collision
 */
async function assertBranchCreatable(g, branch) {
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

// ---------------------------------------------------------------------------------------------
// Worktrees (real `git worktree` commands)
// ---------------------------------------------------------------------------------------------

/**
 * Create (or re-attach) the integration worktree `.pandacorp/run/build/integration` on `lane/<run_id>/integration`.
 * Idempotent: a registered worktree of that path on that branch is returned unchanged; an existing branch without
 * worktree is checked out; otherwise the branch is created at `baseRef`. Never deletes a stray directory.
 * @param {{project: string, runId: string, baseRef?: string}} input `baseRef` defaults to `HEAD` of the main checkout
 * @param {{exec?: Function, fs?: object, env?: object, homedir?: string}} [deps]
 * @returns {Promise<{branch: string, worktree: string, base_sha: string|null, created: boolean}>} `base_sha` is null on a re-attach
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
    if (existing.branch !== branch) throw err("INVALID_STATE", `integration worktree ${worktree} is on ${existing.branch ?? "a detached HEAD"}, expected ${branch}`);
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
    return { branch, worktree, base_sha: out(await g(["merge-base", branch, base])), created: false };
  }
  await assertBranchCreatable(g, branch);
  await g(["worktree", "add", "-b", branch, worktree, base]);
  return { branch, worktree, base_sha: base, created: true };
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
 * @param {{project: string, worktree: string, force?: boolean}} input `force` (default true) also discards untracked files
 * @returns {Promise<{removed: boolean, worktree: string}>}
 * @throws GIT_FAILED when git refuses (for example a locked worktree, or local changes with `force:false`)
 */
export async function removeWorktree({ project, worktree, force = true }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const g = gitIn(exec, path.resolve(project));
  const existing = await findRegistered(g, fs, worktree);
  if (!existing) { await g(["worktree", "prune"]); return { removed: false, worktree }; }
  await g(["worktree", "remove", ...(force ? ["--force"] : []), existing.path]);
  await g(["worktree", "prune"]);
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

// ---------------------------------------------------------------------------------------------
// Work orders and track lines (written ONLY in the integration worktree)
// ---------------------------------------------------------------------------------------------

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;
const fmScalar = (block, key) => {
  const m = block.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
};

/**
 * Index the work orders of a worktree: lowercase id (frontmatter `id`, file stem, and the `wo-NN-MMM` token of the stem)
 * -> `{id, file, frd, status}`.
 * @param {string} root worktree root
 * @returns {Promise<Map<string, {file: string, frd: string, status: string|null}>>} `file` is repo-relative with forward slashes
 */
async function indexWorkOrders(root, fs) {
  const map = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = (await fs.readdir(frdsDir)).sort(); } catch (e) { if (e.code !== "ENOENT") throw e; }
  for (const frd of frds) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names = [];
    try { names = (await fs.readdir(dir)).sort(); } catch (e) { if (e.code !== "ENOENT") throw e; }
    for (const name of names) {
      if (!/^wo-.*\.md$/.test(name)) continue;
      const block = (await fs.readFile(path.join(dir, name), "utf8")).match(FM_BLOCK)?.[1] ?? "";
      const stem = name.replace(/\.md$/, "");
      const info = { id: fmScalar(block, "id") || stem, file: `docs/frds/${frd}/work-orders/${name}`, frd, status: fmScalar(block, "implementation_status") };
      const keys = [fmScalar(block, "id"), stem, stem.match(/^(wo-\d+-\d+)/)?.[1]];
      for (const k of keys) if (k && !map.has(k.toLowerCase())) map.set(k.toLowerCase(), info);
    }
  }
  return map;
}

/**
 * Locate a work order file inside a worktree.
 * @param {string} root worktree root
 * @param {string} woId work-order id, any case (`WO-05-002` or `wo-05-002`)
 * @returns {Promise<{id: string, file: string, frd: string, status: string|null}>} frontmatter id, repo-relative file, FRD folder slug, current `implementation_status`
 * @throws INVALID_STATE when no work order matches
 */
export async function findWorkOrder(root, woId, deps = {}) {
  const info = (await indexWorkOrders(root, deps.fs ?? fsp)).get(String(woId).toLowerCase());
  if (!info) throw err("INVALID_STATE", `work order ${woId} not found in ${root}`, { hint: "rebuild-state" });
  return info;
}

/**
 * Shortest legal chain of statuses from `from` to `to` (BFS over the work-order transition table), excluding `from`,
 * at most two steps and VERIFIED only directly (never a walk BLOCKED -> ... -> VERIFIED).
 * `IN_REVIEW -> IN_PROGRESS` is `[PLANNED, IN_PROGRESS]`, the patch path of D22.
 * @param {string} from current status
 * @param {string} to wanted status
 * @returns {string[]} empty when already there
 * @throws INVALID_STATE when `to` is unreachable (for example from VERIFIED)
 */
export function workOrderRoute(from, to) {
  if (from === to) return [];
  if (!Object.hasOwn(WO_TRANSITIONS, from) || !Object.hasOwn(WO_TRANSITIONS, to)) throw err("INVALID_STATE", `unknown work-order status ${from} or ${to}`);
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of WO_TRANSITIONS[cur]) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === to) {
        const route = [];
        for (let s = to; s !== from; s = prev.get(s)) route.unshift(s);
        if (route.length > MAX_ROUTE_STEPS || (to === "VERIFIED" && route.length > 1)) break;
        return route;
      }
      queue.push(next);
    }
  }
  throw err("INVALID_STATE", `illegal work-order transition ${from} -> ${to}`);
}

/**
 * Make sure the integration worktree is on its branch with no tracked changes; an interrupted detached rebase of an
 * earlier call is aborted and the branch re-checked-out first. Untracked files are ignored.
 * @returns {Promise<{healed: boolean, tip: string}>}
 * @throws INVALID_STATE when another branch is checked out or tracked files are dirty
 */
async function prepareIntegration(g, fs, root, branch) {
  let healed = false;
  const head = out(await g(["rev-parse", "--abbrev-ref", "HEAD"]));
  if (head !== branch) {
    const rebaseDir = path.resolve(root, out(await g(["rev-parse", "--git-path", "rebase-merge"])));
    const applyDir = path.resolve(root, out(await g(["rev-parse", "--git-path", "rebase-apply"])));
    const rebasing = (await fs.stat(rebaseDir).then(() => true, () => false)) || (await fs.stat(applyDir).then(() => true, () => false));
    if (rebasing) await g(["rebase", "--abort"]);
    if (head !== "HEAD" && !rebasing) throw err("INVALID_STATE", `integration worktree is on ${head}, expected ${branch}`);
    await g(["checkout", "--quiet", branch]);
    healed = true;
  }
  const dirty = out(await g(["status", "--porcelain", "--untracked-files=no"]));
  if (dirty) throw err("INVALID_STATE", `integration worktree has uncommitted tracked changes: ${dirty.split("\n").slice(0, 5).join("; ")}`, { hint: "INTEGRATION_DIRTY" });
  return { healed, tip: out(await g(["rev-parse", "HEAD"])) };
}

/** Undo uncommitted tracked changes (and a track file we created) after a failed multi-step write. */
async function rollbackWorktree(g, fs, root, createdTrack) {
  const changed = out(await g(["diff", "--name-only"], { allowFail: true })).split("\n").filter(Boolean);
  if (changed.length) await g(["checkout", "--quiet", "--", ...changed], { allowFail: true });
  if (createdTrack) await fs.rm(path.join(root, TRACK_FILE), { force: true });
}

/** Stage the engine's governed paths and commit them; `commit: null` when nothing changed. */
async function commitStaged(g, { subject, trailers }) {
  await g(["add", "-u", "--", "docs/frds"], { allowFail: true });
  await g(["add", "-u", "--", GOVERNED_STATUS_YAML], { allowFail: true });
  await g(["add", "-f", "--", TRACK_FILE], { allowFail: true });
  if ((await g(["diff", "--cached", "--quiet"], { allowFail: true })).code === 0) return null;
  const msg = ["-m", subject, ...(trailers.length ? ["-m", trailers.join("\n")] : [])];
  await g(["-c", "commit.gpgsign=false", "commit", "--quiet", "--no-verify", ...msg]);
  return out(await g(["rev-parse", "HEAD"]));
}

/**
 * Move work orders to a status on the integration branch and commit it (one commit, D1/D22). Each work order walks the
 * shortest legal route (`IN_REVIEW -> IN_PROGRESS` goes through `PLANNED` and bumps `reopen_count`); a work order already
 * at `to` is skipped, so a re-run after a crash is a no-op. Writes the WO file, the frd/blueprint rollups and the status
 * counters through `transitionWorkOrderAt` (never the lease projection), appends the matching `track.jsonl` lines
 * (`wo_start` for IN_PROGRESS, `wo_end` for IN_REVIEW/VERIFIED/BLOCKED) and commits ONLY on the integration branch.
 * On any failure the uncommitted changes of this call are rolled back.
 * @param {{integration: {branch: string, worktree: string}, runId: string, wos: string[], to: string, reason?: string, unitId?: string}} input
 *   `reason` is the `blocked_reason` for BLOCKED; `unitId` only labels the commit
 * @param {{exec?: Function, fs?: object, env?: object, clock?: Function, transitionWorkOrderAt?: Function}} [deps]
 * @returns {Promise<{commit: string|null, steps: {wo: string, frd: string, file: string, from: string, to: string}[], track: {ok: boolean, lines: number, error?: string}}>}
 * @throws INVALID_STATE (unknown or unreachable work order, dirty worktree), GIT_FAILED
 */
export async function transitionWorkOrders({ integration, runId, wos, to, reason = "", unitId }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const root = path.resolve(integration.worktree);
  const g = gitIn(exec, root);
  const transition = deps.transitionWorkOrderAt ?? (await import("../build-state.mjs")).transitionWorkOrderAt;
  await prepareIntegration(g, fs, root, integration.branch);
  const trackPath = path.join(root, TRACK_FILE);
  const trackExisted = await fs.stat(trackPath).then(() => true, () => false);
  const steps = [];
  const lines = [];
  try {
    const index = await indexWorkOrders(root, fs);
    for (const wo of wos) {
      const info = index.get(String(wo).toLowerCase());
      if (!info) throw err("INVALID_STATE", `work order ${wo} not found in the integration worktree`, { hint: "rebuild-state" });
      if (!info.status) throw err("INVALID_STATE", `work order ${wo} has no implementation_status`);
      let from = info.status;
      for (const step of workOrderRoute(from, to)) {
        await transition(root, { file: info.file, to: step, ...(step === "BLOCKED" ? { reason } : {}) });
        steps.push({ wo: info.id, frd: info.frd, file: info.file, from, to: step });
        const t = TRACK_FOR[step];
        if (t) lines.push({ kind: t.kind, frd: info.frd, wo: info.id, at: nowIso(deps), ...(t.state ? { state: t.state } : {}) });
        from = step;
      }
    }
    if (!steps.length) return { commit: null, steps, track: { ok: true, lines: 0 } };
    let track = { ok: true, lines: lines.length };
    try {
      await fs.mkdir(path.dirname(trackPath), { recursive: true });
      await fs.appendFile(trackPath, lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
    } catch (e) {
      track = { ok: false, lines: 0, error: String(e?.message ?? e) };
    }
    const label = unitId ? ` (${unitId})` : "";
    const woList = [...new Set(steps.map((s) => s.wo))].join(", ");
    const commit = await commitStaged(g, {
      subject: `chore(build): ${woList} -> ${to}${label}`,
      trailers: [...(unitId ? [`Integration-Of: ${unitId}`] : []), `Engine-Run: ${runId}`],
    });
    return { commit, steps, track };
  } catch (error) {
    await rollbackWorktree(g, fs, root, !trackExisted);
    throw error;
  }
}

/**
 * Write a project file the engine owns, never in the main checkout when it is git-tracked (D1). A tracked path is
 * written (replace or append) in the integration worktree and committed on `lane/<run_id>/integration`; an untracked, gitignored path
 * (for example `.pandacorp/inbox/decisions.md` in a normal project) is written in the main checkout and not committed.
 * @param {{project: string, integration: {branch: string, worktree: string}, runId: string, relPath: string, text: string,
 *   mode?: "append"|"replace", subject?: string, trailers?: string[]}} input
 * @param {{exec?: Function, fs?: object, env?: object, homedir?: string}} [deps]
 * @returns {Promise<{tracked: boolean, file: string, commit: string|null}>}
 * @throws INVALID_PATH when `relPath` escapes the root; INVALID_STATE on a dirty integration worktree
 */
export async function writeProjectFile({ project, integration, runId, relPath, text, mode = "append", subject, trailers = [] }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const target = await writeTarget(project, relPath, { integrationRoot: integration.worktree, exec });
  const write = async () => {
    await fs.mkdir(path.dirname(target.abs), { recursive: true });
    if (mode === "append") await fs.appendFile(target.abs, text);
    else await fs.writeFile(target.abs, text);
  };
  if (!target.tracked) { await write(); return { tracked: false, file: target.abs, commit: null }; }
  const root = path.resolve(integration.worktree);
  const g = gitIn(exec, root);
  await prepareIntegration(g, fs, root, integration.branch);
  const before = await fs.readFile(target.abs).then((b) => b, () => null);
  try {
    await write();
    await g(["add", "-f", "--", relPath]);
    if ((await g(["diff", "--cached", "--quiet"], { allowFail: true })).code === 0) return { tracked: true, file: target.abs, commit: null };
    await g(["-c", "commit.gpgsign=false", "commit", "--quiet", "--no-verify", "-m", subject ?? `chore(build): update ${relPath}`, "-m", [...trailers, `Engine-Run: ${runId}`].join("\n")]);
  } catch (error) {
    await g(["reset", "--quiet", "--", relPath], { allowFail: true });
    if (before === null) await fs.rm(target.abs, { force: true }); else await fs.writeFile(target.abs, before);
    throw error;
  }
  return { tracked: true, file: target.abs, commit: out(await g(["rev-parse", "HEAD"])) };
}

// ---------------------------------------------------------------------------------------------
// Chain integration (D22)
// ---------------------------------------------------------------------------------------------

/**
 * Integrate ONE committed unit branch into the integration branch: rebase it onto the integration tip, fast-forward the
 * integration branch, then (build/patch units) move the unit's work orders to IN_REVIEW in one commit. The rebase runs
 * on a detached HEAD in the integration worktree, so it does not matter whether the unit worktree still exists; the unit
 * branch itself is left untouched (source evidence). Idempotent: commits already in the integration branch (matched by
 * patch id) are not replayed, and work orders already IN_REVIEW are not rewritten.
 * A rebase conflict is NEVER resolved: the rebase is aborted, the integration branch is unchanged and the outcome is
 * `conflict` (reason `rebase_conflict`) for the caller to hand back.
 * @param {{unit: object, integration: {branch: string, worktree: string}, runId: string}} input `unit` = a state unit
 *   (`id`, `kind`, `wos`, `branch`; `attempt` derives the branch name when `branch` is null)
 * @param {{exec?: Function, fs?: object, env?: object, clock?: Function, homedir?: string, transitionWorkOrderAt?: Function}} [deps]
 * @returns {Promise<{outcome: "integrated"|"already", unit: string, code_sha: string, sha: string, commits: number, rebased: boolean,
 *     healed: boolean, transitions: object[], track: object, wo_commit: string|null}
 *   | {outcome: "conflict", unit: string, reason: "rebase_conflict", files: string[], tip: string}>}
 *   `code_sha` = integration tip right after the chain, `sha` = tip after the metadata commit
 * @throws INVALID_STATE (unit branch missing or empty, dirty worktree), GIT_FAILED
 */
export async function integrateUnit({ unit, integration, runId }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const root = path.resolve(integration.worktree);
  const g = gitIn(exec, root);
  const branch = integration.branch;
  const unitBranch = unit.branch ?? buildPaths(deps.project ?? root, deps).unitBranch(runId, unit.id, unit.attempt ?? 1);
  const { healed, tip } = await prepareIntegration(g, fs, root, branch);
  if (!(await refExists(g, `refs/heads/${unitBranch}`))) throw err("INVALID_STATE", `unit branch ${unitBranch} of ${unit.id} does not exist`);
  const unitTip = out(await g(["rev-parse", `refs/heads/${unitBranch}`]));
  const base = out(await g(["merge-base", branch, unitBranch]));
  const commits = Number(out(await g(["rev-list", "--count", `${base}..${unitBranch}`])));
  if (commits === 0) throw err("INVALID_STATE", `unit ${unit.id} is committed but its branch ${unitBranch} has no commits beyond the integration branch`);
  const pending = out(await g(["cherry", branch, unitBranch])).split("\n").filter((l) => l.startsWith("+"));

  let rebased = false;
  if (pending.length) {
    await g(["checkout", "--quiet", "--detach", unitTip]);
    if (base !== tip) {
      const res = await exec("git", ["rebase", branch], { cwd: root });
      rebased = true;
      if (res.code !== 0) {
        const files = out(await g(["diff", "--name-only", "--diff-filter=U"], { allowFail: true })).split("\n").filter(Boolean);
        await g(["rebase", "--abort"], { allowFail: true });
        await g(["checkout", "--quiet", branch]);
        if (!files.length) throw err("GIT_FAILED", `rebase of ${unitBranch} failed without conflicts (exit ${res.code}): ${tail(res.stderr || res.stdout)}`);
        return { outcome: "conflict", unit: unit.id, reason: "rebase_conflict", files, tip };
      }
    }
    const rebasedTip = out(await g(["rev-parse", "HEAD"]));
    await g(["checkout", "--quiet", branch]);
    await g(["merge", "--ff-only", "--quiet", rebasedTip]);
  }
  const codeSha = out(await g(["rev-parse", "HEAD"]));

  let wo = { commit: null, steps: [], track: { ok: true, lines: 0 } };
  if (WO_KINDS.has(unit.kind) && unit.wos?.length) {
    wo = await transitionWorkOrders({ integration, runId, wos: unit.wos, to: "IN_REVIEW", unitId: unit.id }, deps);
  }
  return {
    outcome: pending.length ? "integrated" : "already", unit: unit.id, code_sha: codeSha, sha: out(await g(["rev-parse", "HEAD"])),
    commits, rebased, healed, transitions: wo.steps, track: wo.track, wo_commit: wo.commit,
  };
}

/**
 * The state units that integrate now, in integration order: kind in docs/tests/build/patch, state `committed`, dependencies
 * (`depends_on`) among those candidates first (tests units before their build units), otherwise state order.
 * @param {object} state a state.json object
 * @returns {object[]}
 */
export function committedUnits(state) {
  const pool = state.units.filter((u) => u.state === "committed" && INTEGRABLE_KINDS.includes(u.kind));
  const ids = new Set(pool.map((u) => u.id));
  const ordered = [];
  const seen = new Set();
  const visit = (u, trail = new Set()) => {
    if (seen.has(u.id) || trail.has(u.id)) return;
    trail.add(u.id);
    for (const dep of u.depends_on ?? []) if (ids.has(dep)) visit(pool.find((x) => x.id === dep), trail);
    seen.add(u.id);
    ordered.push(u);
  };
  for (const u of pool) visit(u);
  return ordered;
}

/**
 * Integrate every committed chain of a run into `lane/<run_id>/integration` (phase 2 of `next`, CLI doc 4.1), sequentially. A unit that
 * conflicts stays `committed` and is reported in `conflicts` (its dependents are skipped this round); the caller hands it
 * back. Integrated units get state `integrated`, and the state's `last_safe_point` becomes `{sha, kind: "integration-land"}`.
 * Journal events are returned and, when `appendEvent` is given, appended in order as each unit lands:
 * `integrated {unit, sha}`, `unit_state {unit, from: "committed", to: "integrated"}`, `safe_point {sha, kind}`.
 * Unit worktrees of integrated units are removed (their branches are kept) unless `keepWorktrees`.
 * @param {{state: object, runId?: string, appendEvent?: (event: {type: string, data: object}) => Promise<any>, keepWorktrees?: boolean}} input
 *   `state.integration` supplies branch and worktree; the input state is not mutated
 * @param {object} [deps] see `integrateUnit`; `project` (main checkout root) is needed for worktree removal and unit-branch naming
 * @returns {Promise<{state: object, integrated: object[], conflicts: object[], events: {type: string, data: object}[], cleanup: object[]}>}
 */
export async function integrateCommitted({ state, runId = state.run_id, appendEvent, keepWorktrees = false }, deps = {}) {
  const integration = state.integration;
  let next = structuredClone(state);
  const integrated = [];
  const conflicts = [];
  const events = [];
  const cleanup = [];
  const blocked = new Set();
  const emit = async (type, data) => {
    const event = { type, data };
    events.push(event);
    if (appendEvent) await appendEvent(event);
  };
  for (const unit of committedUnits(state)) {
    if ((unit.depends_on ?? []).some((d) => blocked.has(d))) { blocked.add(unit.id); continue; }
    const res = await integrateUnit({ unit, integration, runId }, deps);
    if (res.outcome === "conflict") { conflicts.push(res); blocked.add(unit.id); continue; }
    integrated.push(res);
    await emit("integrated", { unit: unit.id, sha: res.sha });
    await emit("unit_state", { unit: unit.id, from: "committed", to: "integrated" });
    await emit("safe_point", { sha: res.sha, kind: "integration-land" });
    next = {
      ...next,
      last_safe_point: { sha: res.sha, kind: "integration-land", at: nowIso(deps) },
      units: next.units.map((u) => (u.id === unit.id ? { ...u, state: "integrated" } : u)),
    };
    if (!keepWorktrees && unit.worktree && deps.project) {
      try { cleanup.push({ unit: unit.id, ...(await removeWorktree({ project: deps.project, worktree: unit.worktree }, deps)) }); }
      catch (e) { cleanup.push({ unit: unit.id, removed: false, worktree: unit.worktree, error: String(e?.message ?? e) }); }
    }
  }
  return { state: next, integrated, conflicts, events, cleanup };
}

/**
 * FRDs that need a G2 run now (CLI doc 4.1): every work-carrying unit of the FRD (docs/tests/build/patch) is integrated or
 * later, and at least one is exactly `integrated` (not yet under review). Pure.
 * @param {object} state a state.json object
 * @returns {string[]} FRD ids in state order
 */
export function frdsReadyForG2(state) {
  const byFrd = new Map();
  for (const u of state.units) {
    if (!u.frd || !INTEGRABLE_KINDS.includes(u.kind)) continue;
    byFrd.set(u.frd, [...(byFrd.get(u.frd) ?? []), u]);
  }
  return [...byFrd].filter(([, units]) => units.every((u) => INTEGRATED_OR_LATER.has(u.state)) && units.some((u) => u.state === "integrated")).map(([frd]) => frd);
}
