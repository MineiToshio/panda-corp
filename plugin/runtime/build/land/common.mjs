// Shared plumbing of the landing modules: constants, result shapes, the injected-dependency defaults and the git helpers.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultExec } from "../fsx.mjs";
import { ZONES } from "../state.mjs";

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Environment variable that authorizes landing a launched project's `main` (BUILD-13). Read only, never assigned. */
export const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";
/** Merge-queue script, resolved inside the integration worktree (never the main checkout's copy). */
export const MERGE_QUEUE = ".pandacorp/merge-queue.sh";
/** Kinds whose work orders move to VERIFIED with the landing. */
export const WO_KINDS = Object.freeze(["build", "patch"]);
/** Bytes of a failed git output kept in a hand-back detail. */
export const OUTPUT_TAIL_BYTES = 4000;

export function resolveLandDeps(deps = {}) {
  return {
    ...deps,
    fs: deps.fs ?? fsp,
    env: deps.env ?? process.env,
    exec: deps.exec ?? defaultExec,
    isAlive: deps.isAlive ?? ((pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } }),
  };
}

export const markerLine = (runId) => `Landing-Metadata: ${runId}`;
export const result = (exit, output) => ({ exit, output: { ok: true, cmd: "land", reason: null, mq_exit: null, sha: null, ...output } });
export const nothing = (reason) => result(0, { result: "nothing_to_land", reason });
export const handbackResult = (reason, extra = {}) => result(6, { result: "handback", reason, ...extra });

export async function git(d, cwd, args) {
  return d.exec("git", args, { cwd });
}

export async function gitOk(d, cwd, args, what) {
  const res = await git(d, cwd, args);
  if (res.code !== 0) throw err("ENGINE_FAILURE", `git ${what ?? args[0]} failed (exit ${res.code}) in ${cwd}: ${res.stderr.trim().slice(0, 300)}`);
  return res.stdout.trim();
}

/** The default branch name, resolved exactly as `merge-queue.sh` does (`origin/HEAD`, else `main`). */
export async function defaultBranchOf(d, root) {
  const res = await git(d, root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const name = res.code === 0 ? res.stdout.trim().replace(/^origin\//, "") : "";
  return name || "main";
}

export const tipMessage = async (d, root, rev = "HEAD") => (await gitOk(d, root, ["log", "-1", "--format=%B", rev], "log")).split(/\r?\n/);

/** Is the branch tip this run's own landing metadata commit? */
export async function tipIsLandingMetadata(d, root, runId) {
  return (await tipMessage(d, root)).includes(markerLine(runId));
}

/** Drop the run's landing metadata commit when it is the tip (a retry or a G3 red rewrites it). `reset --keep` refuses to lose local changes. */
export async function dropLandingMetadata(d, root, runId) {
  if (!(await tipIsLandingMetadata(d, root, runId))) return false;
  await gitOk(d, root, ["reset", "--keep", "HEAD~1"], "reset");
  return true;
}

export async function assertCleanWorktree(d, root) {
  const dirty = await gitOk(d, root, ["status", "--porcelain"], "status");
  if (dirty) throw err("INVALID_STATE", `integration worktree has uncommitted changes (never land WIP): ${dirty.split("\n")[0]}`);
}

export async function pollLandJob(ctx, job, d) {
  const jobs = d.jobs ?? (await import("../jobs.mjs"));
  const polled = await jobs.pollJob(ctx.project, job, d);
  return { state: polled.state, exit: polled.exit ?? null };
}

export const maxZone = (units) => ZONES[Math.max(0, ...units.map((u) => ZONES.indexOf(u.zone)))];

/** Budget identity ignores the per-attempt landing metadata commit. */
export async function landingCodeTip(d, root, runId) {
  return gitOk(d, root, ["rev-parse", "--verify", (await tipIsLandingMetadata(d, root, runId)) ? "HEAD~1^{commit}" : "HEAD^{commit}"], "landing-code-tip");
}

/** Shared queue-metrics R observation, emitted on accepted implementation, never certification. */
export async function emitQueueReady(ctx, d, unit = null) {
  const directory = path.join(ctx.project, ".pandacorp/run");
  const row = { v: 1, event: "ready", attempt: randomUUID(), ts: new Date().toISOString(), project: ctx.project, branch: ctx.paths.integrationBranch(ctx.runId), run_id: ctx.runId, ...(unit ? { unit } : {}) };
  try {
    await d.fs.mkdir(directory, { recursive: true });
    await d.fs.appendFile(path.join(directory, "queue-log.jsonl"), JSON.stringify(row) + "\n");
  } catch (error) { console.error(`build: WARNING ready event not written: ${error.message}`); }
}
