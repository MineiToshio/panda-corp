// Input validation of the doubt commands: the worker's doubt object, the input file and the sources/consult answers.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { loadSchema, readJson, validate } from "../fsx.mjs";
import { CITATION_RE } from "./constants.mjs";
import { err, oneLine } from "./common.mjs";

const resolveFile = (file) => (path.isAbsolute(file) ? file : path.resolve(process.cwd(), file));

export async function readInputFile(file, deps) {
  if (typeof file !== "string" || !file) throw err("USAGE", "--file is required");
  try {
    const value = await readJson(resolveFile(file), { required: true, fs: deps.fs ?? fsp });
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not a JSON object");
    return value;
  } catch (error) {
    throw err("INVALID_INPUT", `cannot read ${file}: ${oneLine(error.message, 160)}`);
  }
}

/**
 * Validate a worker's or reviewer's doubt object (`report.schema.json#/properties/doubt`, non-null) and its semantics.
 * @param {unknown} doubt
 * @returns {Promise<{question: string, options: {id: string, text: string}[], preferred: string, why: string}>}
 * @throws INVALID_INPUT
 */
export async function validateDoubtObject(doubt, deps = {}) {
  const schema = (await loadSchema("report", { fs: deps.fs ?? fsp })).properties.doubt;
  const check = validate(schema, doubt);
  if (!check.ok || doubt === null) throw err("INVALID_INPUT", `doubt object invalid: ${doubt === null ? "null" : check.errors.map((e) => `${e.path || "/"} ${e.message}`).join("; ")}`);
  if (!doubt.question.trim()) throw err("INVALID_INPUT", "doubt.question is empty");
  if (!doubt.options.length) throw err("INVALID_INPUT", "doubt.options is empty");
  const ids = doubt.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id.trim())) throw err("INVALID_INPUT", "doubt.options ids must be unique and non-empty");
  if (!ids.includes(doubt.preferred)) throw err("INVALID_INPUT", `doubt.preferred ${JSON.stringify(doubt.preferred)} is not an option id`);
  return doubt;
}

export function validateSourcesAnswer(answer, record) {
  if (!("decision" in answer) || (answer.decision !== null && typeof answer.decision !== "string")) throw err("INVALID_INPUT", "sources answer: decision must be a string or null");
  if (typeof answer.rationale !== "string" || !answer.rationale.trim()) throw err("INVALID_INPUT", "sources answer: rationale must be a non-empty string");
  if (answer.consulted !== null && answer.consulted !== undefined) throw err("INVALID_INPUT", "sources answer: consulted must be null on the sources step");
  if (answer.decision !== null) {
    if (!record.options.some((o) => o.id === answer.decision)) throw err("INVALID_INPUT", `sources answer: ${answer.decision} is not an option of ${record.id}`);
    if (!CITATION_RE.test(answer.rationale)) throw err("INVALID_INPUT", "sources answer: a source hit must cite path:line in rationale");
  }
  return { decision: answer.decision, rationale: answer.rationale.trim() };
}

export async function validateConsultAnswer(answer, record, deps) {
  const check = validate(await loadSchema("doubt-answer", { fs: deps.fs ?? fsp }), answer);
  if (!check.ok) throw err("INVALID_INPUT", `consult answer invalid: ${check.errors.map((e) => `${e.path || "/"} ${e.message}`).join("; ")}`);
  if (answer.decision !== null && !record.options.some((o) => o.id === answer.decision)) throw err("INVALID_INPUT", `consult answer: ${answer.decision} is not an option of ${record.id}`);
  return answer;
}
