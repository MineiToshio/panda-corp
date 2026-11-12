// state.json of a v2 run: validated read/write, the two-phase fenced mutation (D5), unit/state shapes (A13, A18),
// and rebuildState() (journal replay A14 + work-order frontmatter, frontmatter wins).
import { readFileSync } from "node:fs";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { assertValid, atomicWriteJson, deepEqual, loadSchema, readJson } from "./fsx.mjs";
import { appendEvent, readJournal } from "./journal.mjs";
import { SCHEMAS_DIR, buildPaths } from "./paths.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

// Enumerations come from the schema file itself: one source of truth (state.mjs validates enums only, A13).
const stateSchemaSync = JSON.parse(readFileSync(path.join(SCHEMAS_DIR, "state.schema.json"), "utf8"));
const unitProps = stateSchemaSync.properties.units.items.properties;

export const STATE_SCHEMA_VERSION = stateSchemaSync.properties.schema.const;
export const STATE_STATUSES = Object.freeze([...stateSchemaSync.properties.status.enum]);
export const COORDINATORS = Object.freeze([...stateSchemaSync.properties.coordinator.enum]);
export const LABELS = Object.freeze([...stateSchemaSync.properties.label.enum]);
export const SIZES = Object.freeze([...stateSchemaSync.properties.size.enum]);
export const UNIT_KINDS = Object.freeze([...unitProps.kind.enum]);
export const UNIT_STATES = Object.freeze([...unitProps.state.enum]);
export const ZONES = Object.freeze([...unitProps.zone.enum]);
export const JOB_KINDS = Object.freeze([...stateSchemaSync.properties.jobs.items.properties.kind.enum]);
export const JOB_STATES = Object.freeze([...stateSchemaSync.properties.jobs.items.properties.state.enum]);
/** Review-type and consult kinds: `verified` is terminal for them (A13). */
export const REVIEW_TYPE_KINDS = Object.freeze(["review", "audit", "doubt-consult", "deferred-review"]);

/** Is a unit in a terminal state (A13: `landed`, `blocked`, and `verified` for review-type/consult kinds)? */
export const isTerminalUnit = (unit) => unit.state === "landed" || unit.state === "blocked" || (unit.state === "verified" && REVIEW_TYPE_KINDS.includes(unit.kind));

// ---------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------

/**
 * Build a complete state unit (every schema-required key present, nullable ones null).
 * @param {{id: string, kind: string, wos?: string[], frd?: string|null}} fields overrides any default
 */
export function newUnit(fields) {
  if (!fields?.id || !fields?.kind) throw err("USAGE", "newUnit needs id and kind");
  return {
    wos: [], frd: null, chain: null, zone: "none", risk_rules: [], state: "queued", attempt: 1,
    token_hash: null, worker: null, worktree: null, branch: null, depends_on: [], pending_answer: null,
    parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null,
    ...fields,
  };
}

/**
 * Build the initial state of a run (status `active`, no units).
 * @param {{run_id: string, epoch: number, coordinator: string, label: string, size: string,
 *   scope: object, integration: {branch: string, worktree: string, base_sha: string}}} fields
 */
export function newState(fields) {
  return {
    schema: STATE_SCHEMA_VERSION, engine: "v2", status: "active", status_reason: null, tranche: null,
    last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {},
    ...fields,
  };
}

/** The unit with this id, or undefined. */
export const findUnit = (state, id) => state.units.find((u) => u.id === id);

/**
 * New state with `patch` merged into one unit (pure). A function patch receives the unit and returns the changes.
 * @throws INVALID_STATE for an unknown unit
 */
export function patchUnit(state, id, patch) {
  const at = state.units.findIndex((u) => u.id === id);
  if (at < 0) throw err("INVALID_STATE", `unknown unit ${id}`);
  const unit = { ...state.units[at], ...(typeof patch === "function" ? patch(state.units[at]) : patch) };
  return { ...state, units: state.units.map((u, i) => (i === at ? unit : u)) };
}

/**
 * New state with a unit moved to `to` (pure). Enum check only: the owning module enforces the A13 transitions.
 * @throws INVALID_STATE when `to` is not a unit state
 */
export function setUnitState(state, id, to) {
  if (!UNIT_STATES.includes(to)) throw err("INVALID_STATE", `not a unit state: ${to}`);
  return patchUnit(state, id, { state: to });
}

/** New state with a job inserted or replaced by id (pure). */
export function upsertJob(state, job) {
  const has = state.jobs.some((j) => j.id === job.id);
  return { ...state, jobs: has ? state.jobs.map((j) => (j.id === job.id ? { ...j, ...job } : j)) : [...state.jobs, job] };
}

// ---------------------------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------------------------

/**
 * Validate a state against state.schema.json.
 * @throws INVALID_STATE (exit 5, hint `rebuild-state`); a schema-version mismatch is reported as such
 */
export async function validateState(state, deps = {}) {
  if (state?.schema !== undefined && state.schema !== STATE_SCHEMA_VERSION) {
    throw err("INVALID_STATE", `state schema ${state.schema} is not ${STATE_SCHEMA_VERSION}`, { hint: "rebuild-state" });
  }
  const schema = await loadSchema("state", { fs: deps.fs });
  assertValid(schema, state, { label: "state.json", code: "INVALID_STATE", hint: "rebuild-state" });
  return state;
}

/**
 * Read and validate `build/state.json`. Missing file: `null`.
 * @param {string} project project root
 * @param {{fs?: object, env?: object, homedir?: string}} [deps]
 */
export async function readState(project, deps = {}) {
  const state = await readJson(buildPaths(project, deps).stateFile, { fs: deps.fs });
  return state === null ? null : validateState(state, deps);
}

/**
 * Validate and atomically write `build/state.json` (mode 0600). The write itself takes no lock: call it from
 * a `fencedTwoPhase` phase (ctx.writeState) so the fence and the epoch are verified.
 */
export async function writeState(project, state, deps = {}) {
  await validateState(state, deps);
  await atomicWriteJson(buildPaths(project, deps).stateFile, state, { fs: deps.fs });
  return state;
}

// ---------------------------------------------------------------------------------------------
// Two-phase fenced mutation (D5)
// ---------------------------------------------------------------------------------------------

/**
 * Read `build/lease-token.json` and check it belongs to `epoch`.
 * @returns {Promise<string>} the raw lease token (never log it)
 * @throws FENCE when the file is missing/invalid or its epoch differs from the caller's
 */
export async function readLeaseToken(project, epoch, deps = {}) {
  let file;
  try {
    file = await readJson(buildPaths(project, deps).tokenFile, { fs: deps.fs });
  } catch {
    throw err("FENCE", "lease token file is unreadable");
  }
  if (!file || typeof file.token !== "string" || file.epoch !== Number(epoch)) throw err("FENCE", "stale or missing lease token for this epoch");
  return file.token;
}

/**
 * Run one mutating command under the two-phase rule (D5):
 *   1. phase 1, under the lease mutex: verify the fence, renew the lease (`projectStatus:false`), run `phase1(ctx)` (record intent);
 *   2. `work(intent, ctx)`, OUTSIDE the mutex, read-only ctx: verification runs, worker waits, merges, only in worktrees/jobs;
 *   3. phase 2, under the mutex: re-read the token file, re-verify the same epoch, run `phase2(result, intent, ctx)`
 *      (write state, journal, branch commits).
 * Any of the three callbacks may be omitted. A fence failure in phase 2 discards `result` (nothing is written) and throws.
 *
 * The mutex-holding ctx (phases 1 and 2) has: `project, epoch, actor, token, lease, paths, runId`, `readState()`,
 * `writeState(state)` (stamps `epoch`), `appendEvent({type, data, at?, actor?})` (fills run_id/epoch/actor).
 * The work ctx has `project, epoch, actor, lease, paths, runId, readState()` only.
 *
 * @param {{project: string, epoch: number, actor?: "cli"|"drive", deps?: object}} ref `deps.buildState` replaces
 *   `plugin/runtime/build-state.mjs` (needs `renew` and `withFence`); other deps: `fs, env, homedir, clock`
 * @param {(ctx: object) => any} [phase1] its return value is the `intent`
 * @param {(intent: any, ctx: object) => any} [work] its return value is the `result`
 * @param {(result: any, intent: any, ctx: object) => any} [phase2] its return value is returned to the caller
 * @returns {Promise<any>} phase2's value; `result` when phase2 is omitted
 * @throws FENCE / QUIESCED (exit 3; `error.phase` is 1 or 2), or whatever a callback throws
 */
export async function fencedTwoPhase({ project, epoch, actor = "cli", deps = {} }, phase1, work, phase2) {
  const bs = deps.buildState ?? await import("../build-state.mjs");
  const paths = buildPaths(project, deps);
  const stamp = (error, phase) => { if (error && typeof error === "object" && (error.code === "FENCE" || error.code === "QUIESCED")) error.phase = phase; return error; };
  const baseCtx = (lease, token, mutexHeld) => {
    const ctx = {
      project, epoch: Number(epoch), actor, lease, paths, runId: lease.run_id,
      readState: () => readState(project, deps),
    };
    if (!mutexHeld) return ctx;
    return {
      ...ctx, token,
      writeState: (state) => writeState(project, { ...state, epoch: Number(epoch) }, deps),
      appendEvent: (event) => appendEvent(paths.journalFile, { run_id: lease.run_id, epoch: Number(epoch), actor, ...event }, deps),
    };
  };

  let token;
  let lease1;
  let intent;
  try {
    token = await readLeaseToken(project, epoch, deps);
    await bs.renew(project, token, epoch, { projectStatus: false });
    intent = await bs.withFence(project, token, epoch, async (lease) => {
      lease1 = lease;
      return phase1 ? phase1(baseCtx(lease, token, true)) : undefined;
    });
  } catch (error) { throw stamp(error, 1); }

  const result = work ? await work(intent, baseCtx(lease1, token, false)) : undefined;
  if (!phase2) return result;

  try {
    const token2 = await readLeaseToken(project, epoch, deps);
    return await bs.withFence(project, token2, epoch, (lease) => phase2(result, intent, baseCtx(lease, token2, true)));
  } catch (error) { throw stamp(error, 2); }
}

// ---------------------------------------------------------------------------------------------
// rebuildState: journal replay (A14) + work-order frontmatter (frontmatter wins)
// ---------------------------------------------------------------------------------------------

const clone = (value) => structuredClone(value);
const unitOrThrow = (state, id, type) => {
  const unit = findUnit(state, id);
  if (!unit) throw err("INVALID_STATE", `journal ${type} refers to unknown unit ${id}`, { hint: "rebuild-state" });
  return unit;
};
const isEnvInfra = (data) => data?.cause === "env-infra" || data?.reason === "env-infra" || data?.diagnosis?.cause === "env-infra";

/**
 * Fold journal events, in order, into a state (A14). The first `run_started` carries the initial state.
 * Unknown event types and events with no state effect are ignored; an event naming an unknown unit throws.
 * @param {object[]} events verified journal events
 * @returns {object} the replayed state (not yet merged with frontmatter)
 * @throws INVALID_STATE when there is no `run_started` with a state, or an event refers to an unknown unit
 */
export function foldJournal(events) {
  const first = events.find((e) => e.type === "run_started");
  if (!first?.data?.state) throw err("INVALID_STATE", "journal has no run_started with an initial state", { hint: "rebuild-state" });
  let state = clone(first.data.state);
  state.units = state.units ?? [];
  for (const ev of events) {
    const d = ev.data ?? {};
    if (Number.isInteger(ev.epoch) && ev.epoch > (state.epoch ?? 0)) state.epoch = ev.epoch;
    switch (ev.type) {
      case "run_resumed":
        if (COORDINATORS.includes(d.coordinator)) state.coordinator = d.coordinator;
        if (state.status !== "finished") { state.status = "active"; state.status_reason = null; }
        break;
      case "drive_takeover": state.coordinator = "drive"; break;
      case "run_stopped": state.status = "stopped"; state.status_reason = d.reason ?? null; break;
      case "run_finished": state.status = "finished"; state.status_reason = d.reason ?? null; break;
      case "engine_failure": state.status = "stopped"; state.status_reason = d.reason ?? "engine_failure"; break;
      case "paused": state.status = STATE_STATUSES.includes(d.status) ? d.status : "paused"; state.status_reason = d.reason ?? null; break;
      case "unit_queued": {
        const at = state.units.findIndex((u) => u.id === d.id);
        if (at >= 0) state.units[at] = clone(d); else state.units.push(clone(d));
        break;
      }
      case "unit_state": {
        unitOrThrow(state, d.unit, ev.type).state = d.to;
        if (d.to === "committed") state.handbacks_in_a_row = 0;
        break;
      }
      case "unit_dispatched": {
        const u = unitOrThrow(state, d.unit, ev.type);
        u.worker = { runtime: d.cell.runtime, model: d.cell.model, effort: d.cell.effort ?? null, via: d.via, pid: d.pid ?? null, worker_id: d.worker_id ?? null };
        u.worktree = d.worktree ?? null;
        u.branch = d.branch ?? null;
        u.token_hash = d.token_hash ?? null;
        break;
      }
      case "job_started": {
        const at = state.jobs.findIndex((j) => j.id === d.id);
        if (at >= 0) state.jobs[at] = clone(d); else state.jobs.push(clone(d));
        break;
      }
      case "job_finished": {
        const job = state.jobs.find((j) => j.id === d.id);
        if (job) { job.state = d.state; job.exit = d.exit ?? null; }
        break;
      }
      case "report_received": {
        const u = unitOrThrow(state, d.unit, ev.type);
        if (d.test_hashes && typeof d.test_hashes === "object") u.test_hashes = clone(d.test_hashes);
        break;
      }
      case "parked": {
        const u = unitOrThrow(state, d.unit, ev.type);
        u.parked = d.reason ?? null;
        u.pending_answer = d.question ?? null;
        if (d.assumed_on) u.assumed_on = d.assumed_on; else delete u.assumed_on;
        break;
      }
      case "waiting_gate": unitOrThrow(state, d.unit, ev.type).waiting_gate = d.kind ?? null; break;
      case "safe_point": state.last_safe_point = { sha: d.sha, kind: d.kind, at: ev.at }; break;
      case "doubt_opened": unitOrThrow(state, d.unit, ev.type).doubt_id = d.doubt_id; break;
      case "doubt_consulted": state.doubts_consulted += 1; break;
      case "handback": state.handbacks_in_a_row = isEnvInfra(d) ? state.handbacks_in_a_row + 1 : 0; break;
      case "answer_recorded":
        state.answers[d.question] = d.value;
        for (const { unit } of d.units ?? []) { const u = findUnit(state, unit); if (u) u.pending_answer = null; }
        break;
      case "review_recorded": {
        const u = findUnit(state, d.unit);
        if (u && d.probe_hashes && typeof d.probe_hashes === "object") u.probe_hashes = clone(d.probe_hashes);
        if (u && d.verdict) u.review = { verdict: d.verdict, reviewer: clone(d.reviewer), degraded: d.degraded ?? null, deferred_id: d.deferred_id ?? null };
        break;
      }
      default:
    }
  }
  return state;
}

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;
const fmScalar = (block, key) => {
  const m = block.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
};

/**
 * Read `implementation_status` of every work order under a worktree (`docs/frds/<frd>/work-orders/*.md`).
 * @param {string} root worktree root (the integration worktree)
 * @returns {Promise<Map<string, string>>} lowercase WO id (frontmatter `id`, else the file stem) to status
 * @throws INVALID_STATE when a work order has no parsable frontmatter status
 */
export async function readWorkOrderStatuses(root, { fs = fsp } = {}) {
  const out = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds;
  try { frds = await fs.readdir(frdsDir); } catch (error) {
    if (error.code === "ENOENT") return out;
    throw error;
  }
  for (const frd of frds.sort()) {
    const woDir = path.join(frdsDir, frd, "work-orders");
    let names;
    try { names = await fs.readdir(woDir); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const body = await fs.readFile(path.join(woDir, name), "utf8");
      const block = body.match(FM_BLOCK)?.[1];
      const status = block ? fmScalar(block, "implementation_status") : null;
      if (!status) throw err("INVALID_STATE", `${frd}/work-orders/${name}: missing implementation_status frontmatter`, { hint: "rebuild-state" });
      const id = (fmScalar(block, "id") || name.replace(/\.md$/, "")).toLowerCase();
      out.set(id, status);
    }
  }
  return out;
}

// Frontmatter-implied unit state, or null when the cached state already agrees.
function impliedUnitState(unit, statuses) {
  const s = unit.state;
  if (statuses.some((x) => x === "BLOCKED")) return s === "blocked" ? null : "blocked";
  if (statuses.every((x) => x === "VERIFIED")) return s === "landed" ? null : "landed";
  const late = ["integrated", "reviewing", "verified", "landed"];
  if (statuses.some((x) => x === "PLANNED" || x === "IN_PROGRESS")) {
    if (late.includes(s)) return "patching";
    if (statuses.every((x) => x === "PLANNED") && ["admitted", "running", "reported", "committed"].includes(s)) return "queued";
    if (s === "blocked") return "queued";
    return null;
  }
  // Every WO is IN_REVIEW (or a mix with VERIFIED): the unit is integrated unless it is already past that point.
  return ["integrated", "reviewing", "verified", "waiting_gate"].includes(s) ? null : "integrated";
}

/**
 * Apply work-order frontmatter to a replayed state: on any conflict the frontmatter wins.
 * Only `build` and `patch` units carry WOs whose frontmatter tracks the unit.
 * @param {object} state replayed state (not mutated)
 * @param {Map<string,string>} statuses result of readWorkOrderStatuses
 * @returns {{state: object, conflicts: {unit: string, from: string, to: string}[]}}
 * @throws INVALID_STATE when a build/patch unit names a WO that has no file
 */
export function applyFrontmatter(state, statuses) {
  const next = clone(state);
  const conflicts = [];
  for (const unit of next.units) {
    if (unit.kind !== "build" && unit.kind !== "patch") continue;
    if (!unit.wos.length) continue;
    const list = unit.wos.map((wo) => {
      const status = statuses.get(String(wo).toLowerCase());
      if (!status) throw err("INVALID_STATE", `unit ${unit.id}: work order ${wo} not found in the integration worktree`, { hint: "rebuild-state" });
      return status;
    });
    const to = impliedUnitState(unit, list);
    if (to) { conflicts.push({ unit: unit.id, from: unit.state, to }); unit.state = to; }
  }
  return { state: next, conflicts };
}

/**
 * Compare a cached state with a rebuilt one (the `diff_vs_cache` of `rebuild-state`).
 * @returns {{changed: string[], added: string[], removed: string[], fields: string[]}} unit ids, plus changed top-level keys
 */
export function diffStates(cache, rebuilt) {
  const cachedUnits = new Map((cache?.units ?? []).map((u) => [u.id, u]));
  const rebuiltUnits = new Map(rebuilt.units.map((u) => [u.id, u]));
  const changed = [...rebuiltUnits].filter(([id, u]) => cachedUnits.has(id) && !deepEqual(cachedUnits.get(id), u)).map(([id]) => id);
  const added = [...rebuiltUnits.keys()].filter((id) => !cachedUnits.has(id));
  const removed = [...cachedUnits.keys()].filter((id) => !rebuiltUnits.has(id));
  const keys = new Set([...Object.keys(cache ?? {}), ...Object.keys(rebuilt)]);
  const fields = [...keys].filter((k) => k !== "units" && !deepEqual(cache?.[k], rebuilt[k]));
  return { changed, added, removed, fields };
}

/**
 * Regenerate the state of the project's current run: replay the journal, then apply the integration worktree's
 * WO frontmatter. Writes nothing (the fenced `rebuild-state` command writes it through `fencedTwoPhase`).
 * @param {{project: string, journalFile?: string, integrationRoot?: string, deps?: object}} args
 * @returns {Promise<{state: object, conflicts: object[], diff: object}>} `diff` is `diffStates(cache, rebuilt)`
 * @throws JOURNAL_CHAIN (broken chain), INVALID_STATE (no initial state, frontmatter unreadable, rebuilt state invalid)
 */
export async function rebuildState({ project, journalFile, integrationRoot, deps = {} }) {
  const p = buildPaths(project, deps);
  const { events } = await readJournal(journalFile ?? p.journalFile, deps);
  const replayed = foldJournal(events);
  const root = integrationRoot ?? path.resolve(project, replayed.integration?.worktree ?? p.integrationWorktree);
  const statuses = await readWorkOrderStatuses(root, deps);
  const { state, conflicts } = applyFrontmatter(replayed, statuses);
  await validateState(state, deps);
  let cache = null;
  // A corrupt or outdated cache is the very reason to rebuild: it is compared as absent, never trusted.
  try { cache = await readState(project, deps); } catch { cache = null; }
  return { state, conflicts, diff: diffStates(cache, state) };
}
