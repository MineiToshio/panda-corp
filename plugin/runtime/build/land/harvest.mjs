// Harvest of a finished `land` job: the D24 exit map applied to the state (landed, g3 red patch, production gate).
import path from "node:path";
import { cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { archiveCard } from "../card.mjs";
import { isTrackedPath, nowIso, sha256Hex } from "../fsx.mjs";
import { readGatePatch, writeGateFailure } from "../gatefail.mjs";
import { readJournal } from "../journal.mjs";
import { isAllowedPath } from "../units/allowlist.mjs";
import { findUnit, newUnit, upsertJob } from "../state.mjs";
import { assessBatch, mapMergeQueueExit } from "./batch.mjs";
import {
  assertCleanWorktree, defaultBranchOf, dropLandingMetadata, err, git, gitOk, markerLine, maxZone, pollLandJob, resolveLandDeps, tipMessage,
} from "./common.mjs";

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

/** BL-0316: retries of a docs-only G3 red on the same integration tip before the landing is handed back as env-infra. */
export const DOCS_ONLY_G3_RETRIES = 1;

/**
 * A batch made only of docs units cannot make code checks red: a red G3 whose evidence names no docs-surface path and
 * no doc-lint failure comes from main itself or the machine (a timeout under swap, a flaky test). Pure.
 */
export function docsOnlyRedNotFromBatch(candidates, evidence) {
  if (!candidates.length || !candidates.every((u) => u.kind === "docs")) return false;
  if ((evidence?.checks ?? []).includes("doc-lint")) return false;
  return !(evidence?.paths ?? []).some((p) => isAllowedPath("docs", [], p));
}

async function onDocsOnlyRed(ctx, state, candidates, plan, log, tip, d) {
  const { events } = await readJournal(ctx.paths.journalFile, d);
  const earlier = events.filter((e) => e.type === "handback" && e.data?.reason === "g3_red" && e.data?.docs_only === true && e.data?.tip === tip).length;
  const checks = (plan.evidence.checks ?? []).join(", ") || "sin checks reconocidos";
  if (earlier < DOCS_ONLY_G3_RETRIES) {
    await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", docs_only: true, tip, retry: earlier + 1, checks: plan.evidence.checks ?? [], log } });
    const notes = `G3 rojo en un lote solo de documentos (${checks}): el fallo no viene del lote; se reintenta la puerta una vez sin abrir un parche.`;
    return { state, output: { result: "nothing_to_land", reason: "g3_red_docs_only_retry", mq_exit: 11, sha: null, patch_unit: null, notes_es: notes }, exit: 0 };
  }
  await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", docs_only: true, tip, retry: earlier + 1, checks: plan.evidence.checks ?? [], log, handed_back: candidates.map((u) => u.id) } });
  // The finished job must be on disk before failure.handBack re-reads the state.
  await ctx.writeState(state);
  const failure = d.failure ?? (await import("../failure.mjs"));
  for (const unit of candidates) {
    await failure.handBack(ctx, {
      unitId: unit.id, cause: "env-infra", reasonCode: "g3_red_not_from_batch",
      reason: `G3 rojo dos veces sobre un lote solo de documentos (${checks}); el fallo no viene del lote: revisa main y la máquina, luego reanuda con unblock`,
      failure: { command: "bash .pandacorp/merge-queue.sh", tail: plan.evidence.tail },
    }, d);
  }
  return { state: await ctx.readState(), output: { result: "handback", reason: "g3_red_not_from_batch", mq_exit: 11, sha: null, patch_unit: null }, exit: 6 };
}

async function onGateRed(ctx, state, job, plan, d) {
  const root = state.integration.worktree;
  await assertCleanWorktree(d, root);
  const candidates = assessBatch(state).landable;
  if (docsOnlyRedNotFromBatch(candidates, plan.evidence)) {
    // The tip AFTER dropping the run's own landing metadata commit (rewritten on every landing attempt).
    await dropLandingMetadata(d, root, ctx.runId);
    const tip = await gitOk(d, root, ["rev-parse", "HEAD"], "rev-parse");
    return onDocsOnlyRed(ctx, state, candidates, plan, path.relative(ctx.project, ctx.paths.jobOutFile(job.id)), tip, d);
  }
  await dropLandingMetadata(d, root, ctx.runId);
  const { id, attempt, fixed } = plan;
  const log = path.relative(ctx.project, ctx.paths.jobOutFile(job.id));
  await writeGateFailure(ctx.paths, plan, d);
  if (attempt > 3) {
    await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", patch: "budget_exhausted", log } });
    // The finished job must be on disk before failure.handBack re-reads the state (BUILD-15, R4: units and dependents go `blocked`).
    await ctx.writeState(state);
    const failure = d.failure ?? (await import("../failure.mjs"));
    const tail = plan.evidence.tail;
    const exhausted = plan.evidence.attributed ? fixed : [findUnit(state, id)].filter(Boolean);
    for (const unit of exhausted) {
      await failure.handBack(ctx, {
        unitId: unit.id, cause: "code", reasonCode: "budget_exhausted", reason: "G3 rojo con el presupuesto de 3 ejecuciones agotado",
        failure: { command: "bash .pandacorp/merge-queue.sh", tail },
      }, d);
    }
    return { state: await ctx.readState(), output: { result: "handback", reason: "g3_red", mq_exit: 11, sha: null, patch_unit: null }, exit: 6 };
  }
  const patch = newUnit({
    id, kind: "patch", wos: plan.wos, frd: plan.frd,
    zone: maxZone((fixed.length ? fixed : candidates).concat({ zone: "none" })), risk_rules: [...new Set((fixed.length ? fixed : candidates).flatMap((u) => u.risk_rules))], attempt,
  });
  await ctx.appendEvent({ type: "handback", data: { reason: "g3_red", cause: "landing", log } });
  await ctx.appendEvent({ type: "unit_queued", data: patch });
  await ctx.appendEvent({ type: "patch", data: { unit: id, reason: "g3_red", fixes: fixed.map((u) => u.id), wos: plan.evidence.wos, attempt, log } });
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

/** Identity of the facts used by a work-phase harvest; any concurrent change invalidates that plan. */
const harvestFingerprint = (state) => sha256Hex(JSON.stringify({ integration: state.integration, units: state.units, jobs: state.jobs }));

/** Read G3 evidence and canonical WO artifacts outside the lease mutex, pinned to one immutable commit. */
export async function prepareLandHarvest(ctx, deps = {}) {
  const d = resolveLandDeps(deps);
  const state = await ctx.readState();
  const job = state?.jobs.find((j) => j.kind === "land" && j.state === "running");
  if (!job) return null;
  const polled = await pollLandJob(ctx, job, d);
  const prepared = { job, polled, fingerprint: harvestFingerprint(state), tip: null, plan: null };
  if (polled.state === "done" && polled.exit === 11) {
    prepared.tip = await gitOk(d, state.integration.worktree, ["rev-parse", "HEAD"], "rev-parse");
    prepared.plan = await readGatePatch({ state, units: assessBatch(state).landable, gate: "G3", job, paths: ctx.paths }, { ...d, ref: prepared.tip });
  }
  return prepared;
}

/**
 * Harvest a finished land job under the lease mutex. Called by `land` and by `next` (phase 2); `ctx` is the
 * mutex-holding context of `fencedTwoPhase`; `deps.landHarvest` was prepared in its work phase. Records `job_finished`, applies the D24 exit map, archives the card
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
  const prepared = d.landHarvest;
  if (!prepared || prepared.job.id !== job.id || prepared.fingerprint !== harvestFingerprint(state)) return { harvested: false };
  const { polled } = prepared;
  if (polled.state === "running") return { harvested: false };
  const root = state.integration.worktree;
  // Refuse stale evidence before recording job_finished, resetting metadata or writing any evidence.
  if (polled.state === "done" && polled.exit === 11) {
    if (!prepared.plan || await gitOk(d, root, ["rev-parse", "HEAD"], "rev-parse") !== prepared.tip) {
      throw err("INVALID_STATE", "the integration tip moved during G3 attribution; run land again");
    }
  }

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
    else if (mqExit === 11) applied = await onGateRed(ctx, state, job, prepared.plan, d);
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
  if (applied.output.result === "landed" || applied.output.result === "waiting_gate") {
    await cleanupRunWorktrees({ project: ctx.project, state: applied.state, mode: applied.output.result === "landed" ? "landed" : "waiting_gate" }, d);
  }
  return { harvested: true, exit: applied.exit, output: { ok: true, cmd: "land", ...applied.output } };
}
