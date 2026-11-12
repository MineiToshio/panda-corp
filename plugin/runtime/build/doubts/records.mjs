// Doubt records (build/doubts/<id>.json, doubt.schema.json): read, write, id allocation and the views other modules use.
import * as fsp from "node:fs/promises";
import { atomicWriteJson, loadSchema, readJson, validate } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import { buildPaths } from "../paths.mjs";
import { modelSlug } from "../routing.mjs";
import { DOUBT_ID_RE } from "./constants.mjs";
import { err, optionText } from "./common.mjs";

/**
 * Read one doubt record.
 * @param {string} project @param {string} id doubt id
 * @param {object} [deps] fs, env, homedir
 * @returns {Promise<object|null>} null when it does not exist
 * @throws INVALID_STATE when the record does not match its schema
 */
export async function readDoubt(project, id, deps = {}) {
  const record = await readJson(buildPaths(project, deps).doubtFile(id), { fs: deps.fs ?? fsp });
  if (record === null) return null;
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `doubt record ${id} is invalid: ${check.errors[0].path} ${check.errors[0].message}`, { hint: "rebuild-state" });
  return record;
}

export async function writeDoubt(project, record, deps) {
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `refusing to write an invalid doubt record ${record.id}: ${check.errors[0].path} ${check.errors[0].message}`);
  await atomicWriteJson(buildPaths(project, deps).doubtFile(record.id), record, { fs: deps.fs ?? fsp });
}

/**
 * Next free doubt id: one above the highest id seen in the record files AND in the journal's `doubt_opened` events
 * (N12: the journal, the inbox entry and an assume branch are written before the record, so a kill between them must
 * not hand the same id to a second doubt).
 */
export async function nextDoubtId(project, deps) {
  const paths = buildPaths(project, deps);
  const fs = deps.fs ?? fsp;
  let names = [];
  try { names = await fs.readdir(paths.doubtsDir); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const ids = names.map((n) => n.match(/^d-(\d{4,})\.json$/)?.[1]).filter(Boolean).map(Number);
  const { events } = await readJournal(paths.journalFile, { fs, validate: false });
  for (const ev of events) {
    const hit = ev.type === "doubt_opened" ? String(ev.data?.doubt_id ?? "").match(DOUBT_ID_RE) : null;
    if (hit) ids.push(Number(hit[1]));
  }
  return `d-${String(Math.max(0, ...ids) + 1).padStart(4, "0")}`;
}

/**
 * The option a unit's brief must carry for its doubt: the decision, or the assumed option of a built-on-assumption park.
 * Used by `units.mjs` when it regenerates the brief of a unit with `doubt_id`.
 * @param {object|null} record doubt record
 * @returns {{value: string, text: string, source: "decided"|"assumption", decided_by: string|null, why: string}|null}
 */
export function briefDecision(record) {
  if (!record) return null;
  if (record.step === "decided" && record.decision) {
    return { value: record.decision.value, text: optionText(record, record.decision.value), source: "decided", decided_by: record.decision.decided_by, why: record.decision.why };
  }
  if (record.assumption) {
    return { value: record.assumption.option, text: optionText(record, record.assumption.option), source: "assumption", decided_by: null, why: `built on assumption on ${record.assumption.branch}; never landed until the owner answers` };
  }
  return null;
}

/**
 * The consult a `doubt-consult` unit carries (for `next`): cell, `via`, brief and report paths, Codex slug for `via:"cli"`.
 * @param {string} project
 * @param {{id: string, kind: string, doubt_id: string|null}} unit a state unit of kind `doubt-consult`
 * @param {object} [deps] fs, env, homedir, tiers
 * @returns {Promise<{doubt_id: string, unit: string, runtime: string, model: string, effort: string, via: "agent"|"cli", model_slug: string|null, brief_path: string, report_path: string, schema_path: string, answered: boolean}>}
 * @throws INVALID_STATE when the unit is not a known consult
 */
export async function pendingConsult(project, unit, deps = {}) {
  if (unit?.kind !== "doubt-consult" || !unit.doubt_id) throw err("INVALID_STATE", `unit ${unit?.id} is not a doubt consult`);
  const record = await readDoubt(project, unit.doubt_id, deps);
  const consult = record?.consults.find((c) => c.unit === unit.id);
  if (!consult) throw err("INVALID_STATE", `doubt ${unit.doubt_id} has no consult ${unit.id}`);
  const paths = buildPaths(project, deps);
  return {
    doubt_id: record.id, unit: unit.id, runtime: consult.runtime, model: consult.model, effort: consult.effort, via: consult.via,
    model_slug: consult.via === "cli" ? modelSlug(consult, deps.tiers ? { tiers: deps.tiers } : undefined) : null,
    brief_path: consult.brief_path, report_path: paths.unitAnswerFile(unit.id), schema_path: paths.schemaFile("doubt-answer"), answered: consult.answer !== null,
  };
}

/** The doubt id pattern (`d-NNNN`). */
export const isDoubtId = (id) => DOUBT_ID_RE.test(String(id ?? ""));
