// Hand-back I/O (BUILD-15): `handback/<unit>.md`, the pending decisions entry, WO `BLOCKED` plus one commit on the
// integration branch, state and journal. ../failure.mjs is the public entry.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { atomicWriteText, defaultExec, nowIso } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, findUnit } from "../state.mjs";
import { WO_UNIT_KINDS, emitSafely, err, oneLine, woKey } from "./common.mjs";
import { commitPlan, envInfraStop, planHandback } from "./policy.mjs";
import { writeInbox } from "../doubts/integrationLog.mjs";
import { handbackDecisionEntry, handbackMarkdown, handbackNotice } from "./handbackText.mjs";

async function findWorkOrderFiles(root, ids, { fs = fsp } = {}) {
  const wanted = new Set(ids.map(woKey));
  const found = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const frd of frds.sort()) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names = [];
    try { names = await fs.readdir(dir); } catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const head = (await fs.readFile(path.join(dir, name), "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (head.match(/^id:[ \t]*(.*?)[ \t]*$/m)?.[1]?.replace(/^["']|["']$/g, "") || name.replace(/\.md$/, "")).toLowerCase();
      if (wanted.has(id)) found.set(id, path.posix.join("docs", "frds", frd, "work-orders", name));
    }
  }
  return found;
}


async function branchTips(project, runId, unit, deps) {
  const paths = buildPaths(project, deps);
  const exec = deps.exec ?? defaultExec;
  const out = [];
  for (let attempt = 1; attempt <= unit.attempt; attempt += 1) {
    const branch = paths.unitBranch(runId, unit.id, attempt);
    const res = await exec("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: project });
    if (res.code === 0) out.push(`rama ${branch} @ ${res.stdout.trim().slice(0, 12)}`);
  }
  return out;
}

async function journalTimeline(project, unitId, deps) {
  const paths = buildPaths(project, deps);
  try {
    const raw = await (deps.fs ?? fsp).readFile(paths.journalFile, "utf8");
    const lines = [];
    for (const line of raw.split("\n").filter(Boolean)) {
      const ev = JSON.parse(line);
      if (ev.data?.unit !== unitId) continue;
      if (ev.type === "unit_dispatched") lines.push(`ejecución ${lines.length + 1}: ${ev.data.cell?.model ?? "?"} ${ev.data.cell?.effort ?? "sin esfuerzo"} (${ev.data.via ?? "?"})`);
      else if (ev.type === "report_received" && lines.length) lines[lines.length - 1] += `; resultado: ${ev.data.outcome ?? "sin dato"}`;
    }
    return lines;
  } catch (error) {
    return [`cronología del journal no disponible: ${oneLine(error.message, 120)}`];
  }
}

async function commitIntegration(root, files, message, deps) {
  const exec = deps.exec ?? defaultExec;
  if (!files.length) return null;
  // `files` comes from `git status`, which lists an ignored path only when it is already tracked (a force-tracked decisions
  // inbox): plain `git add` refuses those (code-conventions, verified trap), so force the add of exactly these paths.
  const add = await exec("git", ["add", "-f", "--", ...files], { cwd: root });
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${oneLine(add.stderr, 200)}`);
  const commit = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", message, "--", ...files], { cwd: root });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${oneLine(commit.stderr || commit.stdout, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  return head.stdout.trim();
}

/** Prefix of `root` inside its git repository ("" at the top, else `dir/`): porcelain output is repository-top relative. */
async function repoPrefix(root, deps) {
  const res = await (deps.exec ?? defaultExec)("git", ["rev-parse", "--show-prefix"], { cwd: root });
  if (res.code !== 0) throw err("FAILCLOSED", `git rev-parse --show-prefix failed in the integration worktree: ${oneLine(res.stderr, 200)}`);
  const prefix = res.stdout.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return prefix ? `${prefix}/` : "";
}

/** Tracked files the hand-back touched, relative to `root` (the product root, which is below the repository top for a nested project). */
async function changedTrackedFiles(root, deps) {
  const exec = deps.exec ?? defaultExec;
  const prefix = await repoPrefix(root, deps);
  const res = await exec("git", ["status", "--porcelain=v1", "-z", "--", "docs/frds", ".pandacorp/status.yaml", ".pandacorp/inbox/decisions.md"], { cwd: root });
  if (res.code !== 0) throw err("FAILCLOSED", `git status failed in the integration worktree: ${oneLine(res.stderr, 200)}`);
  return res.stdout.split("\0").filter((entry) => entry.length > 3).map((entry) => entry.slice(3)).filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length));
}

/**
 * Hand a unit back to the owner, under a phase-2 ctx (the `handback` command, or `report`/`review` when the policy says
 * so). Writes `handback/<unit>.md`, the pending decisions entry, WO `BLOCKED` + one commit on the integration branch,
 * then state and journal. Idempotent: a unit that is already `blocked` returns its existing path and writes nothing.
 * @param {{readState: Function, writeState: Function, appendEvent: Function, paths: object, project: string, runId: string}} ctx
 * @param {{unitId: string, cause?: string, reasonCode?: string, reason: string, failure?: {command?: string, tail?: string}, attempts?: string[], diagnosis?: object|null}} input
 * @param {object} [deps] fs, exec, buildState, emit, clock/env
 * @returns {Promise<{path: string, already: boolean, blocked: object[], wos_blocked: string[], wos_skipped: string[], commit: string|null, stop_run: boolean, notice_es: string}>}
 * @throws INVALID_INPUT for a doubt-consult unit (exit 6); INVALID_STATE for an unknown unit
 */
export async function handBack(ctx, input, deps = {}) {
  const { project, paths } = ctx;
  const state = await ctx.readState();
  const unit = findUnit(state, input.unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${input.unitId}`);
  const handbackPath = paths.handbackFile(unit.id);
  if (unit.state === "blocked") return { path: handbackPath, already: true, blocked: [], wos_blocked: [], wos_skipped: [], commit: null, stop_run: envInfraStop(state), notice_es: "" };

  const cause = input.cause ?? "owner";
  const reasonCode = input.reasonCode ?? "manual";
  const plan = planHandback({ state, unitId: unit.id, cause, reasonCode, reason: input.reason, path: handbackPath });
  const bs = deps.buildState ?? await import("../../build-state.mjs");
  const integrationRoot = path.resolve(project, state.integration.worktree);
  const date = nowIso(deps).slice(0, 10);

  // 1. WO BLOCKED in the integration worktree (a dependent's reason names the unit that blocked it).
  const targets = plan.blocked.map((t) => findUnit(state, t.unit));
  const wosOf = (u) => (WO_UNIT_KINDS.includes(u.kind) ? u.wos : []);
  const files = await (deps.findWorkOrderFiles ?? findWorkOrderFiles)(integrationRoot, targets.flatMap(wosOf), { fs: deps.fs ?? fsp });
  const wosBlocked = [];
  const wosSkipped = [];
  for (const target of targets) {
    for (const wo of wosOf(target)) {
      const file = files.get(woKey(wo));
      const reason = target.id === unit.id ? `needs-owner: ${cause}: ${oneLine(input.reason, 140)}` : `blocked-by: ${unit.id}`;
      if (!file) { wosSkipped.push(`${wo}: sin fichero de work order`); continue; }
      try {
        await bs.transitionWorkOrderAt(integrationRoot, { file, to: "BLOCKED", reason });
        wosBlocked.push(wo);
      } catch (error) {
        if (error.code !== "INVALID_STATE") throw error;
        wosSkipped.push(`${wo}: ${oneLine(error.message, 100)}`);
      }
    }
  }

  // 2. The owner's inbox entry and the hand-back file.
  const wos = wosOf(unit);
  const info = {
    unit: unit.id, wos, cause, reasonCode, reason: input.reason, attempt: unit.attempt, date, path: handbackPath, failure: input.failure ?? null, diagnosis: input.diagnosis ?? null,
    attempts: input.attempts ?? await journalTimeline(project, unit.id, deps), preserved: await branchTips(project, ctx.runId, unit, deps),
    blockedUnits: plan.blocked.map((t) => t.unit), skippedWos: wosSkipped,
  };
  const inbox = await writeInbox(project, integrationRoot, handbackDecisionEntry(info), deps);
  await atomicWriteText(handbackPath, handbackMarkdown(info), { fs: deps.fs ?? fsp });

  // 3. One commit on the integration branch with every tracked file touched (WOs, rollups, a tracked decisions inbox).
  const trailers = [`Unit: ${unit.id}`, ...wosBlocked.map((wo) => `WO: ${wo}`)].join("\n");
  const commit = await commitIntegration(integrationRoot, await changedTrackedFiles(integrationRoot, deps), `chore(build): hand back ${unit.id} (${cause})\n\n${trailers}\n`, deps);

  // 4. State and journal (the caller's phase 2 holds the lease mutex).
  await commitPlan(ctx, plan);
  const settledConsults = plan.blocked.filter((b) => b.role === "consult").map((b) => findUnit(state, b.unit));
  for (const c of settledConsults) { try { releaseToken(c.id, { file: paths.admissionFile }); } catch { /* no reservation left */ } }
  const consultWorkers = settledConsults.filter((c) => c.worker?.worker_id && (c.state === "admitted" || c.state === "running")).map((c) => c.worker.worker_id);
  if (consultWorkers.length) {
    const { stopWorkers } = await import("../workers.mjs");
    stopWorkers(project, consultWorkers, deps);
  }
  const emitted = await emitSafely(deps, "unit.parked", { unit: unit.id, reason: "handback", cause, wos });
  return { path: handbackPath, already: false, blocked: plan.blocked, wos_blocked: wosBlocked, wos_skipped: wosSkipped, commit, inbox: inbox.rel, stop_run: plan.stop_run, notice_es: handbackNotice(info), ...(emitted ? { warnings: [emitted] } : {}) };
}

/**
 * The `handback` command: `handback --epoch E --unit U --reason "<text>"` (fenced, phase 2 does the work).
 * @param {{project: string, epoch: number, unit: string, reason: string, cause?: string}} input `cause` defaults to `owner`
 * @param {object} [deps] see handBack; plus `buildState` for the fence
 * @returns {Promise<{ok: true, cmd: "handback", path: string, blocked: string[], stop_run: boolean, notice_es: string}>}
 * @throws USAGE (exit 2) without unit/reason; INVALID_INPUT (exit 6) on a doubt-consult unit; FENCE (exit 3)
 */
export async function handbackCommand({ project, epoch, unit, reason, cause = "owner" }, deps = {}) {
  if (!unit) throw err("USAGE", "handback needs --unit");
  if (!String(reason ?? "").trim()) throw err("USAGE", "handback needs --reason");
  return fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
    const res = await handBack(ctx, { unitId: unit, cause, reasonCode: "manual", reason }, deps);
    return { ok: true, cmd: "handback", path: res.path, blocked: res.blocked.map((b) => b.unit), stop_run: res.stop_run, notice_es: res.notice_es, ...(res.warnings ? { warnings: res.warnings } : {}) };
  });
}
