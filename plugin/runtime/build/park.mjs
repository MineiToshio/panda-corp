// Parking of v2 build units (BUILD-12, D19, D20): a unit nobody can decide for parks together with every unit that
// depends on it while everything independent continues; the root-block rule builds a reversible root on an
// assumption branch `lane/<run_id>/assume-<doubt>` that is never landed until the owner answers.
// Assumption markers stack (review R1 B6, DEC-7): a unit built on the assumption of doubt A that parks on another question Q
// keeps A in `assumed_on` while `parked`/`pending_answer` describe Q, and gets A back when Q is answered; `assumptionOf` is
// the one reader of the marker. An assumed unit never becomes the root of a second assumption (it parks instead), so a
// unit's code depends on at most one unaccepted assumption and an accepted assume branch never carries another one's code.
// Pure state transforms return `{state, events}`; the caller applies them inside its fenced phase (state first, then
// the journal events in order). Only `createAssumeBranch` touches git.
import { defaultExec } from "./fsx.mjs";
import { findUnit, isTerminalUnit } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Park reasons that wait for the owner (the `no_reviewer` park is the review module's). */
export const PARK_REASONS = Object.freeze(["owner_question", "built_on_assumption"]);

/** Root block: the parked unit drags MORE than this share of the pending units (BUILD-12 constants). */
export const ROOT_BLOCK_RATIO = 0.5;

/** States a unit may park from: its own doubt (reported), or before/while it runs (A13). */
const PARKABLE_SELF = Object.freeze(["queued", "admitted", "running", "reported"]);

/** Dependents park only before dispatch: a dependent cannot be running while its dependency is unresolved. */
const PARKABLE_DEPENDENT = Object.freeze(["queued", "admitted"]);

/**
 * Ids of every unit that transitively `depends_on` the given unit, in breadth-first order (the unit itself excluded).
 * @param {{units: object[]}} state run state
 * @param {string} unitId root unit
 * @returns {string[]}
 */
export function dependentsOf(state, unitId) {
  const found = new Set();
  const queue = [unitId];
  while (queue.length) {
    const head = queue.shift();
    for (const unit of state.units) {
      if ((unit.depends_on ?? []).includes(head) && unit.id !== unitId && !found.has(unit.id)) {
        found.add(unit.id);
        queue.push(unit.id);
      }
    }
  }
  return [...found];
}

/**
 * Units that still count as pending work: not terminal (A13) and not a doubt consult (a consult is ladder plumbing,
 * not work the owner asked for).
 * @param {{units: object[]}} state
 * @returns {object[]}
 */
export function pendingUnits(state) {
  return state.units.filter((u) => !isTerminalUnit(u) && u.kind !== "doubt-consult");
}

/**
 * How much pending work a parked unit drags through `depends_on`: its pending transitive dependents over every pending
 * unit (the doubting unit counts in the denominator, never in the numerator). A lone unit with no dependents drags 0 %,
 * so it is never a root block, including in a single-unit scope (it parks `owner_question`).
 * @param {{units: object[]}} state
 * @param {string} unitId
 * @returns {{dragged: string[], pending: number, ratio: number, isRoot: boolean}} `isRoot` = ratio > 0.5
 */
export function rootBlock(state, unitId) {
  const pending = new Set(pendingUnits(state).map((u) => u.id));
  const dragged = dependentsOf(state, unitId).filter((id) => pending.has(id));
  const ratio = pending.size ? dragged.length / pending.size : 0;
  return { dragged, pending: pending.size, ratio, isRoot: ratio > ROOT_BLOCK_RATIO };
}

/**
 * The root rule: a doubt nobody could decide parks its unit, unless the unit is a root block and the preferred option
 * is reversible; then the work is built on that option on an assumption branch. A unit already built on another
 * unaccepted assumption always parks (assumptions never nest: an accepted assume branch must not carry the code of a
 * pending or rejected one).
 * @param {{units: object[]}} state
 * @param {string} unitId the doubted unit
 * @param {{reversible: boolean}} opts `reversible` = no deterministic veto and no consult said the preferred option is irreversible
 * @returns {{mode: "park"|"assume", block: ReturnType<typeof rootBlock>}}
 */
export function parkOrAssume(state, unitId, { reversible }) {
  const block = rootBlock(state, unitId);
  const nested = assumptionOf(findUnit(state, unitId)) !== null;
  return { mode: reversible === true && block.isRoot && !nested ? "assume" : "park", block };
}

/**
 * The unaccepted assumption (doubt id) a unit's code is built on, or `null`. While the unit is parked on another question
 * the id lives in `assumed_on`; otherwise `parked: built_on_assumption` + `pending_answer` carry it.
 * @param {object|null|undefined} unit state unit
 * @returns {string|null}
 */
export const assumptionOf = (unit) => unit?.assumed_on ?? (unit?.parked === "built_on_assumption" ? unit.pending_answer ?? null : null);

/** The unit without its `assumed_on` key (the key is absent, never null, when the unit carries no stacked assumption). */
export const withoutAssumedOn = ({ assumed_on: _assumedOn, ...rest }) => rest;

/**
 * Release one unit parked on an owner question (pure): back to `queued`. A unit that carries an assumption gets its
 * marker back (`parked: built_on_assumption`, `pending_answer` = that doubt), so it stays off the integration branch.
 * The `parked` event replays the result (A14 fold; `assumed_on` absent = cleared).
 * @param {object} unit a `parked` state unit
 * @returns {{unit: object, events: {type: string, data: object}[]}}
 */
export function releasedUnit(unit) {
  const carried = unit.assumed_on ?? null;
  const next = { ...withoutAssumedOn(unit), state: "queued", parked: carried ? "built_on_assumption" : null, pending_answer: carried, token_hash: null };
  return {
    unit: next,
    events: [
      { type: "unit_state", data: { unit: unit.id, from: unit.state, to: "queued" } },
      { type: "parked", data: { unit: unit.id, reason: next.parked, question: next.pending_answer } },
    ],
  };
}

const replaceUnits = (state, changed) => ({ ...state, units: state.units.map((u) => changed.get(u.id) ?? u) });

/**
 * Park a unit and its dependents (pure). The unit parks from `queued|admitted|running|reported`; a dependent parks only
 * when it was not dispatched yet (`queued|admitted`); anything else is reported in `skipped` and left as it is.
 * Tokens are voided. Events: `unit_state` + `parked {unit, reason, question}` per parked unit (A14).
 * @param {object} state run state (not mutated)
 * @param {string} unitId the unit to park
 * @param {{reason: "owner_question"|"built_on_assumption", question: string|null, dependents?: boolean}} opts
 * @returns {{state: object, parked: {unit: string, from: string, role: "self"|"dependent"}[], skipped: {unit: string, state: string}[], events: {type: string, data: object}[]}}
 * @throws INVALID_STATE for an unknown unit or a unit that cannot park
 */
export function parkUnits(state, unitId, { reason, question, dependents = true }) {
  if (!PARK_REASONS.includes(reason)) throw err("INVALID_INPUT", `park reason must be one of ${PARK_REASONS.join("|")}, got ${reason}`);
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (!PARKABLE_SELF.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} cannot park from state ${unit.state}`);
  const changed = new Map();
  const parked = [];
  const skipped = [];
  const events = [];
  const park = (u, role) => {
    // B6: the assumption the unit is built on survives the park (it is NOT the question it now waits for).
    const carried = assumptionOf(u);
    const kept = carried && carried !== question ? { assumed_on: carried } : {};
    changed.set(u.id, { ...withoutAssumedOn(u), state: "parked", parked: reason, pending_answer: question, token_hash: null, ...kept });
    parked.push({ unit: u.id, from: u.state, role });
    events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to: "parked" } });
    events.push({ type: "parked", data: { unit: u.id, reason, question, ...kept } });
  };
  park(unit, "self");
  for (const id of dependents ? dependentsOf(state, unitId) : []) {
    const dep = findUnit(state, id);
    if (PARKABLE_DEPENDENT.includes(dep.state)) park(dep, "dependent");
    else if (!isTerminalUnit(dep) && dep.state !== "parked") skipped.push({ unit: dep.id, state: dep.state });
  }
  return { state: replaceUnits(state, changed), parked, skipped, events };
}

/**
 * Mark a root block as built on assumption (pure): the doubted unit goes back to `queued` (its brief carries the
 * assumed option) and it and its non-terminal dependents carry `parked: built_on_assumption` with the doubt id as
 * `pending_answer`, so they stay dispatchable but never land until the owner answers. Assumptions never nest (B6): a
 * root that already carries another assumption is parked `owner_question` on this doubt instead (`mode: "park"`, its own
 * assumption kept), and a dependent that carries another assumption is left as it is (listed in `skipped`).
 * @param {object} state run state (not mutated)
 * @param {string} unitId the doubted unit
 * @param {{question: string}} opts the doubt id
 * @returns {{state: object, units: string[], events: {type: string, data: object}[], mode: "assume"|"park",
 *   skipped: {unit: string, assumption: string}[], parked?: object[]}}
 * @throws INVALID_STATE for an unknown unit or a unit that is not `reported`/`queued`
 */
export function assumeUnits(state, unitId, { question }) {
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (unit.state !== "reported" && unit.state !== "queued") throw err("INVALID_STATE", `unit ${unitId} cannot be built on assumption from state ${unit.state}`);
  const own = assumptionOf(unit);
  if (own !== null && own !== question) {
    const fallback = parkUnits(state, unitId, { reason: "owner_question", question });
    return { state: fallback.state, units: fallback.parked.map((p) => p.unit), events: fallback.events, mode: "park", skipped: [], parked: fallback.parked };
  }
  const changed = new Map();
  const events = [];
  const skipped = [];
  const mark = (u, to) => {
    changed.set(u.id, { ...withoutAssumedOn(u), state: to, parked: "built_on_assumption", pending_answer: question, ...(to !== u.state ? { token_hash: null } : {}) });
    if (to !== u.state) events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to } });
    events.push({ type: "parked", data: { unit: u.id, reason: "built_on_assumption", question } });
  };
  mark(unit, "queued");
  for (const id of dependentsOf(state, unitId)) {
    const dep = findUnit(state, id);
    if (isTerminalUnit(dep) || dep.state === "parked") continue;
    const carried = assumptionOf(dep);
    if (carried !== null && carried !== question) skipped.push({ unit: dep.id, assumption: carried });
    else mark(dep, dep.state);
  }
  return { state: replaceUnits(state, changed), units: [...changed.keys()], events, mode: "assume", skipped };
}

/**
 * Release the units parked as `owner_question` on one question (pure): back to `queued`, `parked` and
 * `pending_answer` cleared, except that a unit carrying an assumption (`assumed_on`) gets its marker back (see
 * `releasedUnit`). The replay is a `parked` event with the restored reason/question (A14 fold).
 * @param {object} state run state (not mutated)
 * @param {string} question question id (doubt id or ask id)
 * @returns {{state: object, units: string[], events: {type: string, data: object}[]}}
 */
export function releaseParked(state, question) {
  const changed = new Map();
  const events = [];
  for (const u of state.units) {
    if (u.state !== "parked" || u.parked !== "owner_question" || u.pending_answer !== question) continue;
    const released = releasedUnit(u);
    changed.set(u.id, released.unit);
    events.push(...released.events);
  }
  return { state: replaceUnits(state, changed), units: [...changed.keys()], events };
}

/**
 * Units built on the assumption of one doubt (`assumptionOf(unit)` = the doubt id), including those parked meanwhile on
 * another question.
 * @param {{units: object[]}} state
 * @param {string} doubtId
 * @returns {object[]}
 */
export const assumptionUnits = (state, doubtId) => state.units.filter((u) => assumptionOf(u) === doubtId);

/**
 * Create the assumption branch at the integration tip (idempotent: an existing branch is kept).
 * @param {{integrationRoot: string, branch: string}} input integration worktree and `paths.assumeBranch(runId, doubtId)`
 * @param {{exec?: Function}} [deps] `exec(cmd, args, {cwd}) -> Promise<{code, stdout, stderr}>`
 * @returns {Promise<{branch: string, sha: string, created: boolean}>}
 * @throws FAILCLOSED when git cannot create or resolve the branch
 */
export async function createAssumeBranch({ integrationRoot, branch }, deps = {}) {
  const exec = deps.exec ?? defaultExec;
  const existing = await exec("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: integrationRoot });
  if (existing.code === 0) return { branch, sha: existing.stdout.trim(), created: false };
  const made = await exec("git", ["branch", branch, "HEAD"], { cwd: integrationRoot });
  if (made.code !== 0) throw err("FAILCLOSED", `git branch ${branch} failed in the integration worktree: ${String(made.stderr).trim().slice(0, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: integrationRoot });
  return { branch, sha: head.stdout.trim(), created: true };
}
