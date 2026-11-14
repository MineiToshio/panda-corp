// Assumption branches (BUILD-12, D19): work built on an unaccepted assumption lives on lane/<run_id>/assume-<doubt>.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { defaultExec } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { INTEGRATED_OR_LATER, WO_KINDS, err } from "./common.mjs";
import { findRegistered, gitIn, out, refExists } from "./git.mjs";
import { prepareIntegration, transitionWorkOrders } from "./transitions.mjs";

/**
 * The assumption branches of a run that exist as refs, with their doubt record (read from `build/doubts/<doubt>.json`).
 * Names come only from `paths.assumeBranch`. `accepted` = the owner's decision equals the assumed option.
 * @param {{project: string, runId: string, root: string}} input `root` = any checkout of the repository (refs are shared)
 * @param {{exec?: Function, fs?: object, env?: object, homedir?: string}} [deps]
 * @returns {Promise<{doubt: string, branch: string, record: object|null, accepted: boolean}[]>}
 */
export async function assumptionBranches({ project, runId, root }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const p = buildPaths(project, deps);
  const probe = "x";
  const prefix = p.assumeBranch(runId, probe).slice(0, -probe.length);
  const g = gitIn(exec, root);
  const names = out(await g(["for-each-ref", "--format=%(refname:short)", `refs/heads/${prefix}*`])).split("\n").filter(Boolean).sort();
  const items = [];
  for (const branch of names) {
    const doubt = branch.slice(prefix.length);
    let canonical = null;
    try { canonical = p.assumeBranch(runId, doubt); } catch { canonical = null; }
    if (canonical !== branch) continue;
    let record = null;
    try { record = JSON.parse(await fs.readFile(p.doubtFile(doubt), "utf8")); } catch (e) { if (e.code !== "ENOENT") throw err("INVALID_STATE", `doubt record ${doubt} is unreadable: ${e.message}`); }
    const decided = record?.decision && Object.hasOwn(record.decision, "value") ? record.decision.value : undefined;
    const autonomous = record?.assumption?.reversible === true && record.assumption.accepted === true
      && Boolean(record.assumption.rationale?.trim()) && Boolean(record.assumption.revert?.trim()) && record.decision?.decided_by === "engine";
    const accepted = Boolean(record?.assumption) && decided !== undefined && JSON.stringify(decided) === JSON.stringify(record.assumption.option)
      && (record.decision?.decided_by !== "engine" || autonomous);
    items.push({ doubt, branch, record, accepted });
  }
  return items;
}

/**
 * The worktree of an assumption branch (`paths.assumeWorktree(doubt)`), created on demand on the EXISTING branch
 * (`git worktree add <wt> <branch>`, never `-b`). Idempotent; a detached HEAD left by an interrupted rebase is accepted
 * (the integration step heals it).
 * @param {{project: string, runId: string, doubt: string}} input
 * @returns {Promise<{branch: string, worktree: string, created: boolean}>}
 * @throws INVALID_STATE when the branch is missing, `paths.assumeWorktree` does not exist, or the path holds something else
 */
export async function assumeIntegration({ project, runId, doubt }, deps = {}) {
  const { exec = defaultExec, fs = fsp } = deps;
  const p = buildPaths(project, deps);
  if (typeof p.assumeWorktree !== "function") throw err("INVALID_STATE", "paths.assumeWorktree is missing: cannot place the assumption worktree");
  const branch = p.assumeBranch(runId, doubt);
  const worktree = p.assumeWorktree(doubt);
  const g = gitIn(exec, p.project);
  if (!(await refExists(g, `refs/heads/${branch}`))) throw err("INVALID_STATE", `assumption branch ${branch} does not exist`);
  const existing = await findRegistered(g, fs, worktree);
  if (existing) {
    if (existing.branch !== branch && !existing.detached) throw err("INVALID_STATE", `assumption worktree ${worktree} is on ${existing.branch}, expected ${branch}`);
    return { branch, worktree, created: false };
  }
  await g(["worktree", "prune"]);
  if (await fs.stat(worktree).then(() => true, () => false)) throw err("INVALID_STATE", `${worktree} exists but is not a registered worktree; refusing to touch it`);
  await fs.mkdir(path.dirname(worktree), { recursive: true });
  await g(["worktree", "add", worktree, branch]);
  return { branch, worktree, created: true };
}

/**
 * Merge every ACCEPTED assumption branch that is not yet an ancestor of the integration branch (`git merge --no-ff`,
 * trailer `Doubt:`), then move the work orders of the units built there to IN_REVIEW on the integration branch. A
 * discarded branch (decision != assumed option) is never merged and never deleted. A conflict aborts the merge.
 * @returns {Promise<{merged: object[], conflicts: object[]}>}
 */
export async function mergeAcceptedAssumptions({ state, runId, integration, emit }, deps) {
  const { exec = defaultExec, fs = fsp } = deps;
  const root = path.resolve(integration.worktree);
  const g = gitIn(exec, root);
  const merged = [];
  const conflicts = [];
  for (const item of await assumptionBranches({ project: deps.project, runId, root }, deps)) {
    if (!item.accepted) continue;
    if ((await exec("git", ["merge-base", "--is-ancestor", item.branch, integration.branch], { cwd: root })).code === 0) continue;
    await prepareIntegration(g, fs, root, integration.branch);
    const bodies = out(await g(["log", "--format=%B%x00", `${integration.branch}..${item.branch}`]));
    const unitIds = [...new Set([...bodies.matchAll(/^Unit: (\S+)\s*$/gm)].map((m) => m[1]))];
    const res = await exec("git", ["-c", "commit.gpgsign=false", "merge", "--no-ff", "--no-verify", "--quiet",
      "-m", `chore(build): accept assumption ${item.doubt}`, "-m", `Doubt: ${item.doubt}\nEngine-Run: ${runId}`, item.branch], { cwd: root });
    if (res.code !== 0) {
      const files = out(await g(["diff", "--name-only", "--diff-filter=U"], { allowFail: true })).split("\n").filter(Boolean);
      await g(["merge", "--abort"], { allowFail: true });
      conflicts.push({ outcome: "conflict", doubt: item.doubt, unit: item.record?.unit ?? null, reason: "rebase_conflict", files, branch: item.branch });
      continue;
    }
    const mergeSha = out(await g(["rev-parse", "HEAD"]));
    const transitions = [];
    for (const id of unitIds) {
      const u = state.units.find((x) => x.id === id);
      if (!u || !WO_KINDS.has(u.kind) || !u.wos?.length || !INTEGRATED_OR_LATER.has(u.state)) continue;
      transitions.push(...(await transitionWorkOrders({ integration, runId, wos: u.wos, to: "IN_REVIEW", unitId: u.id }, deps)).steps);
    }
    const sha = out(await g(["rev-parse", "HEAD"]));
    merged.push({ doubt: item.doubt, branch: item.branch, merge_sha: mergeSha, sha, units: unitIds, transitions });
    await emit("integrated", { unit: null, doubt: item.doubt, sha });
    await emit("safe_point", { sha, kind: "integration-land" });
  }
  return { merged, conflicts };
}
