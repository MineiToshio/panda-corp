// The pure decision of an owner answer: idempotency against earlier answers, validation and the effects to apply.
import { findUnit, isTerminalUnit } from "../state.mjs";
import { ANSWERABLE_GATES, GATE_REFUSED_REASON, PRODUCTION_MESSAGE } from "./constants.mjs";
import { err, sameValue } from "./common.mjs";
import { discardAssumption } from "./assumption.mjs";
import { planAsk, planGate, planParked } from "./planEffects.mjs";
import { classifyQuestion, fitsAsk } from "./questions.mjs";

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
