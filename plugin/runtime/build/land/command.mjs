// The `land` command (two phases across calls, D5/D6) and the stand-alone harvest used by `next`.
import path from "node:path";
import { nowIso, sha256Hex } from "../fsx.mjs";
import { resolveInside } from "../paths.mjs";
import { fencedTwoPhase, upsertJob } from "../state.mjs";
import { assessBatch, cardCompletedBy, setStatusScalars } from "./batch.mjs";
import { harvestLandJob } from "./harvest.mjs";
import {
  MERGE_QUEUE, OUTPUT_TAIL_BYTES, RELEASE_VAR, WO_KINDS, assertCleanWorktree, defaultBranchOf, dropLandingMetadata, err, git, gitOk,
  handbackResult, markerLine, nothing, resolveLandDeps, result,
} from "./common.mjs";

async function phase1(ctx, d) {
  const harvest = await harvestLandJob(ctx, d);
  if (harvest.harvested) return { done: { exit: harvest.exit, output: harvest.output } };
  const state = await ctx.readState();
  if (!state) throw err("INVALID_STATE", "no build/state.json: there is no run to land");
  if (state.jobs.some((j) => j.kind === "land" && j.state === "running")) return { done: result(0, { result: "running" }) };
  if (!["active", "waiting_gate"].includes(state.status)) throw err("INVALID_STATE", `cannot land a run in status ${state.status}`);
  const batch = assessBatch(state);
  if (!batch.complete) return { done: nothing("batch_incomplete") };
  if (!batch.landable.length) return { done: nothing("no_verified_work") };
  const root = state.integration.worktree;
  const script = await d.fs.stat(path.join(root, MERGE_QUEUE)).catch(() => null);
  if (!script?.isFile()) throw err("INVALID_STATE", `the project has no ${MERGE_QUEUE} in the integration worktree (run /pandacorp:upgrade)`);
  const branch = ctx.paths.integrationBranch(ctx.runId);
  const current = await gitOk(d, root, ["rev-parse", "--abbrev-ref", "HEAD"], "rev-parse");
  if (current !== branch) throw err("INVALID_STATE", `integration worktree is on ${current}, expected ${branch}`);
  return { root, branch };
}

async function rebaseOntoMain(intent, ctx, d) {
  const { root } = intent;
  await assertCleanWorktree(d, root);
  await dropLandingMetadata(d, root, ctx.runId);
  const defaultBranch = await defaultBranchOf(d, root);
  const rebased = await git(d, root, ["rebase", defaultBranch]);
  if (rebased.code !== 0) {
    await git(d, root, ["rebase", "--abort"]);
    return { conflict: (rebased.stderr || rebased.stdout).trim().slice(-OUTPUT_TAIL_BYTES) };
  }
  return { tip: await gitOk(d, root, ["rev-parse", "HEAD"], "rev-parse"), defaultBranch };
}

async function staleOracles(state, root, d) {
  const hashed = new Map();
  for (const unit of state.units) {
    for (const [file, hash] of [...Object.entries(unit.test_hashes), ...Object.entries(unit.probe_hashes)]) hashed.set(file, hash);
  }
  const changed = [];
  for (const [file, hash] of hashed) {
    const bytes = await d.fs.readFile(resolveInside(root, file)).catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
    if (bytes === null || sha256Hex(bytes) !== hash) changed.push(file);
  }
  return changed;
}

async function indexWorkOrders(root, d) {
  const index = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  const scalar = (block, key) => block.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "") ?? null;
  const frds = await d.fs.readdir(frdsDir, { withFileTypes: true }).catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e)));
  for (const frd of frds.filter((e) => e.isDirectory())) {
    const dir = path.join(frdsDir, frd.name, "work-orders");
    const names = await d.fs.readdir(dir).catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e)));
    for (const name of names.filter((n) => /^wo-.*\.md$/.test(n))) {
      const block = (await d.fs.readFile(path.join(dir, name), "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
      if (block) index.set((scalar(block, "id") ?? name.slice(0, -3)).toLowerCase(), { file: `docs/frds/${frd.name}/work-orders/${name}`, status: scalar(block, "implementation_status") });
    }
  }
  return index;
}

/** Write the landing metadata into the integration worktree (WO VERIFIED, status pin) and commit it. Returns the commit sha. */
async function writeLandingCommit({ root, runId, landable, slug, tip }, d) {
  const index = await indexWorkOrders(root, d);
  const transition = d.buildState?.transitionWorkOrderAt ?? (await import("../../build-state.mjs")).transitionWorkOrderAt;
  const wos = [...new Set(landable.filter((u) => WO_KINDS.includes(u.kind)).flatMap((u) => u.wos))];
  let verified = 0;
  for (const id of wos) {
    const wo = index.get(id.toLowerCase());
    if (!wo) throw err("INVALID_STATE", `work order ${id} is not in the integration worktree`);
    if (wo.status === "VERIFIED") continue;
    if (wo.status !== "IN_REVIEW") throw err("INVALID_STATE", `work order ${id} is ${wo.status}, expected IN_REVIEW before landing`);
    await transition(root, { file: wo.file, to: "VERIFIED", reason: "landing" });
    verified += 1;
  }
  const statusFile = path.join(root, ".pandacorp", "status.yaml");
  const statusText = await d.fs.readFile(statusFile, "utf8");
  const updates = { last_green_sha: tip, safe_to_test: true };
  if (/^phase:\s*["']?architecture["']?\s*(#.*)?$/m.test(statusText)) updates.phase = "implementation";
  await d.fs.writeFile(statusFile, setStatusScalars(statusText, updates));
  const trailers = [markerLine(runId), ...(slug ? [`Change: ${slug}`] : [])].join("\n");
  await gitOk(d, root, ["add", "-u", "--", "."], "add");
  await gitOk(d, root, ["commit", "--allow-empty", "--no-verify", "-m", `chore(build): landing metadata for run ${runId}`,
    "-m", `Marks ${verified} work order(s) VERIFIED and pins last_green_sha to the code tip below this commit.`, "-m", trailers], "commit");
  return gitOk(d, root, ["rev-parse", "HEAD"], "rev-parse");
}

function landJobEnv(env, actor) {
  const jobEnv = { ...env };
  if (actor === "drive") delete jobEnv[RELEASE_VAR];
  return jobEnv;
}

async function spawnLandJob(ctx, state, root, d) {
  const jobs = d.jobs ?? (await import("../jobs.mjs"));
  const seq = state.jobs.filter((j) => j.kind === "land").length + 1;
  const spec = { project: ctx.project, kind: "land", cmd: ["bash", MERGE_QUEUE], cwd: root, jobId: `land-${ctx.epoch}-${seq}` };
  const rec = await jobs.spawnJob(spec, { ...d, env: landJobEnv(d.env, ctx.actor) });
  return {
    id: rec?.id ?? spec.jobId, kind: "land", unit: null, frd: null, pid: rec?.pid ?? null, cwd: rec?.cwd ?? root, h_slot: false,
    started_at: rec?.started_at ?? nowIso(d), state: "running", exit: null, worker_id: null,
  };
}

async function phase2(work, intent, ctx, d) {
  if (work.conflict !== undefined) {
    await ctx.appendEvent({ type: "handback", data: { reason: "rebase_conflict", cause: "landing", detail: work.conflict } });
    return handbackResult("rebase_conflict");
  }
  const state = await ctx.readState();
  const root = state.integration.worktree;
  const batch = assessBatch(state);
  if (!batch.complete) return nothing("batch_incomplete");
  if (!batch.landable.length) return nothing("no_verified_work");
  const head = await gitOk(d, root, ["rev-parse", "HEAD"], "rev-parse");
  if (head !== work.tip) throw err("INVALID_STATE", "the integration tip moved during the landing; run land again");
  const stale = await staleOracles(state, root, d);
  if (stale.length) {
    await ctx.appendEvent({ type: "handback", data: { reason: "oracle_changed", cause: "landing", paths: stale } });
    return handbackResult("oracle_changed", { paths: stale });
  }
  const slug = cardCompletedBy(state, batch.landable);
  try {
    await writeLandingCommit({ root, runId: ctx.runId, landable: batch.landable, slug, tip: work.tip }, d);
  } catch (error) {
    // The worktree was verified clean at the start of this command: any dirt is this commit's own, so it is safe to discard.
    await git(d, root, ["reset", "--hard", "HEAD"]);
    throw error;
  }
  const job = await spawnLandJob(ctx, state, root, d);
  await ctx.appendEvent({ type: "job_started", data: job });
  await ctx.writeState(upsertJob(state, job));
  return result(0, { result: "running" });
}

/**
 * The `land` command (fenced). Moves the integration branch to `main` through merge-queue and nothing else.
 * First call: rebase, landing metadata commit, spawn the `land` job, `result: "running"`. Later calls: `running`
 * while the job lives, else harvest it (D24 exit map). Never sets `PANDACORP_OWNER_RELEASE_OK`.
 * @param {{project: string, epoch: number, actor?: "cli"|"drive"}} input
 * @param {{fs?: object, env?: object, exec?: Function, jobs?: {spawnJob: Function, pollJob?: Function}, clock?: Function, buildState?: object, isAlive?: Function}} [deps]
 * @returns {Promise<{exit: number, output: object}>} `output` is the one-line JSON
 *   `{ok, cmd:"land", result: landed|waiting_gate|handback|nothing_to_land|running, reason, mq_exit, sha, ...}`;
 *   `exit` is 0, 6 (handback) or 7 (waiting_gate)
 * @throws FENCE (3), INVALID_STATE (5) or ENGINE_FAILURE (8), see the CLI doc
 */
export async function land({ project, epoch, actor = "cli" }, deps = {}) {
  const d = resolveLandDeps(deps);
  return fencedTwoPhase({ project, epoch, actor, deps: d },
    (ctx) => phase1(ctx, d),
    async (intent, ctx) => (intent.done ? intent.done : rebaseOntoMain(intent, ctx, d)),
    async (work, intent, ctx) => (intent.done ? work : phase2(work, intent, ctx, d)));
}

/**
 * Harvest a finished land job on its own (fenced). `next` calls this at its harvest step when it is not already
 * holding the mutex; it returns `{harvested:false}` while the job still runs or when there is none.
 * @param {{project: string, epoch: number, actor?: "cli"|"drive"}} input
 * @param {object} [deps] see `land`
 * @returns {Promise<{harvested: false}|{harvested: true, exit: number, output: object}>}
 */
export async function harvestLand({ project, epoch, actor = "cli" }, deps = {}) {
  const d = resolveLandDeps(deps);
  return fencedTwoPhase({ project, epoch, actor, deps: d }, (ctx) => harvestLandJob(ctx, d));
}
