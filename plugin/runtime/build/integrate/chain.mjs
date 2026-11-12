// Chain integration (D22): one committed unit branch onto the integration tip, the integration order, FRD readiness for G2.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { defaultExec } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { INTEGRABLE_KINDS, INTEGRATED_OR_LATER, WO_KINDS, err, escapeRegExp, isAssumed, tail } from "./common.mjs";
import { gitIn, out, refExists } from "./git.mjs";
import { prepareIntegration, transitionWorkOrders } from "./transitions.mjs";

/**
 * Integrate ONE committed unit branch into the integration branch: rebase it onto the integration tip, fast-forward the
 * integration branch, then (build/patch units) move the unit's work orders to IN_REVIEW in one commit. The rebase runs
 * on a detached HEAD in the integration worktree, so it does not matter whether the unit worktree still exists; the unit
 * branch itself is left untouched (source evidence). Idempotent: commits already in the integration branch (matched by
 * patch id) are not replayed, and work orders already IN_REVIEW are not rewritten.
 * A rebase conflict is NEVER resolved: the rebase is aborted, the integration branch is unchanged and the outcome is
 * `conflict` (reason `rebase_conflict`) for the caller to hand back.
 * @param {{unit: object, integration: {branch: string, worktree: string}, runId: string, workOrders?: boolean}} input `unit` = a state unit
 *   (`id`, `kind`, `wos`, `branch`; `attempt` derives the branch name when `branch` is null); `workOrders:false` integrates
 *   the code only (an assume branch: its WOs move to IN_REVIEW on the integration branch once the owner accepts)
 * @param {{exec?: Function, fs?: object, env?: object, clock?: Function, homedir?: string, transitionWorkOrderAt?: Function}} [deps]
 * @returns {Promise<{outcome: "integrated"|"already", unit: string, code_sha: string, sha: string, commits: number, rebased: boolean,
 *     healed: boolean, transitions: object[], track: object, wo_commit: string|null}
 *   | {outcome: "conflict", unit: string, reason: "rebase_conflict", files: string[], tip: string}>}
 *   `code_sha` = integration tip right after the chain, `sha` = tip after the metadata commit
 * @throws INVALID_STATE (unit branch missing or empty, dirty worktree), GIT_FAILED
 */
export async function integrateUnit({ unit, integration, runId, workOrders = true }, deps = {}) {
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
  // A resumed call after a no-op rebase + ff: the unit branch is already an ancestor and its tip is the unit commit.
  const alreadyIn = commits === 0
    && (await exec("git", ["merge-base", "--is-ancestor", unitTip, branch], { cwd: root })).code === 0
    && new RegExp(`^Unit: ${escapeRegExp(unit.id)}$`, "m").test(out(await g(["log", "-1", "--format=%B", unitTip])));
  if (commits === 0 && !alreadyIn) throw err("INVALID_STATE", `unit ${unit.id} is committed but its branch ${unitBranch} has no commits beyond the integration branch`);
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
  if (workOrders && WO_KINDS.has(unit.kind) && unit.wos?.length) {
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
 * FRDs that need a G2 run now (CLI doc 4.1): every work-carrying unit of the FRD (docs/tests/build/patch) is integrated or
 * later, and at least one is exactly `integrated` (not yet under review). An FRD with a unit still built on an unaccepted
 * assumption is skipped: that code is not on the integration branch yet (its G2 runs after the owner accepts). Pure.
 * @param {object} state a state.json object
 * @returns {string[]} FRD ids in state order
 */
export function frdsReadyForG2(state) {
  const byFrd = new Map();
  for (const u of state.units) {
    if (!u.frd || !INTEGRABLE_KINDS.includes(u.kind)) continue;
    byFrd.set(u.frd, [...(byFrd.get(u.frd) ?? []), u]);
  }
  return [...byFrd]
    .filter(([, units]) => units.every((u) => INTEGRATED_OR_LATER.has(u.state) && !isAssumed(u)) && units.some((u) => u.state === "integrated"))
    .map(([frd]) => frd);
}
