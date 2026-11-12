// Question ids and values: classification of a question id, parsing and shape checks of an answer value, the notes a
// unit brief carries for recorded answers, and the run's first-minute questions.
import * as fsp from "node:fs/promises";
import { readJson } from "../fsx.mjs";
import { isDoubtId } from "../doubts.mjs";
import { readJournal } from "../journal.mjs";
import { buildPaths } from "../paths.mjs";
import { err, isPlainObject, sameValue } from "./common.mjs";

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

const questionsOf = (preflight) => {
  const out = new Map();
  for (const check of preflight?.checks ?? []) if (check?.question?.id) out.set(check.question.id, check.question);
  return out;
};

/**
 * The run's first-minute questions by id: the preflight carried by the journal's `run_started` first (it is THIS run's
 * question set), `build/preflight.json` only when the journal has no `run_started` with a preflight (N5: the file belongs
 * to the latest `--preflight`, which after a resume is not necessarily this run's).
 * @param {string} project
 * @param {object} [deps] fs, env, homedir
 * @returns {Promise<Map<string, {id: string, text_es: string, default_es: string, default_action: unknown, affects: object, reversible: boolean}>>}
 * @throws JOURNAL_CHAIN / INVALID_STATE when the journal is corrupt
 */
export async function readQuestions(project, deps = {}) {
  const paths = buildPaths(project, deps);
  const { events } = await readJournal(paths.journalFile, deps);
  const started = events.find((e) => e.type === "run_started");
  if (isPlainObject(started?.data?.preflight)) return questionsOf(started.data.preflight);
  return questionsOf(await readJson(paths.preflightFile, { fs: deps.fs ?? fsp }).catch(() => null));
}
