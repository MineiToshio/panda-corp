// Owner answers of a live v2 build (D19, CLI 3.13, PLAN 3.16 A20): `answer --epoch E --question <id> --value '<json>'`
// for the three question kinds `ask` (first-minute `q-<check id>`), `parked` (a doubt id parked `owner_question` or built
// on assumption) and `gate` (`g-<unit>` of a `money|delete|external` waiting gate), plus `applyStartAnswers` for the
// `--answers` of `start --run`. The production gate is never answerable here: it is ordered only through
// `PANDACORP_OWNER_RELEASE_OK=1 ... land` (BUILD-13). The decision logic is the pure `planAnswer`; `answerCommand`
// applies it under the lease mutex (state, journal, doubt record, the owner's inbox line, a hand-back on a refused gate).
import * as fsp from "node:fs/promises";
import path from "node:path";
import { isDoubtId, readDoubt } from "./doubts.mjs";
import { atomicWriteJson, atomicWriteText, defaultExec, loadSchema, nowIso, readJson, validate, writeTarget } from "./fsx.mjs";
import { readJournal } from "./journal.mjs";
import { releaseParked } from "./park.mjs";
import { buildPaths } from "./paths.mjs";
import { fencedTwoPhase, findUnit, isTerminalUnit, newUnit } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Question kinds `answer` accepts (CLI 3.13). */
export const ANSWER_KINDS = Object.freeze(["ask", "parked", "gate"]);

/**
 * Per-unit effects of an answer (CLI 3.13). `handed_back` is an extension of the contract's list: an `ask` answer that
 * differs from the default a unit already ran on, when that unit has no execution left (attempt 3), hands it back.
 */
export const ANSWER_EFFECTS = Object.freeze([
  "unblocked", "none_default_matches", "rework_queued", "released", "assumption_accepted", "assumption_discarded", "refused", "handed_back",
]);

/** Gate kinds the owner answers with `answer`; `production` is refused (BUILD-13). */
export const ANSWERABLE_GATES = Object.freeze(["money", "delete", "external"]);

/** Hand-back reason of a gate answered `false` (A20). */
export const GATE_REFUSED_REASON = "owner refused gate";

/** Unit states that have not been dispatched yet: an `ask` answer simply unblocks them. */
const NOT_DISPATCHED = Object.freeze(["queued", "admitted"]);

const MAX_EXECUTIONS = 3;

const PRODUCTION_MESSAGE = "the production gate is not answerable with answer: landing on the default branch is ordered only by the owner's chat order, PANDACORP_OWNER_RELEASE_OK=1 ... land --epoch <E>";

// ---------------------------------------------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------------------------------------------

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
};

/** Deep equality of two JSON values (key order ignored). */
export const sameValue = (a, b) => canonical(a) === canonical(b);

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const es = (text) => String(text ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

/**
 * The kind of a question id: `g-<unit>` → gate, a doubt id (`d-NNNN`) → parked, `q-<check id>` → ask.
 * @param {string} id
 * @returns {"ask"|"parked"|"gate"|null} null for an id of no known shape
 */
export function classifyQuestion(id) {
  const s = String(id ?? "");
  if (/^g-.+/.test(s)) return "gate";
  if (isDoubtId(s)) return "parked";
  if (/^q-.+/.test(s)) return "ask";
  return null;
}

/**
 * Parse the raw `--value` argument (JSON text). An already parsed non-string value is returned as is only when
 * `{parsed: true}`; a string is always parsed as JSON (a bare option id must be passed as `'"a"'`).
 * @param {unknown} raw
 * @param {{parsed?: boolean}} [opts]
 * @returns {unknown}
 * @throws USAGE (exit 2) when missing or not valid JSON
 */
export function parseAnswerValue(raw, { parsed = false } = {}) {
  if (raw === undefined || (raw === null && !parsed)) throw err("USAGE", "--value is required");
  if (typeof raw !== "string") {
    if (parsed) return raw;
    throw err("USAGE", "--value must be JSON text");
  }
  if (!raw.trim()) throw err("USAGE", "--value is required");
  try { return JSON.parse(raw); } catch (error) { throw err("USAGE", `--value is not valid JSON: ${error.message}`); }
}

/**
 * Does an `ask` answer fit its question? A boolean, a non-empty string or a plain object (CLI 3.13: "as the ask's
 * `default_action` implies"; first-minute asks carry no option list, so the shape is all that can be checked).
 * @param {unknown} value
 * @returns {boolean}
 */
export const fitsAsk = (value) => typeof value === "boolean" || (typeof value === "string" && value.trim() !== "") || isPlainObject(value);

/**
 * Is an `ask` answer the question's default? `true` (accept the default), the `default_action` token itself, or an
 * object whose `action` is that token.
 * @param {unknown} value
 * @param {{default_action: unknown}} question
 * @returns {boolean}
 */
export function matchesDefault(value, question) {
  if (value === true) return true;
  if (sameValue(value, question?.default_action)) return true;
  return isPlainObject(value) && value.action !== undefined && sameValue(value.action, question?.default_action);
}

const patchIdFor = (unit) => {
  if (unit.wos?.length) return `u-patch-${String(unit.wos[0]).toLowerCase()}`;
  if (unit.frd) return `u-patch-${unit.frd}`;
  return `u-patch-${String(unit.id).replace(/^u-/, "")}`;
};

/** Brief lines for the owner answers that concern one unit (gate OK, first-minute asks whose `affects` covers it). */
function affectsUnit(question, unit) {
  const a = question?.affects;
  if (!a || a.all === true) return true;
  if (Array.isArray(a.frds) && unit.frd && a.frds.includes(unit.frd)) return true;
  const wos = new Set((unit.wos ?? []).map((w) => String(w).toLowerCase()));
  return Array.isArray(a.wos) && a.wos.some((w) => wos.has(String(w).toLowerCase()));
}

/**
 * Notes a unit's brief must carry for the owner's recorded answers (for `units.mjs`/`next.mjs` when they write a brief):
 * the gate OK of `g-<unit>`, and every answered first-minute ask whose `affects` covers the unit. A decided doubt is
 * carried by `doubts.briefDecision`, not here.
 * @param {{answers: object}} state
 * @param {{id: string, frd?: string|null, wos?: string[]}} unit
 * @param {{questions?: Map<string, object>}} [opts] first-minute questions (`readQuestions`)
 * @returns {string[]} English lines (the brief is English)
 */
export function answerNotes(state, unit, { questions = new Map() } = {}) {
  const notes = [];
  const answers = state?.answers ?? {};
  const gate = `g-${unit.id}`;
  if (answers[gate] === true) notes.push(`The owner gave the explicit OK for the human gate of this unit (question ${gate}): you may perform the gated step.`);
  for (const [id, value] of Object.entries(answers)) {
    if (classifyQuestion(id) !== "ask") continue;
    const q = questions.get(id);
    if (q && !affectsUnit(q, unit)) continue;
    notes.push(`Owner answer to ${id}${q ? ` ("${q.text_es}")` : ""}: ${JSON.stringify(value)}${q && matchesDefault(value, q) ? " (the default)" : ""}.`);
  }
  return notes;
}

// ---------------------------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------------------------

const questionsOf = (preflight) => {
  const out = new Map();
  for (const check of preflight?.checks ?? []) if (check?.question?.id) out.set(check.question.id, check.question);
  return out;
};

/**
 * The run's first-minute questions by id, from `build/preflight.json`, falling back to the preflight carried by the
 * journal's `run_started` (CLI 3.13: both keep the question set).
 * @param {string} project
 * @param {object} [deps] fs, env, homedir
 * @returns {Promise<Map<string, {id: string, text_es: string, default_es: string, default_action: unknown, affects: object, reversible: boolean}>>}
 */
export async function readQuestions(project, deps = {}) {
  const paths = buildPaths(project, deps);
  const fromFile = questionsOf(await readJson(paths.preflightFile, { fs: deps.fs ?? fsp }).catch(() => null));
  if (fromFile.size) return fromFile;
  try {
    const { events } = await readJournal(paths.journalFile, deps);
    const started = events.find((e) => e.type === "run_started");
    return questionsOf(started?.data?.preflight);
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The pure decision
// ---------------------------------------------------------------------------------------------------------------

const replace = (state, changed) => ({ ...state, units: state.units.map((u) => changed.get(u.id) ?? u) });

function planAsk({ state, question, value, q }) {
  const changed = new Map();
  const events = [];
  const units = [];
  const handbacks = [];
  const added = [];
  for (const u of state.units) {
    if (u.pending_answer !== question || isTerminalUnit(u)) continue;
    if (u.state === "parked" && u.parked === "owner_question") {
      changed.set(u.id, { ...u, state: "queued", parked: null, pending_answer: null, token_hash: null });
      events.push({ type: "unit_state", data: { unit: u.id, from: "parked", to: "queued" } });
      events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } });
      units.push({ unit: u.id, effect: "released" });
    } else if (NOT_DISPATCHED.includes(u.state)) {
      changed.set(u.id, { ...u, pending_answer: null });
      units.push({ unit: u.id, effect: "unblocked" });
    } else if (matchesDefault(value, q)) {
      changed.set(u.id, { ...u, pending_answer: null });
      units.push({ unit: u.id, effect: "none_default_matches" });
    } else if (u.attempt >= MAX_EXECUTIONS) {
      changed.set(u.id, { ...u, pending_answer: null });
      handbacks.push({ unitId: u.id, reason: `la respuesta del owner a ${question} difiere de la opción por defecto con la que ya se construyó y no quedan ejecuciones` });
      units.push({ unit: u.id, effect: "handed_back" });
    } else {
      changed.set(u.id, { ...u, pending_answer: null });
      const id = patchIdFor(u);
      const existing = findUnit(state, id) ?? added.find((a) => a.id === id);
      if (!existing || isTerminalUnit(existing)) {
        const patch = newUnit({
          id, kind: "patch", wos: [...(u.wos ?? [])], frd: u.frd ?? null, zone: u.zone ?? "none", risk_rules: [...(u.risk_rules ?? [])],
          attempt: u.attempt + 1, depends_on: [u.id],
        });
        added.push(patch);
        events.push({ type: "unit_queued", data: patch });
        events.push({ type: "patch", data: { unit: id, source_answer: question, source_unit: u.id, wos: patch.wos, attempt: patch.attempt } });
      }
      units.push({ unit: u.id, effect: "rework_queued" });
    }
  }
  let next = replace(state, changed);
  if (added.length) {
    const ids = new Set(added.map((a) => a.id));
    next = { ...next, units: [...next.units.filter((u) => !ids.has(u.id)), ...added] };
  }
  return { state: next, events, units, handbacks };
}

/** A unit already executed on the assumption (it holds code on a unit branch), as opposed to one never dispatched. */
const wasBuilt = (u) => u.branch !== null || u.worker !== null || !NOT_DISPATCHED.includes(u.state);

/**
 * The owner rejected an assumption (DEC-7): units built on it are re-queued at attempt+1 with a fresh branch (the
 * branch is derived from the attempt, `lane/<run_id>/<unit>-a<n>`, so the branch holding the rejected code is never
 * reused); a unit already at attempt 3 is handed back (`answer_rework_budget`, effect `handed_back`). A unit never
 * dispatched only loses its assumption flags and stays at its attempt. Effect `assumption_discarded` otherwise.
 * @returns {{state: object, events: object[], units: {unit: string, effect: string}[], handbacks: {unitId: string, reason: string, reasonCode: string}[]}}
 */
function discardAssumption(state, targets, question) {
  const changed = new Map();
  const events = [];
  const units = [];
  const handbacks = [];
  for (const u of targets) {
    const built = wasBuilt(u);
    if (built && u.attempt >= MAX_EXECUTIONS) {
      changed.set(u.id, { ...u, parked: null, pending_answer: null });
      events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } });
      handbacks.push({ unitId: u.id, reasonCode: "answer_rework_budget", reason: `el owner rechazó la suposición de ${question} y la unidad no tiene más ejecuciones` });
      units.push({ unit: u.id, effect: "handed_back" });
      continue;
    }
    const requeued = {
      ...u, state: "queued", attempt: built ? u.attempt + 1 : u.attempt, parked: null, pending_answer: null,
      token_hash: null, worker: null, worktree: null, branch: null, review: null,
    };
    changed.set(u.id, requeued);
    if (u.state !== "queued") events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to: "queued" } });
    events.push({ type: "unit_queued", data: requeued });
    units.push({ unit: u.id, effect: "assumption_discarded" });
  }
  return { state: replace(state, changed), events, units, handbacks };
}

function planParked({ state, question, value, record }) {
  const decided = { ...record, step: "decided", decision: { value, why: "owner answer", decided_by: "owner" } };
  const changed = new Map();
  const events = [];
  const units = [];
  if (record.assumption) {
    const accepted = value === record.assumption.option;
    const discarded = [];
    for (const u of state.units) {
      if (u.parked !== "built_on_assumption" || u.pending_answer !== question || isTerminalUnit(u)) continue;
      if (accepted) {
        changed.set(u.id, { ...u, parked: null, pending_answer: null });
        events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } });
        units.push({ unit: u.id, effect: "assumption_accepted" });
      } else {
        discarded.push(u);
      }
    }
    if (!accepted) {
      const plan = discardAssumption(state, discarded, question);
      return { ...plan, record: decided, assumption: { accepted, branch: record.assumption.branch, option: record.assumption.option } };
    }
    return { state: replace(state, changed), events, units, handbacks: [], record: decided, assumption: { accepted, branch: record.assumption.branch, option: record.assumption.option } };
  }
  const released = releaseParked(state, question);
  return { state: released.state, events: released.events, units: released.units.map((unit) => ({ unit, effect: "released" })), handbacks: [], record: decided, assumption: null };
}

function planGate({ state, unit, value }) {
  if (value === false) {
    return { state, events: [], units: [{ unit: unit.id, effect: "refused" }], handbacks: [{ unitId: unit.id, reason: GATE_REFUSED_REASON }] };
  }
  const next = replace(state, new Map([[unit.id, { ...unit, state: "queued", waiting_gate: null, pending_answer: null, token_hash: null }]]));
  return {
    state: next,
    events: [
      { type: "unit_state", data: { unit: unit.id, from: "waiting_gate", to: "queued" } },
      { type: "waiting_gate", data: { unit: unit.id, kind: null } },
    ],
    units: [{ unit: unit.id, effect: "released" }],
    handbacks: [],
  };
}

/** Effects that always mean the units already acted on an answer (RULINGS-C2 ANS-M1). */
const ACTED_EFFECTS = Object.freeze(["none_default_matches", "rework_queued", "handed_back", "refused", "assumption_discarded"]);

/** States in which a unit that was `unblocked`/`released` has not acted yet (it was not admitted or further). */
const NOT_ACTED_STATES = Object.freeze(["queued", "parked", "waiting_gate"]);

/**
 * Did the units already act on the previous answer of a question (CLI 3.13 idempotency, RULINGS-C2 ANS-M1)?
 * Effects none_default_matches / rework_queued / handed_back / refused / assumption_discarded: acted; assumption_accepted:
 * acted iff the assumption branch is merged; unblocked / released: acted iff that unit's current state is not
 * queued / parked / waiting_gate; no previous units: not acted.
 * @param {{value: unknown, units: {unit: string, effect: string}[]}|null} previous the last `answer_recorded` data of the question
 * @param {{units: object[]}} state current run state
 * @param {boolean} [assumptionMerged] the assume branch is an ancestor of the integration branch
 * @returns {boolean}
 */
export function actedOn(previous, state, assumptionMerged = false) {
  for (const { unit, effect } of previous?.units ?? []) {
    if (ACTED_EFFECTS.includes(effect)) return true;
    if (effect === "assumption_accepted") { if (assumptionMerged) return true; continue; }
    if (effect === "unblocked" || effect === "released") {
      const u = findUnit(state, unit);
      if (u && !NOT_ACTED_STATES.includes(u.state)) return true;
    }
  }
  return false;
}

/** Re-plan a different answer that replaces an earlier one nobody acted on yet (RULINGS-C2 ANS-M1). */
function planReplace({ kind, state, question, value, previous, doubt, questions }) {
  const prevUnits = previous?.units ?? [];
  if (kind === "gate") {
    // A not-yet-dispatched OK becomes a refusal (true -> false); a refusal always acted (refused), so it never gets here.
    const unitId = question.slice(2);
    return value === false
      ? { state, events: [], units: [{ unit: unitId, effect: "refused" }], handbacks: [{ unitId, reason: GATE_REFUSED_REASON }], record: null, assumption: null }
      : { state, events: [], units: [{ unit: unitId, effect: "released" }], handbacks: [], record: null, assumption: null };
  }
  if (kind === "parked") {
    const record = { ...doubt, step: "decided", decision: { value, why: "owner answer", decided_by: "owner" } };
    if (doubt.assumption && prevUnits.some((p) => p.effect === "assumption_accepted") && value !== doubt.assumption.option) {
      const targets = prevUnits.map(({ unit }) => findUnit(state, unit)).filter((u) => u && !isTerminalUnit(u));
      const plan = discardAssumption(state, targets, question);
      return { ...plan, record, assumption: { accepted: false, branch: doubt.assumption.branch, option: doubt.assumption.option } };
    }
    const assumption = doubt.assumption ? { accepted: value === doubt.assumption.option, branch: doubt.assumption.branch, option: doubt.assumption.option } : null;
    return { state, events: [], units: prevUnits.map(({ unit }) => ({ unit, effect: "released" })), handbacks: [], record, assumption };
  }
  // ask: the briefs are written at dispatch, so units that have not acted simply carry the new value.
  const fresh = planAsk({ state, question, value, q: questions.get(question) });
  const listed = new Set(fresh.units.map((u) => u.unit));
  const units = [...fresh.units, ...prevUnits.filter(({ unit }) => !listed.has(unit) && findUnit(state, unit)).map(({ unit }) => ({ unit, effect: "unblocked" }))];
  return { ...fresh, units, record: null, assumption: null };
}

/**
 * Decide what an owner answer does (pure; nothing is written). Order: kind of id; production gate refused; idempotency
 * against `state.answers` (same value -> `already_answered`; a different value -> `superseded_by_earlier_answer` only
 * when units already acted on the first, see `actedOn`; otherwise the new value replaces it); validation; effects.
 * @param {{state: object, question: string, value: unknown, questions?: Map<string, object>, doubt?: object|null,
 *   previous?: {value: unknown, units: {unit: string, effect: string}[]}|null, assumptionMerged?: boolean}} input
 *   `questions` = first-minute questions (`readQuestions`); `doubt` = the doubt record for a `parked` id (`readDoubt`);
 *   `previous` = the last `answer_recorded` data of this question (null: derived as `{value: state.answers[id], units: []}`);
 *   `assumptionMerged` = the doubt's assume branch is an ancestor of the integration branch
 * @returns {{kind: "ask"|"parked"|"gate", applied: boolean, reason: null|"already_answered"|"superseded_by_earlier_answer",
 *   replaced: boolean, state: object, events: {type: string, data: object}[], units: {unit: string, effect: string}[],
 *   handbacks: {unitId: string, reason: string}[], record?: object|null, assumption?: {accepted: boolean, branch: string, option: string}|null}}
 *   `state` already carries `answers[question] = value`; `events` are the per-unit events, to journal AFTER `answer_recorded`;
 *   `handbacks` are applied after the state and events (failure.mjs `handBack`, R4: the unit and its dependents end `blocked`)
 * @throws INVALID_INPUT (exit 6) for an unknown id, a value that does not fit, or the production gate
 */
export function planAnswer({ state, question, value, questions = new Map(), doubt = null, previous = null, assumptionMerged = false }) {
  if (typeof question !== "string" || !question) throw err("USAGE", "--question is required");
  const kind = classifyQuestion(question);
  if (!kind) throw err("INVALID_INPUT", `unknown question ${question}: ids are q-<check id>, a doubt id or g-<unit>`);
  const answers = state.answers ?? {};
  const gateUnit = kind === "gate" ? findUnit(state, question.slice(2)) : null;
  if (kind === "gate" && gateUnit?.waiting_gate === "production") throw err("INVALID_INPUT", PRODUCTION_MESSAGE);
  const atGateNow = gateUnit?.state === "waiting_gate";
  const noop = (reason) => ({ kind, applied: false, reason, replaced: false, state, events: [], units: [], handbacks: [], record: null, assumption: null });
  const withAnswer = { ...state, answers: { ...answers, [question]: value } };
  const reanswer = Object.hasOwn(answers, question) && !(kind === "gate" && atGateNow);

  if (reanswer) {
    if (sameValue(answers[question], value)) return noop("already_answered");
    const prev = previous ?? { value: answers[question], units: [] };
    if (actedOn(prev, state, assumptionMerged)) return noop("superseded_by_earlier_answer");
    if (kind === "gate" && typeof value !== "boolean") throw err("INVALID_INPUT", `a gate answer is true (OK) or false (refused), got ${JSON.stringify(value)}`);
    if (kind === "parked") {
      if (!doubt || doubt.id !== question) throw err("INVALID_INPUT", `unknown question ${question}: no doubt record of this run`);
      if (typeof value !== "string" || !doubt.options.some((o) => o.id === value)) throw err("INVALID_INPUT", `the answer to ${question} must be one of its option ids, got ${JSON.stringify(value)}`);
    }
    if (kind === "ask") {
      if (!questions.has(question)) throw err("INVALID_INPUT", `unknown question ${question}: not in this run's first-minute questions`);
      if (!fitsAsk(value)) throw err("INVALID_INPUT", `the answer to ${question} must be a boolean, a non-empty string or an object, got ${JSON.stringify(value)}`);
    }
    return { kind, applied: true, reason: null, replaced: true, ...planReplace({ kind, state: withAnswer, question, value, previous: prev, doubt, questions }) };
  }

  if (kind === "gate") {
    if (!gateUnit || !atGateNow || !gateUnit.waiting_gate) throw err("INVALID_INPUT", `unknown question ${question}: no unit of this run waits at a gate under that id`);
    if (!ANSWERABLE_GATES.includes(gateUnit.waiting_gate)) throw err("INVALID_INPUT", `gate ${gateUnit.waiting_gate} of ${gateUnit.id} is not answerable with answer`);
    if (typeof value !== "boolean") throw err("INVALID_INPUT", `a gate answer is true (OK) or false (refused), got ${JSON.stringify(value)}`);
    return { kind, applied: true, reason: null, replaced: false, record: null, assumption: null, ...planGate({ state: withAnswer, unit: findUnit(withAnswer, gateUnit.id), value }) };
  }

  if (kind === "parked") {
    if (!doubt || doubt.id !== question) throw err("INVALID_INPUT", `unknown question ${question}: no doubt record of this run`);
    if (doubt.step !== "parked") throw err("INVALID_INPUT", `doubt ${question} is ${doubt.step}: only a parked doubt is answered by the owner`);
    if (typeof value !== "string" || !doubt.options.some((o) => o.id === value)) {
      throw err("INVALID_INPUT", `the answer to ${question} must be one of its option ids (${doubt.options.map((o) => JSON.stringify(o.id)).join(", ")}), got ${JSON.stringify(value)}`);
    }
    return { kind, applied: true, reason: null, replaced: false, ...planParked({ state: withAnswer, question, value, record: doubt }) };
  }

  const q = questions.get(question);
  if (!q) throw err("INVALID_INPUT", `unknown question ${question}: not in this run's first-minute questions`);
  if (!fitsAsk(value)) throw err("INVALID_INPUT", `the answer to ${question} must be a boolean, a non-empty string or an object, got ${JSON.stringify(value)}`);
  return { kind, applied: true, reason: null, replaced: false, record: null, assumption: null, ...planAsk({ state: withAnswer, question, value, q }) };
}

// ---------------------------------------------------------------------------------------------------------------
// start --run --answers
// ---------------------------------------------------------------------------------------------------------------

/**
 * Read the `--answers` argument of `start --run`: an inline JSON object or a path to a JSON file.
 * @param {string|object|null|undefined} raw
 * @param {object} [deps] fs
 * @returns {Promise<object>} `{}` when absent
 * @throws USAGE when it is neither a JSON object nor a readable JSON file holding one
 */
export async function readAnswersArg(raw, deps = {}) {
  if (raw === undefined || raw === null || raw === "") return {};
  if (isPlainObject(raw)) return raw;
  const text = String(raw).trim();
  let value;
  if (text.startsWith("{")) {
    try { value = JSON.parse(text); } catch (error) { throw err("USAGE", `--answers is not valid JSON: ${error.message}`); }
  } else {
    try { value = JSON.parse(await (deps.fs ?? fsp).readFile(path.resolve(text), "utf8")); } catch (error) { throw err("USAGE", `--answers: cannot read ${text}: ${error.message}`); }
  }
  if (!isPlainObject(value)) throw err("USAGE", "--answers must be a JSON object keyed by question id");
  return value;
}

/**
 * Apply the owner's first-minute answers to a run's initial state (pure; `start --run` step 7, before `run_started`
 * is journaled, so the answers travel inside the initial state and need no event). Every answer goes to
 * `state.answers`; units whose `pending_answer` is an answered question have it cleared (effect `unblocked`).
 * @param {object} state the initial run state (units already queued from the plan)
 * @param {{answers: object, questions: Map<string, object>}} input `questions` = the preflight's question set
 * @returns {{state: object, applied: {question: string, value: unknown, units: {unit: string, effect: "unblocked"}[]}[]}}
 * @throws INVALID_INPUT (exit 6) for an id that is not a first-minute ask of this preflight, or a value that does not fit
 */
export function applyStartAnswers(state, { answers = {}, questions = new Map() } = {}) {
  if (!isPlainObject(answers)) throw err("INVALID_INPUT", "answers must be an object keyed by question id");
  const applied = [];
  let next = { ...state, answers: { ...(state.answers ?? {}) } };
  for (const [question, value] of Object.entries(answers)) {
    if (classifyQuestion(question) !== "ask" || !questions.has(question)) throw err("INVALID_INPUT", `answer for ${question}: not a first-minute question of this preflight`);
    if (!fitsAsk(value)) throw err("INVALID_INPUT", `answer for ${question} must be a boolean, a non-empty string or an object, got ${JSON.stringify(value)}`);
    next.answers[question] = value;
    const units = [];
    next = {
      ...next,
      units: next.units.map((u) => {
        if (u.pending_answer !== question) return u;
        units.push({ unit: u.id, effect: "unblocked" });
        return { ...u, pending_answer: null };
      }),
    };
    applied.push({ question, value, units });
  }
  return { state: next, applied };
}

// ---------------------------------------------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------------------------------------------

async function writeDoubtRecord(project, record, deps) {
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `refusing to write an invalid doubt record ${record.id}: ${check.errors[0].path} ${check.errors[0].message}`);
  await atomicWriteJson(buildPaths(project, deps).doubtFile(record.id), record, { fs: deps.fs ?? fsp });
}

/**
 * Mark the doubt's entry of `.pandacorp/inbox/decisions.md` as answered (best effort: a missing entry changes nothing).
 * A tracked inbox is written in the integration worktree and committed there (D1).
 */
async function markInboxAnswered(project, integrationRoot, { id, value, date }, deps) {
  const fs = deps.fs ?? fsp;
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  let text;
  try { text = await fs.readFile(abs, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const marker = `- **Id:** \`${id}\``;
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const end = text.slice(at).search(/\n## /);
  const block = end < 0 ? text.slice(at) : text.slice(at, at + end);
  const status = `- **Estado:** RESUELTO: respondido por el owner, opción ${es(value)} (${date}).`;
  const updated = block.replace(/^- \*\*Estado:\*\*.*$/m, status);
  if (updated === block) return null;
  await atomicWriteText(abs, `${text.slice(0, at)}${updated}${end < 0 ? "" : text.slice(at + end)}`, { fs, mode: 0o644 });
  if (!tracked) return { rel, commit: null };
  const exec = deps.exec ?? defaultExec;
  let add = await exec("git", ["add", "-u", "--", rel], { cwd: integrationRoot });
  if (add.code !== 0) add = await exec("git", ["add", "-f", "--", rel], { cwd: integrationRoot });
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${String(add.stderr).trim().slice(0, 200)}`);
  const commit = await exec("git", ["commit", "-q", "-m", `chore(build): owner answered ${id}\n\nDoubt: ${id}\n`, "--", rel], { cwd: integrationRoot });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${String(commit.stderr || commit.stdout).trim().slice(0, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: integrationRoot });
  return { rel, commit: head.stdout.trim() };
}

/** The data of the last `answer_recorded` of one question in the run journal, or null. */
async function lastAnswer(journalFile, question, deps) {
  const { events } = await readJournal(journalFile, deps);
  const hit = events.filter((e) => e.type === "answer_recorded" && e.data?.question === question).pop();
  return hit ? { value: hit.data.value, units: hit.data.units ?? [] } : null;
}

/**
 * Read-only check that an assume branch is merged into the integration branch (`git merge-base --is-ancestor`).
 * This module never merges: integrate.mjs does. An unreadable answer counts as merged (the conservative reading:
 * the earlier answer then stands as acted on).
 */
async function isAncestor(root, branch, target, deps) {
  if (deps.isAncestor) return deps.isAncestor({ root, branch, target });
  const res = await (deps.exec ?? defaultExec)("git", ["merge-base", "--is-ancestor", `refs/heads/${branch}`, `refs/heads/${target}`], { cwd: root });
  return res.code !== 1;
}

/**
 * `answer --epoch E --question <id> --value '<json>'` (fenced; one phase under the lease mutex). Effects in order:
 * validate; write `state.answers[id]`; journal `answer_recorded {question, kind, value, units}`; update the affected
 * units (journaled after it); a `parked` answer writes the doubt record (`decision` by `owner`, `step: decided`) and
 * marks its inbox entry answered; a gate answered `false` hands the unit back (its dependents end `blocked`, R4).
 * @param {{project: string, epoch: number, question: string, value: string|unknown, parsed?: boolean}} input `value` is
 *   the raw JSON text of `--value` (pass `parsed: true` to hand an already parsed value)
 * @param {object} [deps] fs, env, homedir, clock, exec, buildState, emit (passed on to `failure.handBack`)
 * @returns {Promise<{ok: true, cmd: "answer", question: string, kind: "ask"|"parked"|"gate", applied: boolean,
 *   units: {unit: string, effect: string}[], reason: string|null, blocked?: string[], assumption?: object, warnings?: string[]}>}
 * @throws USAGE (exit 2: missing epoch/question/value, invalid JSON), FENCE (exit 3), INVALID_INPUT (exit 6: unknown
 *   id, value that does not fit, production gate), INVALID_STATE (exit 5: no run state)
 */
export async function answerCommand({ project, epoch, question, value: raw, parsed = false }, deps = {}) {
  if (epoch === undefined || epoch === null || Number.isNaN(Number(epoch))) throw err("USAGE", "--epoch is required");
  if (typeof question !== "string" || !question.trim()) throw err("USAGE", "--question is required");
  const value = parseAnswerValue(raw, { parsed });
  const kind = classifyQuestion(question);
  return fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps }, undefined, undefined, async (_r, _i, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no run state: start the run first");
    const questions = kind === "ask" ? await readQuestions(project, deps) : new Map();
    const doubt = kind === "parked" ? await readDoubt(project, question, deps) : null;
    let previous = null;
    let assumptionMerged = false;
    if (Object.hasOwn(state.answers ?? {}, question)) {
      previous = await lastAnswer(ctx.paths.journalFile, question, deps);
      if (doubt?.assumption) assumptionMerged = await isAncestor(path.resolve(project, state.integration.worktree), doubt.assumption.branch, state.integration.branch, deps);
    }
    const plan = planAnswer({ state, question, value, questions, doubt, previous, assumptionMerged });
    const out = { ok: true, cmd: "answer", question, kind: plan.kind, applied: plan.applied, units: plan.units, reason: plan.reason, ...(plan.replaced ? { replaced: true } : {}) };
    if (!plan.applied) return out;

    const warnings = [];
    if (plan.record) await writeDoubtRecord(project, plan.record, deps);
    await ctx.writeState(plan.state);
    await ctx.appendEvent({ type: "answer_recorded", data: { question, kind: plan.kind, value, units: plan.units } });
    for (const event of plan.events) await ctx.appendEvent(event);

    const blocked = [];
    if (plan.handbacks.length) {
      const { handBack } = await import("./failure.mjs");
      for (const hb of plan.handbacks) {
        const res = await handBack(ctx, { unitId: hb.unitId, cause: "owner", reasonCode: hb.reasonCode ?? (plan.kind === "gate" ? "owner_refused_gate" : "answer_rework_budget"), reason: hb.reason }, deps);
        blocked.push(...res.blocked.map((b) => b.unit));
        if (res.warnings) warnings.push(...res.warnings);
      }
    }

    if (plan.kind === "parked") {
      try {
        await markInboxAnswered(project, path.resolve(project, state.integration.worktree), { id: question, value, date: nowIso(deps).slice(0, 10) }, deps);
      } catch (error) {
        warnings.push(`decisions.md not updated: ${String(error.message).slice(0, 160)}`);
      }
    }
    return {
      ...out,
      ...(blocked.length ? { blocked } : {}),
      ...(plan.assumption ? { assumption: plan.assumption } : {}),
      ...(warnings.length ? { warnings } : {}),
    };
  });
}
