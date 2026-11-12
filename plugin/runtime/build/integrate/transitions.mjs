// Every tracked write of the engine that lands on the integration branch (D1): work-order transitions, track lines
// and tracked project files, each one commit made in the integration worktree.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { defaultExec, nowIso, writeTarget } from "../fsx.mjs";
import { err } from "./common.mjs";
import { gitIn, out } from "./git.mjs";
import { indexWorkOrders, workOrderRoute } from "./workOrders.mjs";

/** Track line each reached status produces (shapes read by Mission Control, CLI doc section 10). */
const TRACK_FOR = Object.freeze({
  IN_PROGRESS: { kind: "wo_start" },
  IN_REVIEW: { kind: "wo_end", state: "in_review" },
  VERIFIED: { kind: "wo_end", state: "verified" },
  BLOCKED: { kind: "wo_end", state: "failed" },
});
const GOVERNED_STATUS_YAML = ".pandacorp/status.yaml";
const TRACK_FILE = ".pandacorp/track.jsonl";

/**
 * Make sure the integration worktree is on its branch with no tracked changes; an interrupted detached rebase of an
 * earlier call is aborted and the branch re-checked-out first. Untracked files are ignored.
 * @returns {Promise<{healed: boolean, tip: string}>}
 * @throws INVALID_STATE when another branch is checked out or tracked files are dirty
 */
export async function prepareIntegration(g, fs, root, branch) {
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
  const transition = deps.transitionWorkOrderAt ?? (await import("../../build-state.mjs")).transitionWorkOrderAt;
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
