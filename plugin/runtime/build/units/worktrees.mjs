// units/worktrees.mjs: unit worktrees and branches `lane/<run_id>/<unit>[-a<n>]` (create, adopt, restore, fork point).
import * as fsp from "node:fs/promises";
import path from "node:path";
import { buildPaths } from "../paths.mjs";
import { err } from "./common.mjs";
import { readUnitWorkOrders } from "./workOrders.mjs";
import { readJson, atomicWriteJson } from "../fsx.mjs";
import { removeWorktree } from "../integrate/worktrees.mjs";
import { realOrResolved } from "../integrate/git.mjs";
import { git, productPrefix, productRoot, runnerOf } from "./git.mjs";

const BOOTSTRAP_TIMEOUT_MS = 10 * 60 * 1000;

const sameDir = async (fs, a, b) => {
  return (await realOrResolved(fs, a)) === (await realOrResolved(fs, b));
};

/**
 * Branch and worktree of a unit attempt (pure, A13/A16).
 * @returns {{branch: string, worktree: string}}
 */
export function unitRefs({ project, runId, unitId, attempt = 1 }, deps = {}) {
  const p = buildPaths(project, deps);
  return { branch: p.unitBranch(runId, unitId, attempt), worktree: p.unitWorktree(unitId, attempt) };
}

function parseWorktreeList(text) {
  const entries = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), branch: null }; entries.push(cur); } else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7);
  }
  return entries;
}

/**
 * Create (or adopt) the registered git worktree of one unit attempt. Idempotent: an existing registered worktree on
 * the right branch is reused untouched (a `doubt` that was decided resumes in the same attempt and directory).
 * A fresh attempt (n >= 2) always starts a NEW branch `lane/<run>/<unit>-a<n>` from the integration tip; the failed
 * attempt's branch is preserved; its eligible worktree is reclaimed (BUILD-15). Reusing an existing branch is refused when it carries the code
 * of an assumption the owner has not accepted (pending or rejected) other than `base` itself (B6, DEC-7): such work may
 * only continue on its own assume branch, and rejected work only on a fresh attempt.
 * @param {{project: string, runId: string, unit: string, attempt?: number, base?: string}} input
 *   `base` defaults to `paths.integrationBranch(runId)`
 * @param {{exec?: Function, fs?: object, env?: object, bootstrap?: boolean}} [deps] `bootstrap:false` skips the
 *   project's `.pandacorp/worktree-bootstrap.sh`
 * @returns {Promise<{worktree: string, root: string, branch: string, base_sha: string, created: boolean,
 *   bootstrap: {ran: boolean, exit: number|null, tail: string}}>}
 * @throws INVALID_STATE when the path exists but is not the registered worktree of that branch, or the existing branch
 *   carries unaccepted assumption code
 */
export async function prepareUnitWorktree({ project, runId, unit, attempt = 1, base }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const { branch, worktree } = unitRefs({ project, runId, unitId: unit, attempt }, deps);
  const p = buildPaths(project, deps);
  const baseRef = base ?? p.integrationBranch(runId);
  for (let previous = 1; previous < attempt; previous++) await removeWorktree({ project, worktree: p.unitWorktree(unit, previous) }, deps);
  const prefix = await productPrefix(project, deps);
  const root = productRoot(worktree, prefix);
  const listed = parseWorktreeList((await git(deps, project, ["worktree", "list", "--porcelain"])).stdout);
  let known = null;
  for (const entry of listed) if (await sameDir(fs, entry.path, worktree)) known = entry;
  if (known) {
    if (known.branch !== `refs/heads/${branch}`) throw err("INVALID_STATE", `worktree ${worktree} is on ${known.branch}, not ${branch}`);
    await assertNoForeignAssumption({ project, runId, branch, baseRef }, deps);
    const marker = path.join(p.unitDir(unit), `bootstrap-${attempt}.json`);
    const previous = await readJson(marker, { fs }).catch(() => null);
    const bootstrap = previous?.exit === 4 ? await bootstrapWorktree(root, deps) : { ran: false, exit: null, tail: "" };
    if (bootstrap.ran) await atomicWriteJson(marker, bootstrap, { fs });
    return { worktree, root, branch, base_sha: await mergeBase(deps, root, baseRef), created: false, bootstrap };
  }
  const exists = await fs.stat(worktree).then(() => true, () => false);
  if (exists) throw err("INVALID_STATE", `${worktree} exists but is not a registered worktree`);
  await fs.mkdir(path.dirname(worktree), { recursive: true });
  // Register the on-disk spelling of the directory (git keeps the path as given; on a case-insensitive volume or behind a
  // symlink the spelling in `paths` can differ from the one `git worktree list` prints for the main checkout).
  const registered = path.join(await fs.realpath(path.dirname(worktree)), path.basename(worktree));
  const branchExists = (await git(deps, project, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { allowFail: true })).code === 0;
  if (branchExists) await assertNoForeignAssumption({ project, runId, branch, baseRef }, deps);
  if (branchExists) await git(deps, project, ["worktree", "add", registered, branch]);
  else await git(deps, project, ["worktree", "add", "-b", branch, registered, baseRef]);
  const bootstrap = await bootstrapWorktree(root, deps);
  if (bootstrap.ran) await atomicWriteJson(path.join(p.unitDir(unit), `bootstrap-${attempt}.json`), bootstrap, { fs });
  const sparse = bootstrap.exit === 4 ? { enabled: false, reason: "disk" } : await sparseUnitDocs({ project, root, worktree, unit, prefix }, deps);
  return { worktree, root, branch, sparse, base_sha: await mergeBase(deps, root, baseRef), created: true, bootstrap };
}

/**
 * Refuse a unit branch that holds commits of an assumption branch whose doubt is not accepted (B6): for every
 * `lane/<run>/assume-<doubt>` other than `baseRef`, the merge base with the unit branch must already be on `baseRef` or
 * on the integration branch. An accepted assumption (decision = assumed option) is skipped: its branch is merged into the
 * integration branch by the next integration. A branch without a readable doubt record counts as not accepted.
 * @throws INVALID_STATE naming the assumption
 */
async function assertNoForeignAssumption({ project, runId, branch, baseRef }, deps) {
  const p = buildPaths(project, deps);
  const probe = "x";
  const prefix = p.assumeBranch(runId, probe).slice(0, -probe.length);
  const refs = await git(deps, project, ["for-each-ref", "--format=%(refname:short)", `refs/heads/${prefix}*`], { allowFail: true });
  if (refs.code !== 0) return;
  const integration = p.integrationBranch(runId);
  const isAncestor = async (a, b) => (await git(deps, project, ["merge-base", "--is-ancestor", a, b], { allowFail: true })).code === 0;
  for (const assume of String(refs.stdout).split("\n").map((l) => l.trim()).filter((l) => l.startsWith(prefix))) {
    if (assume === baseRef) continue;
    const doubtId = assume.slice(prefix.length);
    if (await assumptionAccepted(project, doubtId, deps)) continue;
    const mb = await git(deps, project, ["merge-base", `refs/heads/${branch}`, `refs/heads/${assume}`], { allowFail: true });
    const fork = String(mb.stdout).trim();
    if (mb.code !== 0 || !fork) continue;
    if (await isAncestor(fork, baseRef) || await isAncestor(fork, integration) || await isAncestor(fork, await defaultBranchOf(project, deps))) continue;
    throw err("INVALID_STATE", `unit branch ${branch} carries commits of ${assume}, an assumption the owner has not accepted: it cannot be reused on ${baseRef}`);
  }
}

/**
 * The default branch name, resolved as `merge-queue.sh` does (`origin/HEAD`, else `main`). After a giant-run tranche
 * landing the fork point of an accepted run lives on it, no longer on the integration branch.
 */
async function defaultBranchOf(project, deps) {
  const res = await git(deps, project, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], { allowFail: true });
  const name = String(res.stdout).trim();
  return res.code === 0 && name ? name.replace(/^origin\//, "") : "main";
}

async function assumptionAccepted(project, doubtId, deps) {
  try {
    const { readDoubt } = await import("../doubts.mjs");
    const record = await readDoubt(project, doubtId, deps);
    return Boolean(record?.assumption) && record.decision?.value !== undefined && JSON.stringify(record.decision.value) === JSON.stringify(record.assumption.option);
  } catch {
    return false;
  }
}

/**
 * Restore the registered worktree of a unit attempt that is requeued at the SAME attempt because its coordinator
 * changed (`start --resume`, drive takeover): the output of the dispatch that lost the run can never be accepted (its
 * token is released and its late report is fenced), so the next dispatch must not inherit it. Discards the commits
 * the unit branch carries since its fork point (an engine commit whose report never reached phase 2) and the
 * worktree's uncommitted changes; ignored files (bootstrap output) stay. A missing or unregistered worktree is left
 * alone (the next dispatch creates it).
 * @param {{project: string, runId: string, unit: {id: string, attempt?: number, worktree?: string|null}, base?: string}} input
 *   `base` defaults to `paths.integrationBranch(runId)` (pass the assume branch for work built on an assumption)
 * @param {object} [deps] `exec`, `fs`, `env`
 * @returns {Promise<{reset: boolean, discarded_commits: number, dirty: boolean, head: string|null}>}
 */
export async function restoreUnitWorktree({ project, runId, unit, base }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const none = { reset: false, discarded_commits: 0, dirty: false, head: null };
  const worktree = unit.worktree ?? unitRefs({ project, runId, unitId: unit.id, attempt: unit.attempt ?? 1 }, deps).worktree;
  const listed = parseWorktreeList((await git(deps, project, ["worktree", "list", "--porcelain"])).stdout);
  let registered = false;
  for (const entry of listed) if (await sameDir(fs, entry.path, worktree)) registered = true;
  if (!registered) {
    const refs = unitRefs({ project, runId, unitId: unit.id, attempt: unit.attempt ?? 1 }, deps);
    if ((await git(deps, project, ["rev-parse", "--verify", "--quiet", `refs/heads/${refs.branch}`], { allowFail: true })).code !== 0) return none;
    await prepareUnitWorktree({ project, runId, unit: unit.id, attempt: unit.attempt ?? 1, base }, { ...deps, bootstrap: false, sparse: false });
  }
  const baseRef = base ?? buildPaths(project, deps).integrationBranch(runId);
  const head = (await git(deps, worktree, ["rev-parse", "HEAD"])).stdout.trim();
  const fork = (await git(deps, worktree, ["merge-base", "HEAD", baseRef])).stdout.trim();
  const ahead = Number((await git(deps, worktree, ["rev-list", "--count", `${fork}..HEAD`])).stdout.trim()) || 0;
  const dirty = (await git(deps, worktree, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout.trim() !== "";
  if (!ahead && !dirty) return { ...none, head };
  await git(deps, worktree, ["reset", "--quiet", "--hard", ahead ? fork : "HEAD"]);
  if (dirty) await git(deps, worktree, ["clean", "-f", "-d", "--quiet"]);
  return { reset: true, discarded_commits: ahead, dirty, head };
}

async function mergeBase(deps, root, baseRef) {
  const res = await git(deps, root, ["merge-base", "HEAD", baseRef]);
  return res.stdout.trim();
}

async function bootstrapWorktree(root, deps) {
  const none = { ran: false, exit: null, tail: "" };
  if (deps.bootstrap === false) return none;
  const script = path.join(root, ".pandacorp", "worktree-bootstrap.sh");
  if (!(await (deps.fs ?? fsp).stat(script).then(() => true, () => false))) return none;
  const res = await runnerOf(deps)("bash", [".pandacorp/worktree-bootstrap.sh"], { cwd: root, env: deps.env, timeout: BOOTSTRAP_TIMEOUT_MS });
  return { ran: true, exit: res.code, tail: `${res.stdout}\n${res.stderr}`.trim().split("\n").slice(-10).join("\n") };
}

/**
 * Fork point of a unit worktree: the merge base of HEAD and the integration branch.
 * @param {string} root product root inside the unit worktree
 * @param {string} integrationBranch `state.integration.branch` (from `paths.integrationBranch`)
 */
export const unitBase = (root, integrationBranch, deps = {}) => mergeBase(deps, root, integrationBranch);

/**
 * DEC-17: limit only docs/ in build/patch/tests checkouts. All source directories remain materialized.
 * Cone mode selects directories (design/product therefore retain their root files). A failed context or light
 * verification restores a full checkout; sparse configuration is always per worktree.
 */
export async function sparseUnitDocs({ project, root, worktree, unit, prefix = "" }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const state = await readJson(buildPaths(project, deps).stateFile, { fs }).catch(() => null);
  const record = typeof unit === "object" ? unit : state?.units?.find(u => u.id === unit);
  if (!record || !["build", "patch", "tests"].includes(record.kind) || deps.sparse === false) return { enabled: false };
  try {
    const orders = await readUnitWorkOrders(root, record.wos ?? [], deps);
    const docs = prefix ? `${prefix}/docs` : "docs";
    const tracked = (await git(deps, worktree, ["ls-tree", "-r", "--name-only", "HEAD"])).stdout.split("\n").filter(Boolean);
    const frds = [...new Set(orders.map(w => path.posix.dirname(path.posix.dirname(w.file))))];
    const context = [...orders.map(w => w.file), ...frds.flatMap(dir => ["frd.md", "fdd.md", "blueprint.md"].map(f => `${dir}/${f}`)), "docs/rules/README.md", "docs/design/design-tokens.json", "docs/product/architecture.md", "DESIGN.md"];
    const expected = context.filter(rel => tracked.includes(prefix ? `${prefix}/${rel}` : rel));
    for (const rel of expected) await fs.access(path.join(root, rel));
    const verify = path.join(root, ".pandacorp/verify.sh");
    await fs.access(verify);
    const directories = new Set();
    for (const file of tracked) {
      if (file.startsWith(`${docs}/`)) continue;
      const parts = file.split("/");
      if (parts.length < 2) continue;
      if (prefix && file.startsWith(`${prefix}/`)) {
        const tail = file.slice(prefix.length + 1).split("/");
        if (tail.length > 1) directories.add(`${prefix}/${tail[0]}`);
      } else directories.add(parts[0]);
    }
    for (const dir of [...frds, "docs/rules", "docs/design", "docs/product"]) directories.add(prefix ? `${prefix}/${dir}` : dir);
    await git(deps, worktree, ["config", "extensions.worktreeConfig", "true"]);
    await git(deps, worktree, ["sparse-checkout", "set", "--cone", "--", ...directories]);
    for (const rel of expected) await fs.access(path.join(root, rel));
    const light = await runnerOf(deps)("bash", [".pandacorp/verify.sh", "--light"], { cwd: root, env: deps.env, timeout: BOOTSTRAP_TIMEOUT_MS });
    if (light.code !== 0) throw new Error(`verify.sh --light exited ${light.code}`);
    return { enabled: true };
  } catch (error) {
    // Fail loudly if even restoring the full tree fails: never dispatch a partial checkout.
    await git(deps, worktree, ["sparse-checkout", "disable"]);
    return { enabled: false, reason: String(error.message ?? error) };
  }
}

/**
 * Create (or adopt) the unit worktree of one attempt: {@link prepareUnitWorktree} with the unit given as an object.
 * @param {{project: string, runId: string, unit: string|{id: string, attempt?: number}, attempt?: number, base?: string}} input
 * @param {object} [deps] see {@link prepareUnitWorktree}
 * @returns {Promise<{worktree: string, root: string, branch: string, base_sha: string, created: boolean, bootstrap: object}>}
 */
export function createUnitWorktree({ project, runId, unit, attempt, base }, deps = {}) {
  const id = typeof unit === "string" ? unit : unit.id;
  return prepareUnitWorktree({ project, runId, unit: id, attempt: attempt ?? (typeof unit === "string" ? 1 : unit.attempt ?? 1), base }, deps);
}
