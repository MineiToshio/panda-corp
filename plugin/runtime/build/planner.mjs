/**
 * Pandacorp build engine v2: the planner (BUILD-9, D30, PLAN 3.6, 3.16 A13). Pure and self-contained: it imports nothing
 * from the default engine's `build-mech-*` files. It reads no repository and spawns nothing; the caller hands it the work
 * orders (as read from the integration worktree), the run's scope and the state units, and gets back units to queue and a
 * dispatch round. The only reader here is `readPlanWorkOrders`, which feeds `plan` / `lint-plan` / `next` from disk.
 *
 * Rules (standard BUILD-9):
 *  - a WO is ready when it is PLANNED|IN_PROGRESS, in scope, unclaimed by a build/patch unit, not below a parked or blocked
 *    unit/WO, not pending the answer to an irreversible question, and every `dependsOn` is INTEGRATED (IN_REVIEW on the
 *    run's integration branch, or VERIFIED); a dependency on another FRD's integrated-but-unverified WO of a floor FRD waits
 *    for that FRD's review unless the dependent is one the floor FRD itself needs (DR-132 waiver);
 *  - rounds are greedy: barrier first, then longest downstream path, up to the round width, adding a unit only when its
 *    `artifacts` do not overlap a live or already chosen unit (literal-prefix rule: conservative);
 *  - a chain is at most 3 WOs of one FRD on a linear stretch, cut when the routing cell changes;
 *  - a tests unit precedes a build unit that adds ACs on the floor/r1 zone, or any build unit of a `type: bug` card (A13);
 *  - nothing can ever become ready and nothing is held by an owner/parked/blocked cause: `deadlock`.
 *
 * Every function takes the injected `deps` as its LAST optional argument.
 */
import { norm } from "./planner/common.mjs";
import { lintModel } from "./planner/lint.mjs";
import { buildModel } from "./planner/model.mjs";
import { simulate } from "./planner/rounds.mjs";
import { classifyStuck, findCycles } from "./planner/stuck.mjs";

export { CHAIN_MAX, DEFAULT_CEILING, DOCS_GLOBS } from "./planner/common.mjs";
export { artifactsOverlap, extractAcIds, globsOverlap, isBarrierPath, literalPrefix } from "./planner/pathRules.mjs";
export { readPlanWorkOrders } from "./planner/readWorkOrders.mjs";

/**
 * Plan the run: new units to queue, the dispatch round, a simulated schedule, held work and deadlock.
 *
 * @param {object} input
 * @param {{id: string, frd: string, status: string, deps?: string[], artifacts?: string[]|null, order?: number, reopen_count?: number,
 *   zone?: "none"|"floor"|"r1", risk_rules?: string[], acs?: string[], source_change?: string[]}[]} input.wos every WO known (all FRDs,
 *   every status: dependencies outside the scope are read from here); `status` is the frontmatter on the integration worktree;
 *   `artifacts` absent = legacy (serial), `[]` = declared empty; `zone` = the static risk zone of its artifacts (risk.mjs)
 * @param {{card?: string|null, frds?: string[], wos?: string[], out_of_scope?: string[]}} input.scope `state.scope`
 * @param {object[]} [input.units] `state.units` (claimed WOs, live units, queued candidates, parked/blocked roots)
 * @param {string} [input.label] "claude"|"codex": builder label; without it no routing cell is computed
 * @param {"touch"|"feature"|"giant"} [input.size]
 * @param {number} [input.ceiling] round width including live units (default 2); `input.reserved` extra live slots; `input.capacity` overrides
 * @param {string[]} [input.floor_frds] FRDs held to the floor rule; default: FRDs with a WO in zone floor/r1
 * @param {string[]} [input.verified_frds] FRDs whose review passed (also derived from `review` units and all-VERIFIED FRDs)
 * @param {Record<string, string[]>} [input.frd_acs] AC ids of each FRD at `integration.base_sha` (tests-first; unknown = all cited ACs are new)
 * @param {string|null} [input.card_type] "bug" makes every build unit tests-first
 * @param {{id: string, affects: object, reversible: boolean}[]} [input.questions] open owner questions (D19)
 * @param {object} [input.quota] [input.shape] [input.coordinator] [input.session_model] forwarded to `routing.builderCell`
 * @param {{cellOf?: Function, routing?: object}} [deps] `cellOf(unit, ctx)` replaces the routing call
 * @returns {{units: object[], now: string[], ready: string[], round: string[], rounds: string[][], cells: object, why: object, meta: object,
 *   held: {wo: string, reason: string, by: string}[], held_units: string[], integration_paused_by: string|null, capacity: number,
 *   floor_waived: {wo: string, frd: string, floors: string[]}[], progress: boolean, deadlock: null|{wos: string[], units: string[],
 *   waits: {wo: string, dep: string, why: string}[], cycles: string[][]}, issues: object[]}}
 *   `units` = every NEW unit of the plan (state-shaped, `queued`), in plan order, future rounds included; `now` = the new units to
 *   queue now (chains ready now, a tests unit always with its build unit); `ready` = queued candidates (new and existing) whose
 *   dependencies are met; `round` = what to dispatch now within the capacity and without artifact overlap; `rounds` = the simulated
 *   schedule (round 0 equals `round`); `deadlock` is non-null when WOs or queued units can never run and no owner/parked/blocked cause holds them
 */
export function plan(input, deps = {}) {
  const m = buildModel(input, deps);
  const run = simulate(m);
  const stuck = classifyStuck(m, run);
  const { sim } = run;
  const liveBarrier = m.liveWrite.find((u) => (u.wos ?? []).some((w) => m.nodes.get(norm(w))?.barrier));
  const roundBarrier = run.roundIds.find((id) => sim.meta[id]?.barrier);
  const deadlock = stuck.rest.length === 0 && stuck.stuckUnits.length === 0 ? null : {
    wos: stuck.rest.map((n) => n.id), units: stuck.stuckUnits, waits: stuck.waits,
    cycles: findCycles(m.nodes).filter((c) => c.some((id) => stuck.rest.some((n) => n.id === id))),
  };
  return {
    units: sim.planned, now: run.nowIds, ready: run.readyIds, round: run.roundIds, rounds: run.rounds,
    cells: sim.cells, why: sim.why, meta: sim.meta, held: stuck.held, held_units: stuck.heldUnits,
    integration_paused_by: liveBarrier?.id ?? roundBarrier ?? null, capacity: m.capacity, floor_waived: sim.floorWaived,
    progress: run.roundIds.length > 0 || m.liveWrite.length > 0, deadlock, issues: lintModel(m, stuck),
  };
}

/**
 * `lint-plan`: dependency cycles/dangling deps, empty or missing `artifacts`, `artifacts` overlap between WOs with no dependency path,
 * unowned AC lines, out-of-scope dependencies and deadlock. Same input as `plan` plus `strict`.
 * @param {object} input see `plan`; `input.strict` promotes every warning to an error
 * @param {object} [deps]
 * @returns {{ok: boolean, strict: boolean, issues: {rule: string, wo: string|null, severity: "error"|"warn", detail: string}[]}}
 *   `ok` false when any issue is an error (after strict promotion); the CLI exits 6 on `!ok`
 */
export function lintPlan(input, deps = {}) {
  const strict = input?.strict === true;
  const issues = plan(input, deps).issues.map((i) => (strict ? { ...i, severity: "error" } : i));
  return { ok: !issues.some((i) => i.severity === "error"), strict, issues };
}

/**
 * The `plan` CLI output shape (build-engine-cli 3.6): `{units, rounds, issues}`. With `explain`, `why` carries the reasoning.
 * @param {ReturnType<typeof plan>} result
 * @param {{explain?: boolean, queued?: object[]}} [options] `queued` = already queued units to list first
 */
export function planView(result, { explain = false, queued = [] } = {}) {
  const view = (u) => {
    const cell = result.cells[u.id];
    return {
      id: u.id, kind: u.kind, wos: u.wos, frd: u.frd, chain: u.chain, depends_on: u.depends_on,
      cell: cell?.runtime ? { runtime: cell.runtime, model: cell.model, effort: cell.effort } : null, why: explain ? result.why[u.id] ?? null : null,
    };
  };
  return { units: [...queued, ...result.units].map(view), rounds: result.rounds, issues: result.issues };
}
