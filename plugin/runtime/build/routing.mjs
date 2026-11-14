// Shared-capacity routing. The catalog validates capabilities; capacity.decide owns policy.
import { decide } from "../capacity.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIERS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "model-tiers.json");
const COMPANIES = ["claude", "codex"];
const AVAILABILITY = ["ok", "quota", "unreachable", "at_capacity", "conserve"];
const REVIEW_KINDS = ["frd", "touch"];
const ZONES = ["none", "floor", "r1"];
const SHAPES = ["R-A", "R-B", "R-C", "drive"];
const CONSULT_ORIGINS = ["claude", "codex", "drive", "codex_app"];
const SESSION_EFFORT_FOR_REVIEW = "high";
const EFFORT_CAP = "xhigh";
/** Single source of truth for model strength; drive (and any other consumer) derives from this table. Fable is ranked but never selected automatically (CONV-12). */
export const MODEL_STRENGTH = Object.freeze({ haiku: 1, luna: 1, sonnet: 2, sol: 2, terra: 2, opus: 3, astra: 3, fable: 4 });

/** The task/risk projection used for dispatch AND waking queued work. No synthetic global veto. */
export function capacityTaskForUnit(unit) {
  const role = unit.role ?? unit.kind;
  const type = /planner|architect|design|docs|doubt-consult/.test(role) ? "design"
    : /review|audit/.test(role) ? "review" : /mechanic/.test(role) ? "mechanical" : "implement";
  return { id: unit.id, type, risk: unit.kind === "audit" || /security-auditor/.test(role) || unit.zone === "r1" ? "critical" : unit.zone === "floor" ? "delicate" : "normal" };
}

/** Review eligibility shared by candidate dispatch and capacity wake. */
export function reviewDemand(state, unit) {
  const named = new Set(unit.depends_on ?? []);
  const work = state.units.filter(x => ["build", "patch", "tests"].includes(x.kind) && x.state !== "blocked"
    && (unit.frd ? x.frd === unit.frd : named.has(x.id)));
  const wos = new Set([...unit.wos, ...work.flatMap(x => x.wos)]);
  const pending = state.units.filter(x => ["build", "patch"].includes(x.kind) && ["reviewing", "integrated"].includes(x.state)
    && (work.includes(x) || x.kind === "patch" && !x.frd && x.wos.some(w => wos.has(w))));
  const ready = pending.length > 0 && work.every(x => ["reviewing", "verified", "landed"].includes(x.state)
    || x.kind === "patch" && !x.frd && x.state === "integrated");
  return { named, work, pending, ready };
}

/** Error thrown on invalid routing input or on data that would break an invariant (code ROUTING). */
export class RoutingError extends Error {
  constructor(message) { super(message); this.name = "RoutingError"; this.code = "ROUTING"; }
}
const fail = (message) => { throw new RoutingError(message); };
/** Reads and validates model-tiers.json (version 2).
 *  @param {{path?: string, readFile?: (p: string) => string}} [deps]
 *  @returns {object} the parsed tiers data */
export function loadTiers(deps = {}) {
  const file = deps.path || DEFAULT_TIERS_PATH;
  const read = deps.readFile || ((p) => readFileSync(p, "utf8"));
  return validateTiers(JSON.parse(read(file)));
}

/** Structural check of the v2 keys routing reads; throws RoutingError on a missing or wrong-typed key.
 *  @param {object} tiers
 *  @returns {object} the same object */
export function validateTiers(tiers) {
  if (!tiers || tiers.version !== 2) fail("model-tiers.json: version 2 required");
  for (const key of ["effort_rank", "disabled", "builder", "review_matrix"]) if (!Array.isArray(tiers[key])) fail(`model-tiers.json: ${key} must be an array`);
  for (const key of ["catalog", "layers", "never_emit", "review_modifiers", "doubt_consult"]) if (!tiers[key] || typeof tiers[key] !== "object") fail(`model-tiers.json: ${key} missing`);
  if (!tiers.effort_rank.includes(EFFORT_CAP)) fail("model-tiers.json: effort_rank lacks xhigh");
  for (const row of tiers.builder) if (!row.id || !row.match || !row.claude || !row.codex) fail(`model-tiers.json: malformed builder row ${row.id}`);
  for (const row of tiers.review_matrix) if (!Number.isInteger(row.row) || !row.author || !row.match) fail("model-tiers.json: malformed review_matrix row");
  return tiers;
}

/** Builds a router bound to one tiers object (the injection point for tests).
 *  @param {object} tiers  parsed model-tiers.json v2
 *  @returns {{builderCell: Function, reviewCell: Function, consultCell: Function, sessionEligible: Function,
 *            nextEffort: Function, modelSlug: Function, companyOf: Function, assertCell: Function, tiers: object}} */
export function createRouter(tiers) {
  validateTiers(tiers);
  const RANK = tiers.effort_rank;
  const companyOf = (model) => {
    if (tiers.layers.claude.includes(model) || model === "fable") return "claude";
    if (tiers.layers.codex.includes(model)) return "codex";
    return fail(`unknown model ${model}`);
  };
  const forbiddenModel = (model) => tiers.disabled.includes(model) || tiers.never_emit.models.includes(model);
  const nextEffort = (effort) => {
    const e = effort == null ? SESSION_EFFORT_FOR_REVIEW : effort === "max" ? EFFORT_CAP : effort;
    const i = RANK.indexOf(e);
    if (i < 0) fail(`unknown effort ${effort}`);
    return RANK[Math.min(i + 1, RANK.indexOf(EFFORT_CAP))];
  };
  const assertCell = (cell, where) => {
    if (!cell || !COMPANIES.includes(cell.runtime)) fail(`${where}: bad runtime ${cell && cell.runtime}`);
    if (!tiers.catalog[cell.runtime] || !Object.hasOwn(tiers.catalog[cell.runtime], cell.model)) fail(`${where}: unknown model ${cell.runtime}/${cell.model}`);
    if (forbiddenModel(cell.model)) fail(`${where}: forbidden model ${cell.model}`);
    if (!RANK.includes(cell.effort) || tiers.never_emit.efforts.includes(cell.effort)) fail(`${where}: bad effort ${cell.effort}`);
    return cell;
  };
  const modelSlug = (cell) => (cell && cell.runtime === "codex" ? tiers.catalog.codex[cell.model] ?? fail(`no codex slug for ${cell.model}`) : null);

  // A session model may author a unit only when it is an enabled catalog model of the coordinator's company.
  const sessionModelOk = (runtime, model) => typeof model === "string" && Object.hasOwn(tiers.catalog[runtime] || {}, model) && !forbiddenModel(model);

  /** A12: true iff the unit is written by the coordinating session itself (`via:"session"`). */
  const sessionEligible = (unit, ctx = {}) => {
    const coordinator = ctx.coordinator;
    if (coordinator !== "claude-session" && coordinator !== "codex-session") return false;
    const runtime = coordinator === "claude-session" ? "claude" : "codex";
    const zone = ctx.zone ?? unit.zone;
    const attempt = ctx.attempt ?? unit.attempt ?? 1;
    return unit.kind === "build" && unit.size === "touch" && attempt === 1 && zone === "none" && ctx.label === runtime && sessionModelOk(runtime, ctx.sessionModel);
  };

  // Role and deterministic risk zone choose task kind/floor; author and attempt never escalate a cell.
  const select = (unit, ctx = {}) => {
    const zone = ctx.zone ?? unit.zone ?? "none";
    if (!ZONES.includes(zone)) fail(`bad zone ${zone}`);
    const quota = ctx.quota ?? ctx.availability ?? {};
    const now = ctx.now ?? quota.now ?? Date.now();
    // Old availability strings are compatibility input only; full readings are passed by next.
    const readings = ctx.readings ?? quota.readings ?? Object.fromEntries(COMPANIES.map(tool => {
      const status = quota[tool];
      if (typeof status === "string" && !AVAILABILITY.includes(status)) fail(`bad availability ${tool}=${status}`);
      const pct = quota[`${tool}_new_units`] === false || ["quota", "unreachable"].includes(status) ? 100 : status === "conserve" ? 86 : 0;
      return [tool, { schema: 1, tool, state: typeof status === "string" || quota[`${tool}_new_units`] !== undefined ? "known" : "unknown", reason: typeof status === "string" || quota[`${tool}_new_units`] !== undefined ? null : "missing_reading", observedAt: new Date(now).toISOString(), windows:
        (tool === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id => ({ id, scope: "all", applicability: "required", percentUsed: pct,
          resetsAt: new Date(Number(new Date(now)) + 3600000).toISOString() })) }];
    }));
    const task = capacityTaskForUnit({ ...unit, id: unit.id ?? unit.kind, zone });
    const decision = decide({ task, readings, now });
    return { decision, task };
  };
  const builderCell = (unit, ctx = {}) => {
    if (!unit || typeof unit.kind !== "string") fail("builderCell: unit.kind required");
    if (!COMPANIES.includes(ctx.label)) fail(`builderCell: bad label ${ctx.label}`);
    const zone = ctx.zone ?? unit.zone ?? "none", attempt = ctx.attempt ?? unit.attempt ?? 1;
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) fail(`builderCell: attempt ${attempt} outside 1..3`);
    if (ctx.shape !== undefined && !SHAPES.includes(ctx.shape)) fail(`bad shape ${ctx.shape}`);
    if (!["docs", "tests", "build", "patch", "audit", "planner", "architect", "design", "implementer", "builder", "mechanical"].includes(unit.kind)) fail(`unknown kind ${unit.kind}`);
    const { decision, task } = select({ ...unit, zone }, ctx);
    if (decision.action === "wait") return { paused: "quota", row: "capacity", resumeAt: decision.resumeAt, capacity: decision, task };
    const cell = assertCell({ runtime: decision.tool, model: decision.model, effort: decision.effort }, "capacity builder");
    // Check capacity BEFORE any session shortcut; a different model requires an independent worker.
    const session = sessionEligible(unit, { ...ctx, label: cell.runtime, zone, attempt }) && ctx.sessionModel === cell.model;
    return { ...cell, via: session ? "session" : cell.runtime === "codex" || ["codex-session", "drive"].includes(ctx.coordinator) ? "cli" : "agent", row: "capacity",
      switched: cell.runtime !== ctx.label, bumped: false, capacity: decision, task };
  };
  const reviewCell = (input = {}) => {
    if (!Array.isArray(input.authors) || !input.authors.length) fail("reviewCell: authors[] required");
    if (!REVIEW_KINDS.includes(input.kind)) fail(`reviewCell: bad kind ${input.kind}`);
    if (input.shape !== undefined && !SHAPES.includes(input.shape)) fail(`bad shape ${input.shape}`);
    for (const a of input.authors) {
      const company = companyOf(a.model);
      if (a.runtime && a.runtime !== company) fail("reviewCell: author runtime/model mismatched");
      if (a.effort != null && !RANK.includes(a.effort)) fail("reviewCell: invalid author effort");
    }
    const { decision, task } = select({ id: input.id, kind: "review", zone: input.zone }, input);
    let used = decision.action === "run" ? assertCell({ runtime: decision.tool, model: decision.model, effort: decision.effort }, "capacity review") : null;
    if (used && used.runtime === "claude" && ["R-B", "drive"].includes(input.shape)) used = { ...used, via: "cli" };
    return { primary: used, used, degraded: null, deferred: null, parked: used ? null : "no_reviewer", row: "capacity",
      resumeAt: decision.resumeAt ?? null, capacity: decision, task, independent_context: true };
  };
  const consultCell = (input = {}) => {
    if (!CONSULT_ORIGINS.includes(input.origin)) fail(`bad consult origin ${input.origin}`);
    if (!Number.isInteger(input.consultNo) || input.consultNo < 1) fail("bad consultNo");
    if (input.consultNo > 2) return null;
    const { decision, task } = select({ id: input.id, kind: "architect", zone: input.zone ?? "none" }, input);
    return decision.action === "run" ? { ...assertCell({ runtime: decision.tool, model: decision.model, effort: decision.effort }, "consult"), capacity: decision, task } : { paused: "quota", resumeAt: decision.resumeAt, capacity: decision, task };
  };

  return { builderCell, reviewCell, consultCell, sessionEligible, nextEffort, modelSlug, companyOf, assertCell, tiers };
}

let defaultRouter = null;
const router = (deps) => (deps && deps.tiers ? createRouter(deps.tiers) : (defaultRouter ||= createRouter(loadTiers())));

/** builderCell over the plugin's model-tiers.json (or `deps.tiers`). See createRouter. */
export const builderCell = (unit, ctx, deps) => router(deps).builderCell(unit, ctx);
/** reviewCell over the plugin's model-tiers.json (or `deps.tiers`). See createRouter. */
export const reviewCell = (input, deps) => router(deps).reviewCell(input);
/** consultCell over the plugin's model-tiers.json (or `deps.tiers`). See createRouter. */
export const consultCell = (input, deps) => router(deps).consultCell(input);
/** A12 session-unit test over the plugin's model-tiers.json (or `deps.tiers`). */
export const sessionEligible = (unit, ctx, deps) => router(deps).sessionEligible(unit, ctx);
/** Codex catalog slug for a codex cell (null for claude). */
export const modelSlug = (cell, deps) => router(deps).modelSlug(cell);
