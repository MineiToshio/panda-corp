// Per-run, hash-chained journal (D15). One line per event; `prev` = sha256 of the previous line's bytes.
// Append only under the epoch holder (the caller holds the lease mutex in phase 2; see state.mjs fencedTwoPhase).
import * as fsp from "node:fs/promises";
import { appendChainedJsonl, assertValid, loadSchema, nowIso, readChainedJsonl } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";

/**
 * Append one event to a journal file.
 * @param {string} file journal path (`buildPaths(project).journalFile`, or an archived run's journal)
 * @param {{run_id: string, epoch: number, actor?: "cli"|"drive", type: string, data?: object, at?: string}} event
 *   `seq`, `prev` and `v` are filled in; `actor` defaults to `cli`, `data` to `{}`, `at` to the engine clock
 * @param {{fs?: object, env?: object, clock?: Function, validate?: boolean}} [deps] `validate:false` only for tests
 * @returns {Promise<{event: object, hash: string}>} the written line (as an object) and its hash
 * @throws INVALID_STATE when the event does not match journal-event.schema.json; JOURNAL_CHAIN on a corrupt file
 */
export async function appendEvent(file, event, deps = {}) {
  const { fs = fsp, validate = true } = deps;
  const at = event.at ?? nowIso(deps);
  const schema = validate ? await loadSchema("journal-event", { fs }) : null;
  const { record, hash } = await appendChainedJsonl(file, ({ seq, prev }) => {
    const line = {
      v: 1, seq, at, run_id: event.run_id, epoch: event.epoch, actor: event.actor ?? "cli",
      type: event.type, data: event.data ?? {}, prev,
    };
    if (schema) assertValid(schema, line, { label: `journal event ${event.type}`, code: "INVALID_STATE" });
    return line;
  }, { fs });
  return { event: record, hash };
}

/**
 * Read a journal, verifying the chain and every line against the schema.
 * @param {string} file journal path
 * @param {{fs?: object, validate?: boolean}} [deps]
 * @returns {Promise<{events: object[], head: {seq: number, hash: string}|null}>} a missing file gives no events
 * @throws JOURNAL_CHAIN (exit 5, hint `rebuild-state`) on a broken chain
 */
export async function readJournal(file, deps = {}) {
  const { fs = fsp, validate = true } = deps;
  const { records, head } = await readChainedJsonl(file, { fs });
  if (validate && records.length) {
    const schema = await loadSchema("journal-event", { fs });
    records.forEach((rec, i) => assertValid(schema, rec, { label: `journal line ${i + 1}`, code: "INVALID_STATE" }));
  }
  return { events: records, head };
}

/**
 * Verify a journal's chain and schema.
 * @returns {Promise<{ok: true, count: number, head: object|null}>}
 * @throws JOURNAL_CHAIN / INVALID_STATE
 */
export async function verifyJournal(file, deps = {}) {
  const { events, head } = await readJournal(file, deps);
  return { ok: true, count: events.length, head };
}

/**
 * Read the journal of an archived (terminal) or suspended run.
 * @param {string} project project root
 * @param {string} runId run id
 * @param {{where?: "archive"|"suspended", fs?: object, env?: object, homedir?: string}} [deps]
 */
export async function readArchivedJournal(project, runId, deps = {}) {
  const p = buildPaths(project, deps);
  const dir = deps.where === "suspended" ? p.buildSuspendedDir(runId) : p.buildArchiveDir(runId);
  return readJournal(`${dir}/journal.jsonl`, deps);
}
