// Pure landing logic: merge-queue exit map (D24), batch assessment (D2), card completion and status.yaml scalars.
import { SLUG_RE } from "../card.mjs";
import { REVIEW_TYPE_KINDS } from "../state.mjs";

/** States in which a code unit is complete and waits for the landing. */
const READY_STATES = Object.freeze(["verified", "waiting_gate"]);

/**
 * Merge-queue exit code to landing outcome (D24, PLAN A15). Pure.
 * `exit` is the `land` process exit code (0 OK, 6 hand-back, 7 waiting gate).
 * @param {number} code merge-queue exit code
 * @returns {{result: string, reason: string|null, exit: number}|null} null for an unmapped code (engine failure)
 */
export function mapMergeQueueExit(code) {
  switch (code) {
    case 0: return { result: "landed", reason: null, exit: 0 };
    case 10: return { result: "handback", reason: "rebase_conflict", exit: 6 };
    case 11: return { result: "handback", reason: "g3_red", exit: 6 };
    case 12: return { result: "nothing_to_land", reason: "busy_main", exit: 0 };
    case 13: return { result: "landed", reason: null, exit: 0 };
    case 14: return { result: "nothing_to_land", reason: "port_busy", exit: 0 };
    case 20: return { result: "nothing_to_land", reason: "mq_precondition", exit: 0 };
    case 21: return { result: "waiting_gate", reason: null, exit: 7 };
    default: return null;
  }
}

/**
 * Which units this landing carries and whether the batch is complete (D2: all non-parked units of the run, or of the
 * tranche for a giant run). Pure. Review-type and consult units are ignored; `blocked` and `parked` units do not
 * block a landing (they cannot land); a giant run lets queued units of later tranches wait.
 * @param {object} state a valid state.json
 * @returns {{complete: boolean, landable: object[], blockers: string[]}}
 */
export function assessBatch(state) {
  const giant = state.size === "giant";
  const landable = [];
  const blockers = [];
  for (const unit of state.units) {
    if (REVIEW_TYPE_KINDS.includes(unit.kind) || unit.state === "landed" || unit.state === "blocked" || unit.state === "parked") continue;
    if (READY_STATES.includes(unit.state)) { landable.push(unit); continue; }
    if (unit.state === "integrated" && (unit.kind === "docs" || unit.kind === "tests")) { landable.push(unit); continue; }
    if (unit.state === "queued" && giant) continue;
    blockers.push(unit.id);
  }
  return { complete: blockers.length === 0, landable, blockers };
}

/**
 * Does this landing complete the card (so the metadata commit carries `Change: <slug>`)? Pure.
 * True only for a run with a card whose every non-landing unit is already `landed` (review-type units are ignored).
 * @param {object} state a valid state.json
 * @param {object[]} landable the units this landing carries
 * @returns {string|null} the card slug, or null
 */
export function cardCompletedBy(state, landable) {
  const slug = state.scope?.card ?? null;
  if (!slug || !SLUG_RE.test(slug)) return null;
  if (state.tranche && state.tranche.index < state.tranche.of) return null;
  const carried = new Set(landable.map((u) => u.id));
  const open = state.units.some((u) => !carried.has(u.id) && !REVIEW_TYPE_KINDS.includes(u.kind) && u.state !== "landed");
  return open ? null : slug;
}

/**
 * Set top-level scalar keys in a plain `status.yaml` text (one `key: value` line each, replaced in place or appended).
 * Strings are JSON-quoted, booleans and numbers bare, `phase` bare. Pure.
 * @param {string} text status.yaml content
 * @param {Record<string, string|number|boolean>} updates fixed engine keys only
 */
export function setStatusScalars(text, updates) {
  let body = text;
  for (const [key, raw] of Object.entries(updates)) {
    const value = typeof raw === "boolean" || typeof raw === "number" || key === "phase" ? String(raw) : JSON.stringify(raw);
    const line = `${key}: ${value}`;
    const re = new RegExp(`^${key}:.*$`, "m");
    body = re.test(body) ? body.replace(re, line) : `${body.replace(/\s*$/, "")}\n${line}\n`;
  }
  return body;
}
