// `start --run --answers`: reading the argument and applying the owner's first-minute answers to the initial state.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { err, isPlainObject } from "./common.mjs";
import { classifyQuestion, fitsAsk } from "./questions.mjs";

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
