/**
 * Pandacorp build engine v2: `land`, integration branch to `main` (D1, D2, D24, PLAN 3.16 A1, A3, A15, BUILD-13).
 *
 * `land` is the ONLY path to `main`. It never writes a tracked file in the main checkout: every tracked write is a
 * commit on the integration branch inside the integration worktree, and `main` moves only through the project's own
 * `.pandacorp/merge-queue.sh`, run from that worktree as a detached `land` job (no host H slot in the wrapper: the
 * script takes its own around `verify.sh`, A1).
 *
 * Two phases across calls (D5, D6): the first call rebases the integration branch onto `main` outside the mutex, writes the
 * landing metadata commit in phase 2 and spawns the job (`result: "running"`); later calls (and `next`, through
 * `harvestLand`) poll the job and map the merge-queue exit code (D24).
 *
 * The engine NEVER sets `PANDACORP_OWNER_RELEASE_OK`. A launched project's production gate is merge-queue exit 21
 * (`waiting_gate`); only the owner's chat order lands it, by running `land` with that variable set on that one
 * command. The variable is passed through to the job exactly as the calling environment carries it, except for the
 * `drive` actor, which never carries an owner order.
 *
 * Every dependency is injected (`deps`, always the last argument): `fs`, `env`, `exec`, `jobs`, `clock`, `buildState`,
 * `isAlive`. Test hooks only; defaults are the real thing.
 */
import * as fsp from "node:fs/promises";
import path from "node:path";
import { SLUG_RE, archiveCard } from "./card.mjs";
import { defaultExec, isTrackedPath, nowIso, sha256Hex } from "./fsx.mjs";
import { resolveInside } from "./paths.mjs";
import { REVIEW_TYPE_KINDS, ZONES, fencedTwoPhase, findUnit, newUnit, upsertJob } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Environment variable that authorizes landing a launched project's `main` (BUILD-13). Read only, never assigned. */
const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";
/** Merge-queue script, resolved inside the integration worktree (never the main checkout's copy). */
const MERGE_QUEUE = ".pandacorp/merge-queue.sh";
/** Kinds whose work orders move to VERIFIED with the landing. */
const WO_KINDS = Object.freeze(["build", "patch"]);
/** States in which a code unit is complete and waits for the landing. */
const READY_STATES = Object.freeze(["verified", "waiting_gate"]);
const OUTPUT_TAIL_BYTES = 4000;

/**
 * Merge-queue exit code to landing outcome (D24, PLAN A15). Pure.
 * `exit` is the `land` process exit code (0 OK, 6 hand-back, 7 waiting gate).
 * @param {number} code merge-queue exit code
 * @returns {{result: string, reason: string|null, exit: number}|null} null for an unmapped code (engine failure)
 */
export function mapMergeQueueExit(code) {
  switch (code) {
    case 0: return { result: "landed", reason: null, exit: 0 };
    case 10: return { result: "handback", reason: "rebase_conflict", exit: 6 };
    case 11: return { result: "handback", reason: "g3_red", exit: 6 };
    case 12: return { result: "nothing_to_land", reason: "busy_main", exit: 0 };
    case 13: return { result: "landed", reason: null, exit: 0 };
    case 14: return { result: "nothing_to_land", reason: "port_busy", exit: 0 };
    case 20: return { result: "nothing_to_land", reason: "mq_precondition", exit: 0 };
    case 21: return { result: "waiting_gate", reason: null, exit: 7 };
    default: return null;
  }
}

/**
 * Which units this landing carries and whether the batch is complete (D2: all non-parked units of the run, or of the
 * tranche for a giant run). Pure. Review-type and consult units are ignored; `blocked` and `parked` units do not
 * block a landing (they cannot land); a giant run lets queued units of later tranches wait.
 * @param {object} state a valid state.json
 * @returns {{complete: boolean, landable: object[], blockers: string[]}}
 */
export function assessBatch(state) {
  const giant = state.size === "giant";
  const landable = [];
  const blockers = [];
  for (const unit of state.units) {
    if (REVIEW_TYPE_KINDS.includes(unit.kind) || unit.state === "landed" || unit.state === "blocked" || unit.state === "parked") continue;
    if (READY_STATES.includes(unit.state)) { landable.push(unit); continue; }
    if (unit.state === "integrated" && (unit.kind === "docs" || unit.kind === "tests")) { landable.push(unit); continue; }
    if (unit.state === "queued" && giant) continue;
    blockers.push(unit.id);
  }
  return { complete: blockers.length === 0, landable, blockers };
}

/**
 * Does this landing complete the card (so the metadata commit carries `Change: <slug>`)? Pure.
 * True only for a run with a card whose every non-landing unit is already `landed` (review-type units are ignored).
 * @param {object} state a valid state.json
 * @param {object[]} landable the units this landing carries
 * @returns {string|null} the card slug, or null
 */
export function cardCompletedBy(state, landable) {
  const slug = state.scope?.card ?? null;
  if (!slug || !SLUG_RE.test(slug)) return null;
  if (state.tranche && state.tranche.index < state.tranche.of) return null;
  const carried = new Set(landable.map((u) => u.id));
  const open = state.units.some((u) => !carried.has(u.id) && !REVIEW_TYPE_KINDS.includes(u.kind) && u.state !== "landed");
  return open ? null : slug;
}

/**
 * Set top-level scalar keys in a plain `status.yaml` text (one `key: value` line each, replaced in place or appended).
 * Strings are JSON-quoted, booleans and numbers bare, `phase` bare. Pure.
 * @param {string} text status.yaml content
 * @param {Record<string, string|number|boolean>} updates fixed engine keys only
 */
export function setStatusScalars(text, updates) {
  let body = text;
  for (const [key, raw] of Object.entries(updates)) {
    const value = typeof raw === "boolean" || typeof raw === "number" || key === "phase" ? String(raw) : JSON.stringify(raw);
    const line = `${key}: ${value}`;
    const re = new RegExp(`^${key}:.*$`, "m");
    body = re.test(body) ? body.replace(re, line) : `${body.replace(/\s*$/, "")}\n${line}\n`;
  }
  return body;
}

// ---------------------------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------------------------

function resolveLandDeps(deps = {}) {
  return {
    ...deps,
    fs: deps.fs ?? fsp,
    env: deps.env ?? process.env,
    exec: deps.exec ?? defaultExec,
    isAlive: deps.isAlive ?? ((pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } }),
  };
}

const markerLine = (runId) => `Landing-Metadata: ${runId}`;
const result = (exit, output) => ({ exit, output: { ok: true, cmd: "land", reason: null, mq_exit: null, sha: null, ...output } });
const nothing = (reason) => result(0, { result: "nothing_to_land", reason });
const handbackResult = (reason, extra = {}) => result(6, { result: "handback", reason, ...extra });

async function git(d, cwd, args) {
  return d.exec("git", args, { cwd });
}

async function gitOk(d, cwd, args, what) {
  const res = await git(d, cwd, args);
  if (res.code !== 0) throw err("ENGINE_FAILURE", `git ${what ?? args[0]} failed (exit ${res.code}) in ${cwd}: ${res.stderr.trim().slice(0, 300)}`);
  return res.stdout.trim();
}

/** The default branch name, resolved exactly as `merge-queue.sh` does (`origin/HEAD`, else `main`). */
async function defaultBranchOf(d, root) {
  const res = await git(d, root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const name = res.code === 0 ? res.stdout.trim().replace(/^origin\//, "") : "";
  return name || "main";
}

const tipMessage = async (d, root, rev = "HEAD") => (await gitOk(d, root, ["log", "-1", "--format=%B", rev], "log")).split(/\r?\n/);

/** Is the branch tip this run's own landing metadata commit? */
async function tipIsLandingMetadata(d, root, runId) {
  return (await tipMessage(d, root)).includes(markerLine(runId));
}

/** Drop the run's landing metadata commit when it is the tip (a retry or a G3 red rewrites it). `reset --keep` refuses to lose local changes. */
async function dropLandingMetadata(d, root, runId) {
  if (!(await tipIsLandingMetadata(d, root, runId))) return false;
  await gitOk(d, root, ["reset", "--keep", "HEAD~1"], "reset");
  return true;
}

async function assertCleanWorktree(d, root) {
  const dirty = await gitOk(d, root, ["status", "--porcelain"], "status");
  if (dirty) throw err("INVALID_STATE", `integration worktree has uncommitted changes (never land WIP): ${dirty.split("\n")[0]}`);
}

async function pollLandJob(ctx, job, d) {
  const jobs = d.jobs ?? (await import("./jobs.mjs"));
  const polled = await jobs.pollJob(ctx.project, job, d);
  return { state: polled.state, exit: polled.exit ?? null };
}

const maxZone = (units) => ZONES[Math.max(0, ...units.map((u) => ZONES.indexOf(u.zone)))];

// ---------------------------------------------------------------------------------------------
// Harvest: map a finished land job (by `land` or by `next`)
// ---------------------------------------------------------------------------------------------

/** Move units to a state, journaling each transition; returns the new state (pure on `state`). */
async function moveUnits(ctx, state, units, to, patch = {}) {
  let next = state;
  for (const unit of units) {
    const current = findUnit(next, unit.id);
    if (current.state !== to) await ctx.appendEvent({ type: "unit_state", data: { unit: unit.id, from: current.state, to } });
    if ("waiting_gate" in patch && current.waiting_gate !== patch.waiting_gate) {
      await ctx.appendEvent({ type: "waiting_gate", data: { unit: unit.id, kind: patch.waiting_gate } });
    }
    next = { ...next, units: next.units.map((u) => (u.id === unit.id ? { ...u, state: to, ...patch } : u)) };
  }
  return next;
}

/** After merge-queue success: where did the landing commit end up, and which card does it complete? */
async function locateLanding(ctx, root, defaultBranch, d) {
  const mainTip = await gitOk(d, root, ["rev-parse", `refs/heads/${defaultBranch}`], "rev-parse");
  const found = (await gitOk(d, root, ["log", "-n", "1", "--format=%H", "-F", "--grep", markerLine(ctx.runId), defaultBranch], "log")).trim();
  if (!found) return { mainTip, metaSha: null, changeSlug: null, lastGreen: null };
  const lines = await tipMessage(d, root, found);
  const changeSlug = lines.map((l) => l.match(/^Change:\s*(\S+)\s*$/)?.[1]).find(Boolean) ?? null;
  const status = await git(d, root, ["show", `${found}:./.pandacorp/status.yaml`]);
  const lastGreen = status.code === 0 ? status.stdout.match(/^last_green_sha:\s*["']?([0-9a-f]{7,40})/m)?.[1] ?? null : null;
  return { mainTip, metaSha: found, changeSlug, lastGreen };
}

async function archiveLandedCard(project, slug, sha, d) {
  const cardDeps = { fs: d.fs, env: d.env, isTracked: (abs) => isTrackedPath(project, path.relative(project, abs), { exec: d.exec }) };
  try {
    const res = await archiveCard(project, { slug, sha }, cardDeps);
    return { slug, action: res.action, note: res.note };
  } catch (error) {
    // The landing already happened: an archive failure is reported in the journal, never turned into a failed landing (A3).
    return { slug, action: "failed", note: String(error.message ?? error).slice(0, 300) };
  }
}

async function onLanded(ctx, state, job, mqExit, d) {
  const root = state.integration.worktree;
  const defaultBranch = await defaultBranchOf(d, root);
  const branch = ctx.paths.integrationBranch(ctx.runId);
  const contained = await git(d, root, ["merge-base", "--is-ancestor", branch, defaultBranch]);
  if (contained.code !== 0) {
    throw err("ENGINE_FAILURE", `merge-queue exit ${mqExit} but ${defaultBranch} does not contain ${branch}: landing not verified`);
  }
  const where = await locateLanding(ctx, root, defaultBranch, d);
  const sha = where.metaSha ?? where.mainTip;
  const batch = assessBatch(state);
  let next = await moveUnits(ctx, state, batch.landable, "landed", { waiting_gate: null });
  const card = where.changeSlug && where.changeSlug === state.scope?.card ? await archiveLandedCard(ctx.project, where.changeSlug, sha, d) : null;
  const notes = mqExit === 13 ? "El aterrizaje llegó a main pero el push falló (origin): producción NO se actualizó. Arregla el remoto y vuelve a hacer push de main." : null;
  await ctx.appendEvent({ type: "batch_landed", data: { sha, units: batch.landable.map((u) => u.id), mq_exit: mqExit, card, ...(notes ? { notes_es: notes } : {}) } });
  await ctx.appendEvent({ type: "safe_point", data: { kind: "batch-landed", sha } });
  next = { ...next, last_safe_point: { sha, kind: "batch-landed", at: nowIso(d) } };
  if (where.lastGreen) {
    const pinned = await git(d, root, ["merge-base", "--is-ancestor", where.lastGreen, defaultBranch]);
    if (pinned.code !== 0) await ctx.appendEvent({ type: "pin_stale", data: { last_green_sha: where.lastGreen, main: where.mainTip } });
  }
  return { state: next, output: { result: "landed", reason: null, mq_exit: mqExit, sha, ...(notes ? { notes_es: notes } : {}) }, exit: 0 };
}

async function onGateRed(ctx, state, job, d) {
  const root = state.integration.worktree;
  await assertCleanWorktree(d, root);
  await dropLandingMetadata(d, root, ctx.runId);
  const fixed = assessBatch(state).landable.filter((u) => WO_KINDS.includes(u.kind));
  const frds = [...new Set(fixed.map((u) => u.frd).filter(Boolean))];
  const single = frds.length === 1 && fixed.every((u) => u.frd === frds[0]);
  const id = single ? `u-patch-${frds[0]}` : "u-patch-g3";
  const attempt = Math.max(1, ...fixed.map((u) => u.attempt), findUnit(state, id)?.attempt ?? 1) + 1;
  const log = path.relative(ctx.project, ctx.paths.jobOutFile(job.id));
  if (attempt > 3) {
    await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", patch: "budget_exhausted", log } });
    // The finished job must be on disk before failure.handBack re-reads the state (BUILD-15, R4: units and dependents go `blocked`).
    await ctx.writeState(state);
    const failure = d.failure ?? (await import("./failure.mjs"));
    const outLog = await d.fs.readFile(ctx.paths.jobOutFile(job.id), "utf8").catch(() => "");
    const tail = outLog.split("\n").slice(-40).join("\n");
    for (const unit of fixed) {
      await failure.handBack(ctx, {
        unitId: unit.id, cause: "code", reasonCode: "budget_exhausted", reason: "G3 rojo con el presupuesto de 3 ejecuciones agotado",
        failure: { command: "bash .pandacorp/merge-queue.sh", tail },
      }, d);
    }
    return { state: await ctx.readState(), output: { result: "handback", reason: "g3_red", mq_exit: 11, sha: null, patch_unit: null }, exit: 6 };
  }
  const patch = newUnit({
    id, kind: "patch", wos: [...new Set(fixed.flatMap((u) => u.wos))], frd: single ? frds[0] : null,
    zone: maxZone(fixed.length ? fixed : [{ zone: "none" }]), risk_rules: [...new Set(fixed.flatMap((u) => u.risk_rules))], attempt,
  });
  await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", log } });
  await ctx.appendEvent({ type: "unit_queued", data: patch });
  await ctx.appendEvent({ type: "patch", data: { unit: id, reason: "g3_red", fixes: fixed.map((u) => u.id), attempt, log } });
  const others = state.units.filter((u) => u.id !== id);
  let next = { ...state, units: [...others, patch] };
  next = await moveUnits(ctx, next, fixed.filter((u) => u.id !== id), "patching");
  return { state: next, output: { result: "handback", reason: "g3_red", mq_exit: 11, sha: null, patch_unit: id }, exit: 6 };
}

async function onGate(ctx, state) {
  const batch = assessBatch(state);
  const next = await moveUnits(ctx, state, batch.landable, "waiting_gate", { waiting_gate: "production" });
  return { state: next, output: { result: "waiting_gate", reason: null, mq_exit: 21, sha: null, notes_es: "main de este proyecto lanzado es producción. Solo se aterriza con tu orden en el chat: PANDACORP_OWNER_RELEASE_OK=1 sobre ese único comando land." }, exit: 7 };
}

/**
 * Harvest a finished land job under the lease mutex. Called by `land` (phase 1) and by `next`; `ctx` is the
 * mutex-holding context of `fencedTwoPhase`. Records `job_finished`, applies the D24 exit map, archives the card
 * (A3, idempotent) and writes `state.json`. A still-running job (or none) harvests nothing.
 * @param {object} ctx mutex-holding two-phase context
 * @param {object} [deps] see module header
 * @returns {Promise<{harvested: false}|{harvested: true, output: object, exit: number}>}
 * @throws ENGINE_FAILURE for an unmapped merge-queue exit, a second consecutive exit 20 (A15) or an unverifiable landing
 */
export async function harvestLandJob(ctx, deps = {}) {
  const d = resolveLandDeps(deps);
  let state = await ctx.readState();
  if (!state) return { harvested: false };
  const job = state.jobs.find((j) => j.kind === "land" && j.state === "running");
  if (!job) return { harvested: false };
  const polled = await pollLandJob(ctx, job, d);
  if (polled.state === "running") return { harvested: false };
  const root = state.integration.worktree;

  let mqExit = polled.state === "done" ? polled.exit : null;
  if (polled.state === "dead") {
    // The job vanished without an exit file: it is a success only when `main` really contains the branch.
    const branch = ctx.paths.integrationBranch(ctx.runId);
    const contained = await git(d, root, ["merge-base", "--is-ancestor", branch, await defaultBranchOf(d, root)]);
    mqExit = contained.code === 0 ? 0 : null;
  }
  const previous = state.jobs.filter((j) => j.kind === "land" && j.id !== job.id && j.state === "done").at(-1);
  const finished = { ...job, state: polled.state === "dead" && mqExit === null ? "dead" : "done", exit: mqExit };
  await ctx.appendEvent({ type: "job_finished", data: { id: job.id, kind: "land", state: finished.state, exit: mqExit } });
  state = upsertJob(state, finished);

  if (mqExit === null && polled.state === "dead") {
    await ctx.writeState(state);
    return { harvested: true, exit: 0, output: { ok: true, cmd: "land", result: "nothing_to_land", reason: "land_job_dead", mq_exit: null, sha: null } };
  }
  const mapped = mapMergeQueueExit(mqExit);
  if (!mapped) {
    await ctx.writeState(state);
    throw err("ENGINE_FAILURE", `merge-queue exited ${mqExit}, which the landing map does not know (see ${path.relative(ctx.project, ctx.paths.jobOutFile(job.id))})`);
  }
  if (mqExit === 20 && previous?.exit === 20) {
    await ctx.writeState(state);
    throw err("ENGINE_FAILURE", "merge-queue precondition failed twice in a row (exit 20): see its output in the land job log");
  }

  let applied;
  try {
    if (mapped.result === "landed") applied = await onLanded(ctx, state, job, mqExit, d);
    else if (mqExit === 11) applied = await onGateRed(ctx, state, job, d);
    else if (mqExit === 21) applied = await onGate(ctx, state);
    else {
      if (mqExit === 10) await ctx.appendEvent({ type: "handback", data: { reason: "rebase_conflict", cause: "landing" } });
      applied = { state, exit: mapped.exit, output: { result: mapped.result, reason: mapped.reason, mq_exit: mqExit, sha: null } };
    }
  } catch (error) {
    // job_finished is already journaled: persist the finished job so the next harvest does not journal it twice.
    await ctx.writeState(state);
    throw error;
  }
  await ctx.writeState(applied.state);
  return { harvested: true, exit: applied.exit, output: { ok: true, cmd: "land", ...applied.output } };
}

// ---------------------------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------------------------

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
  const transition = d.buildState?.transitionWorkOrderAt ?? (await import("../build-state.mjs")).transitionWorkOrderAt;
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
  const jobs = d.jobs ?? (await import("./jobs.mjs"));
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
