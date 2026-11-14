// routing.mjs: the v2 engine's routing (BUILD-10, DR-152). Every builder, reviewer and doubt-consult cell is derived
// from plugin/runtime/model-tiers.json version 2; this file holds no matrix of its own. Pure functions: the tiers data
// is injected (createRouter) or read once from the plugin (the module-level helpers).
// Invariants enforced on every returned cell (a violation throws, it is never silently repaired):
//   - the model is a catalog key of its runtime, never in `disabled` or `never_emit.models` (no Fable, no Terra);
//   - the effort is in `effort_rank` and never in `never_emit.efforts` (no max);
//   - a same-model (N7) review exists only when the other company is out of quota (Astra analog: also unreachable);
//   - a repeated execution raises effort one step (cap xhigh) and never switches company.
// The one exception to "routed cells only": a `via:"session"` cell carries the coordinator's session model with a null
// effort (A12); it is emitted only for a session model that passes the same model checks.
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
const N7_EFFORT = "author_next_capped";
// Strength order used only to pick the strictest reviewer for a mixed-author diff (BUILD-10 "strictest applicable row").
/** Single source of truth for model strength; drive (and any other consumer) derives from this table. Fable is ranked but never selected automatically (CONV-12). */
export const MODEL_STRENGTH = Object.freeze({ haiku: 1, luna: 1, sonnet: 2, sol: 2, terra: 2, opus: 3, astra: 3, fable: 4 });

/** Error thrown on invalid routing input or on data that would break an invariant (code ROUTING). */
export class RoutingError extends Error {
  constructor(message) { super(message); this.name = "RoutingError"; this.code = "ROUTING"; }
}
const fail = (message) => { throw new RoutingError(message); };
const asArr = (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
const inSet = (v, set) => set === undefined || asArr(set).includes(v);
const other = (company) => (company === "claude" ? "codex" : "claude");
const pick = (cell) => ({ runtime: cell.runtime, model: cell.model, effort: cell.effort });
const sameModel = (a, b) => a.runtime === b.runtime && a.model === b.model;

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

  // Normalizes the quota/availability input: {claude, codex} strings, or quota.mjs policy() booleans.
  const availabilityOf = (quota, shape) => {
    const out = { claude: "ok", codex: "ok" };
    if (quota) for (const c of COMPANIES) {
      if (typeof quota[c] === "string") { if (!AVAILABILITY.includes(quota[c])) fail(`bad availability ${c}=${quota[c]}`); out[c] = quota[c]; }
      if (quota[`${c}_new_units`] === false) out[c] = "quota";
      else if (quota[`${c}_conserve`] === true && out[c] === "ok") out[c] = "conserve";
    }
    if (shape === "drive") out.claude = "quota";
    if (shape === "R-B" && out.claude !== "quota") out.claude = "unreachable";
    return out;
  };
  // DR-161: a conserved provider still runs its own label's units; only cross-company reviews avoid it.
  const canRun = (a) => a === "ok" || a === "at_capacity" || a === "conserve";

  /** Builder cell (BUILD-10 builder table, BUILD-11 quota switch, A12 session cells).
   *  @param {{kind: string, size?: string, bounded?: boolean, zone?: string, reopen_count?: number, attempt?: number}} unit
   *  @param {{label: "claude"|"codex", zone?: string, reopen_count?: number, attempt?: number,
   *           previousCell?: {runtime: string, model: string, effort: string}|null,
   *           quota?: {claude?: string, codex?: string, claude_new_units?: boolean, codex_new_units?: boolean},
   *           shape?: "R-A"|"R-B"|"R-C"|"drive", coordinator?: string, sessionModel?: string}} ctx
   *  @returns {{runtime, model, effort, via, row, switched, bumped}
   *          | {deferred: {runtime, model, effort}, degraded: string, row: string}
   *          | {paused: "quota", row: string}} */
  const builderCell = (unit, ctx = {}) => {
    if (!unit || typeof unit.kind !== "string") fail("builderCell: unit.kind required");
    const label = ctx.label;
    if (!COMPANIES.includes(label)) fail(`builderCell: bad label ${label}`);
    const zone = ctx.zone ?? unit.zone ?? "none";
    if (!ZONES.includes(zone)) fail(`builderCell: bad zone ${zone}`);
    const reopen = ctx.reopen_count ?? unit.reopen_count ?? 0;
    const attempt = ctx.attempt ?? unit.attempt ?? 1;
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) fail(`builderCell: attempt ${attempt} outside 1..3`);
    if (ctx.shape !== undefined && !SHAPES.includes(ctx.shape)) fail(`builderCell: bad shape ${ctx.shape}`);
    const u = { kind: unit.kind, size: unit.size, zone, reopen, attempt, bounded: unit.bounded === true };
    const row = tiers.builder.find(({ match: m }) =>
      inSet(u.kind, m.kind) && inSet(u.size, m.size) && inSet(u.zone, m.zone) &&
      (m.reopen_count_min === undefined || u.reopen >= m.reopen_count_min) &&
      (m.attempt === undefined || u.attempt === m.attempt) && (m.bounded === undefined || u.bounded === m.bounded));
    if (!row) fail(`builderCell: no builder row for ${JSON.stringify(u)}`);

    if (sessionEligible(unit, { ...ctx, zone, attempt })) {
      return { runtime: label, model: ctx.sessionModel, effort: null, via: "session", row: row.id, switched: false, bumped: false };
    }
    const avail = availabilityOf(ctx.quota, ctx.shape);
    let col = label;
    if (!canRun(avail[label])) col = other(label);
    const raw = row[col];
    const runtime = raw.runtime || col;
    const deferredCell = row.deferred_rereview ? pick(row.deferred_rereview) : null;
    // DR-161: a row pinned to the OTHER company (the audit) does not spend a conserved company; it waits like Claude out.
    const conservedCross = runtime !== col && avail[runtime] === "conserve";
    if (!canRun(avail[runtime]) || conservedCross) {
      // The audit runs on Claude only; with Claude out (quota, unreachable, drive) it waits as a deferred review.
      if (deferredCell && (row.claude_out === "deferred" || (ctx.shape === "drive" && row.drive === "deferred"))) {
        return { deferred: assertCell(deferredCell, `builder ${row.id} deferred`), degraded: row.degraded || "quota_90", row: row.id };
      }
      return { paused: "quota", row: row.id };
    }
    const cell = { runtime, model: raw.model, effort: raw.effort };
    let bumped = false;
    const prev = ctx.previousCell;
    if (prev && prev.runtime === cell.runtime && prev.model === cell.model && prev.effort === cell.effort) {
      cell.effort = nextEffort(cell.effort);
      bumped = true;
    }
    assertCell(cell, `builder ${row.id}`);
    return { ...cell, via: runtime === "codex" ? "cli" : "agent", row: row.id, switched: runtime !== label, bumped };
  };

  // One author against the matrix: the first row in ARRAY order wins (rows 8, 15, 16 sit first on purpose).
  const reviewForAuthor = (author, kind, zone, availability) => {
    const model = author.model;
    const company = companyOf(model);
    if (author.runtime !== undefined && author.runtime !== company) fail(`reviewCell: author ${author.runtime}/${model} mismatched`);
    const effort = author.effort == null ? SESSION_EFFORT_FOR_REVIEW : author.effort;
    const origin = author.origin || (author.via === "session" ? "session" : "unit");
    const r = tiers.review_matrix.find((row) =>
      row.author.runtime === company && inSet(model, row.author.model) && inSet(effort, row.author.effort) &&
      (row.author.origin === undefined || row.author.origin === origin) && inSet(kind, row.match.kind) && inSet(zone, row.match.zone));
    if (!r) fail(`reviewCell: no matrix row for ${JSON.stringify({ model, effort, origin, kind, zone })}`);
    const src = r.by_model ? r.by_model[model] : r;
    if (!src) fail(`reviewCell: row ${r.row} has no by_model.${model}`);
    const primaryRaw = r.primary_by_zone?.[zone] || r.primary_by_kind?.[kind] || src.primary;
    const primary = assertCell(pick(primaryRaw), `review row ${r.row} primary`);
    const avail = availability[other(company)];
    const authorCell = { runtime: company, model, effort };
    const result = { row: r.row, primary, used: null, degraded: null, deferred: null, parked: null };
    let raw = primaryRaw;
    // DR-161: the reviewer company has < 15 % left (conserve, or out of quota at >= 90 %): stay in the author's company,
    // a different model when the row has one (on_conserve), never a deferred cross-company re-review.
    const scarce = avail === "quota" || avail === "conserve";
    if (scarce) raw = src.on_conserve ?? src.on_quota;
    else if (avail === "unreachable") raw = src.on_unreachable;
    if (raw === undefined) fail(`reviewCell: row ${r.row} lacks a cell for ${avail}`);
    if (raw === "park") return { ...result, parked: "no_reviewer" };
    const used = pick(raw);
    if (used.effort === N7_EFFORT) used.effort = nextEffort(effort);
    let degraded = raw === primaryRaw ? null : raw.degraded || null;
    if (sameModel(used, authorCell)) {
      // N7 guard: same-model review only on quota; the Astra analog also on unreachable. Anything else parks.
      const allowed = avail === "quota" || avail === "conserve" || (avail === "unreachable" && company === "codex" && model === "astra");
      if (!allowed || raw.same_model_exception !== "N7") return { ...result, parked: "no_reviewer" };
      degraded = "same_model";
    }
    if (used.runtime === "codex" && used.model === "sol" && availability.codex === "at_capacity") {
      const then = tiers.review_modifiers.sol_at_capacity?.then;
      if (!then) fail("model-tiers.json: review_modifiers.sol_at_capacity.then missing");
      Object.assign(used, pick(then));
      degraded = degraded || tiers.review_modifiers.sol_at_capacity.degraded || "at_capacity";
    }
    if (scarce && degraded !== "same_model") degraded = avail === "quota" ? "quota_90" : "conserve";
    result.used = assertCell(used, `review row ${r.row}`);
    result.degraded = degraded;
    // DR-161: a conserve review queues no cross-company re-review (it would spend the scarce company); at most a note.
    if (degraded && !scarce) result.deferred = { needed: primary.runtime, reviewer: { ...primary } };
    return result;
  };

  /** Review cell (BUILD-10 matrix, D11 availability rules, drive and Codex-app modifiers, sol at capacity).
   *  @param {{authors: Array<{runtime?: string, model: string, effort?: string|null, origin?: "session"|"unit", via?: string}>,
   *           kind: "frd"|"touch", zone: "none"|"floor"|"r1",
   *           availability?: {claude?: string, codex?: string}, shape?: "R-A"|"R-B"|"R-C"|"drive"}} input
   *  @returns {{primary: {runtime, model, effort}, used: {runtime, model, effort}|null,
   *            degraded: null|"quota_90"|"unreachable"|"at_capacity"|"same_model",
   *            deferred: {needed: "claude"|"codex", reviewer: {runtime, model, effort}}|null,
   *            parked: null|"no_reviewer", row: number}} */
  const reviewCell = (input = {}) => {
    const { authors, kind, zone } = input;
    if (!Array.isArray(authors) || authors.length === 0) fail("reviewCell: authors[] required");
    if (!REVIEW_KINDS.includes(kind)) fail(`reviewCell: bad kind ${kind}`);
    if (!ZONES.includes(zone)) fail(`reviewCell: bad zone ${zone}`);
    if (input.shape !== undefined && !SHAPES.includes(input.shape)) fail(`reviewCell: bad shape ${input.shape}`);
    const availability = availabilityOf(input.availability, input.shape);
    const results = authors.map((a) => reviewForAuthor(a, kind, zone, availability));
    if (results.length === 1) return results[0];
    // Mixed authors: one reviewer that authored none of the lines (N7 aside), the strictest of the candidates.
    const authorCells = authors.map((a) => ({ runtime: companyOf(a.model), model: a.model }));
    const strength = (c) => MODEL_STRENGTH[c.model] * 10 + RANK.indexOf(c.effort);
    const candidates = results.filter((r) => r.used && (r.degraded === "same_model" || !authorCells.some((a) => sameModel(a, r.used))));
    const strictestPrimary = results.reduce((best, r) => (strength(r.primary) > strength(best.primary) ? r : best));
    if (candidates.length === 0) return { ...strictestPrimary, used: null, degraded: null, deferred: null, parked: "no_reviewer" };
    return candidates.reduce((best, r) => (strength(r.used) > strength(best.used) ? r : best));
  };

  /** Doubt consult cell (BUILD-12 ladder): consult 1 by origin, consult 2 = the strongest model not yet consulted.
   *  @param {{origin: "claude"|"codex"|"drive"|"codex_app", consultNo: number,
   *           consulted?: Array<{runtime, model}>, availability?: {claude?: string, codex?: string}}} input
   *  @returns {{runtime, model, effort}|null}  null = no consult left (the doubt parks) */
  const consultCell = (input = {}) => {
    const { origin, consultNo } = input;
    if (!CONSULT_ORIGINS.includes(origin)) fail(`consultCell: bad origin ${origin}`);
    if (!Number.isInteger(consultNo) || consultNo < 1) fail(`consultCell: bad consultNo ${consultNo}`);
    const avail = availabilityOf(input.availability, origin === "drive" ? "drive" : origin === "codex_app" ? "R-B" : undefined);
    const first = tiers.doubt_consult.by_origin?.[origin];
    if (!first) fail(`model-tiers.json: doubt_consult.by_origin.${origin} missing`);
    if (consultNo === 1) return canRun(avail[first.runtime]) ? assertCell(pick(first), `consult ${origin} 1`) : null;
    if (consultNo > 2) return null;
    const consulted = [first, ...(input.consulted || [])].map((c) => ({ runtime: c.runtime, model: c.model }));
    const next = (tiers.doubt_consult.tie_break?.strongest_not_yet_consulted || [])
      .find((c) => canRun(avail[c.runtime]) && !consulted.some((d) => sameModel(d, c)));
    return next ? assertCell(pick(next), `consult ${origin} 2`) : null;
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
