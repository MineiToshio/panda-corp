// Re-admission of a unit handed back for an environment failure (BL-0312): `unblock --epoch E --unit U --reason TEXT`
// and `start --resume --unblock U --reason TEXT`. ../failure.mjs is the public entry.
//
// A hand-back with cause `env-infra` (the sandbox could not reach a service, a tool was missing, a disk filled up) says
// nothing about the unit's own work. Once the coordinator has fixed the environment, the unit and the dependents that
// hand-back blocked return to `queued` at the SAME attempt: no execution of the 3-per-WO budget is spent, the preserved
// worktree (its uncommitted work included) is reused untouched by prepareUnitWorktree, and the previous report is kept
// as `report-a<n>-blocked.json` and named in the next brief. Any other cause stays a decision of the owner.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { atomicWriteJson, atomicWriteText, defaultExec, nowIso, writeTarget, assertNotTracked } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, findUnit } from "../state.mjs";
import { WO_UNIT_KINDS, emitSafely, err, oneLine, woKey } from "./common.mjs";
import { changedTrackedFiles, commitIntegration, findWorkOrderFiles } from "./handback.mjs";
import { isUnattributedPatch } from "./policy.mjs";

/** Unit kinds a hand-back can block and an unblock can re-admit (the failable kinds of unitFailure.mjs). */
export const UNBLOCKABLE_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
/** The only hand-back cause this command lifts: everything else needs the owner (decide/answer). */
export const UNBLOCK_CAUSE = "env-infra";
/** File, in the unit's directory, that tells the next brief this attempt resumes after an environment fix. */
export const UNBLOCK_NOTE = "unblocked.json";

const handbackEvents = (events) => events.filter((e) => e.type === "handback" && Array.isArray(e.data?.blocked));
/** The latest hand-back that blocked `unitId`, or null. */
const lastBlockingHandback = (events, unitId) => handbackEvents(events).filter((e) => e.data.blocked.includes(unitId)).pop() ?? null;

/**
 * Decide and plan an unblock (pure). Refuses with INVALID_INPUT (exit 6) anything that is not a `blocked` work unit whose
 * latest hand-back names it as the root with cause `env-infra`.
 * @param {{state: object, events: object[], unitId: string, reason: string, at?: string}} input `events` = the run journal
 * @returns {{state: object, events: object[], units: string[], root: object, handback: object}}
 */
export function planUnblock({ state, events, unitId, reason, at = null }) {
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (!UNBLOCKABLE_KINDS.includes(unit.kind)) throw err("INVALID_INPUT", `unit ${unitId} is a ${unit.kind} unit: only docs, tests, build and patch units can be unblocked`);
  if (unit.state !== "blocked") throw err("INVALID_INPUT", `unit ${unitId} is ${unit.state}, not blocked: there is nothing to unblock`);
  const hb = lastBlockingHandback(events, unitId);
  if (!hb) throw err("INVALID_INPUT", `unit ${unitId} has no hand-back in the journal: it cannot be unblocked`);
  if (hb.data.unit !== unitId) throw err("INVALID_INPUT", `unit ${unitId} was blocked as a dependent of ${hb.data.unit}: unblock ${hb.data.unit} instead`, { root: hb.data.unit });
  if (hb.data.cause !== UNBLOCK_CAUSE) {
    throw err("INVALID_INPUT", `unit ${unitId} was handed back for ${hb.data.cause} (${hb.data.reason_code ?? "?"}), not ${UNBLOCK_CAUSE}: the owner decides it (/pandacorp:decide), unblock only lifts an environment failure`, { cause: hb.data.cause });
  }
  if (Number.isInteger(hb.data.attempt) && hb.data.attempt !== unit.attempt) throw err("INVALID_STATE", `unit ${unitId} is at attempt ${unit.attempt} but was handed back at attempt ${hb.data.attempt}`, { hint: "rebuild-state" });
  if (!String(reason ?? "").trim()) throw err("USAGE", "unblock needs --reason (what was fixed in the environment)");

  // Dependents come back only when this very hand-back is still what blocks them (a later hand-back of theirs wins).
  const ids = hb.data.blocked.filter((id) => {
    const u = findUnit(state, id);
    if (!u || u.state !== "blocked" || u.kind === "doubt-consult") return false;
    return lastBlockingHandback(events, id) === hb;
  });
  const set = new Set(ids);
  const next = {
    ...state,
    handbacks_in_a_row: 0,
    units: state.units.map((u) => (set.has(u.id) ? { ...u, state: "queued", token_hash: null, worker: null, parked: null, pending_answer: null, waiting_gate: null } : u)),
  };
  const planned = [
    { type: "unblocked", data: { unit: unitId, cause: UNBLOCK_CAUSE, attempt: unit.attempt, reason: oneLine(reason, 400), units: ids, handback_seq: hb.seq ?? null, ...(at ? { at } : {}) } },
    ...ids.map((id) => ({ type: "unit_state", data: { unit: id, from: "blocked", to: "queued", reason: "unblock" } })),
  ];
  return { state: next, events: planned, units: ids, root: unit, handback: hb };
}

/** Mark the newest pending hand-back entry of the unit in the decisions inbox (and its mirror) as resolved. Best effort. */
async function markInboxResolved(project, integrationRoot, { unitId, reason, date }, deps) {
  const fs = deps.fs ?? fsp;
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  const mirrorRel = ".pandacorp/inbox/decisions.pending.md";
  if (tracked) await assertNotTracked(project, mirrorRel, deps);
  const mark = async (file) => {
    let text;
    try { text = await fs.readFile(file, "utf8"); } catch (error) { if (error.code === "ENOENT") return false; throw error; }
    const marker = `con la unidad ${unitId}, que el motor`;
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(marker, from);
      if (at < 0) return false;
      const start = text.lastIndexOf("\n## ", at) + 1;
      const rest = text.slice(start + 3).search(/\n## /);
      const end = rest < 0 ? text.length : start + 3 + rest;
      const block = text.slice(start, end);
      if (/^- \*\*Estado:\*\* PENDIENTE/m.test(block)) {
        const updated = block.replace(/^- \*\*Estado:\*\* PENDIENTE.*$/m, `- **Estado:** RESUELTO: entorno arreglado, unidad reanudada (${date}): ${oneLine(reason, 200)}`);
        await atomicWriteText(file, `${text.slice(0, start)}${updated}${text.slice(end)}`, { fs, mode: 0o644 });
        return true;
      }
      from = at + marker.length;
    }
    return false;
  };
  await mark(abs);
  if (tracked) await mark(path.join(project, mirrorRel));
}

/** Uncommitted files of a unit worktree (`null` when the worktree is gone). */
async function worktreeChanges(worktree, deps) {
  if (!worktree) return null;
  const exists = await (deps.fs ?? fsp).stat(worktree).then(() => true, () => false);
  if (!exists) return null;
  const res = await (deps.exec ?? defaultExec)("git", ["status", "--porcelain=v1", "-z"], { cwd: worktree });
  if (res.code !== 0) return null;
  return res.stdout.split("\0").filter((e) => e.length > 3).length;
}

/**
 * Apply an unblock under a phase-2 ctx of `fencedTwoPhase` (state, journal, WO frontmatter + one integration commit,
 * inbox entry, the previous report kept aside and the brief note).
 * @param {{readState: Function, writeState: Function, appendEvent: Function, paths: object, project: string, runId: string}} ctx
 * @param {{unitId: string, reason: string}} input
 * @param {object} [deps] fs, exec, buildState, emit, clock
 * @returns {Promise<{unit: string, attempt: number, units: string[], wos_planned: string[], worktree: string|null, worktree_changes: number|null, previous_report: string|null, commit: string|null, notice_es: string}>}
 */
export async function applyUnblock(ctx, { unitId, reason }, deps = {}) {
  const { project, paths } = ctx;
  const fs = deps.fs ?? fsp;
  const state = await ctx.readState();
  if (!state) throw err("INVALID_STATE", "no build state: nothing to unblock", { hint: "rebuild-state" });
  const { events } = await readJournal(paths.journalFile, deps);
  const at = nowIso(deps);
  const plan = planUnblock({ state, events, unitId, reason, at });
  const unit = plan.root;
  const integrationRoot = path.resolve(project, state.integration.worktree);

  // 1. WOs of the re-admitted build/patch units: BLOCKED -> PLANNED in the integration worktree.
  const bs = deps.buildState ?? await import("../../build-state.mjs");
  const targets = plan.units.map((id) => findUnit(state, id));
  const wosOf = (u) => (WO_UNIT_KINDS.includes(u.kind) && !isUnattributedPatch(u) ? u.wos : []);
  const files = await findWorkOrderFiles(integrationRoot, targets.flatMap(wosOf), { fs });
  const wosPlanned = [];
  for (const target of targets) {
    for (const wo of wosOf(target)) {
      const file = files.get(woKey(wo));
      if (!file) continue;
      try { await bs.transitionWorkOrderAt(integrationRoot, { file, to: "PLANNED" }); wosPlanned.push(wo); } catch (error) { if (error.code !== "INVALID_STATE") throw error; }
    }
  }
  await markInboxResolved(project, integrationRoot, { unitId, reason, date: at.slice(0, 10) }, deps);
  const trailers = [`Unit: ${unitId}`, ...wosPlanned.map((wo) => `WO: ${wo}`)].join("\n");
  const commit = await commitIntegration(integrationRoot, await changedTrackedFiles(integrationRoot, deps), `chore(build): unblock ${unitId} after an environment fix\n\n${trailers}\n`, deps);

  // 2. The previous report is kept aside (never read as this attempt's result) and the next brief is told about it.
  const unitDir = paths.unitDir(unitId);
  const kept = path.join(unitDir, `report-a${unit.attempt}-blocked.json`);
  let previousReport = null;
  try { await fs.rename(paths.reportFile(unitId), kept); previousReport = kept; } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!previousReport && await fs.stat(kept).then(() => true, () => false)) previousReport = kept;
  const changes = await worktreeChanges(unit.worktree, deps);
  await fs.mkdir(unitDir, { recursive: true });
  await atomicWriteJson(path.join(unitDir, UNBLOCK_NOTE), { attempt: unit.attempt, at, reason: oneLine(reason, 400), previous_report: previousReport, worktree: unit.worktree ?? null, worktree_changes: changes }, { fs });

  // 3. State and journal (the caller's phase 2 holds the lease mutex); no admission token survives.
  await ctx.writeState(plan.state);
  for (const event of plan.events) await ctx.appendEvent(event);
  for (const id of plan.units) { try { releaseToken(id, { file: paths.admissionFile }); } catch { /* no reservation left */ } }
  const warning = await emitSafely(deps, "unit.unblocked", { unit: unitId, units: plan.units, attempt: unit.attempt });
  const notice = `Unidad reanudada: ${unitId} vuelve a la cola en el mismo intento ${unit.attempt} (no gasta presupuesto)${changes ? `, con sus ${changes} cambios sin confirmar conservados` : ""}.${plan.units.length > 1 ? ` También vuelven: ${plan.units.filter((id) => id !== unitId).join(", ")}.` : ""}`;
  return {
    unit: unitId, attempt: unit.attempt, units: plan.units, wos_planned: wosPlanned, worktree: unit.worktree ?? null, worktree_changes: changes,
    previous_report: previousReport, commit, notice_es: notice, ...(warning ? { warnings: [warning] } : {}),
  };
}

/**
 * Validate an unblock against the current state and journal WITHOUT writing (for `start --resume --unblock`, which must
 * refuse before it takes the lease). Same refusals as {@link planUnblock}.
 */
export async function checkUnblock({ project, state, unitId, reason }, deps = {}) {
  const { events } = await readJournal(buildPaths(project, deps).journalFile, deps);
  return planUnblock({ state, events, unitId, reason });
}

/**
 * The `unblock` command: `unblock --epoch E --unit U --reason "<what was fixed>"` (fenced; phase 2 does the work).
 * @returns {Promise<{ok: true, cmd: "unblock"} & object>}
 * @throws USAGE (exit 2) without unit/reason; INVALID_INPUT (exit 6) for a unit that is not an env-infra root; FENCE (exit 3)
 */
export async function unblockCommand({ project, epoch, unit, reason }, deps = {}) {
  if (!unit) throw err("USAGE", "unblock needs --unit");
  if (!String(reason ?? "").trim()) throw err("USAGE", "unblock needs --reason (what was fixed in the environment)");
  return fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => ({ ok: true, cmd: "unblock", ...await applyUnblock(ctx, { unitId: unit, reason }, deps) }));
}
