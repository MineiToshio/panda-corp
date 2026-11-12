// Rejecting an assumption (DEC-7): which units were built on it, how they are re-queued or handed back, and which live
// workers must be stopped.
import { isDoubtId } from "../doubts.mjs";
import { withoutAssumedOn } from "../park.mjs";
import { MAX_EXECUTIONS, NOT_DISPATCHED } from "./constants.mjs";
import { replace } from "./common.mjs";

/**
 * A unit already executed on the assumption `question` (it holds code built on it), judged by its STATE and doubt ids
 * (N14), never by a branch or worker left over from an earlier dispatch. A unit past dispatch (running, reported,
 * committed...) holds some. A `queued|admitted|parked` unit holds some only when its own doubt was raised AFTER the
 * assumption (doubt ids are monotonic): it was dispatched on the assumption and raised a second doubt (B6), whether it is
 * still parked on it or was released by its answer. The assumed root waiting to be rebuilt (`doubt_id` = the assumption)
 * and a dependent parked or queued before dispatch hold none.
 * @param {object} u unit @param {string} question the assumption's doubt id
 * @returns {boolean}
 */
const wasBuilt = (u, question) => {
  if (![...NOT_DISPATCHED, "parked"].includes(u.state)) return true;
  return isDoubtId(u.doubt_id) && isDoubtId(question) && Number(u.doubt_id.slice(2)) > Number(question.slice(2));
};

/** States in which a unit holds an admission reservation and may have a live worker. */
const LIVE_STATES = Object.freeze(["admitted", "running"]);

/** Worker ids of a live unit: its own dispatch record and any running worker job of it. */
const liveWorkers = (state, u) => [...new Set([u.worker?.worker_id, ...(state.jobs ?? []).filter((j) => j.unit === u.id && j.kind === "worker" && j.state === "running").map((j) => j.worker_id)].filter(Boolean))];

/**
 * The owner rejected an assumption (DEC-7): units built on it are re-queued at attempt+1 with a fresh branch (the
 * branch is derived from the attempt, `lane/<run_id>/<unit>-a<n>`, so the branch holding the rejected code is never
 * reused); a unit already at attempt 3 is handed back (`answer_rework_budget`, effect `handed_back`). A unit never
 * dispatched only loses its assumption flags and stays at its attempt. Effect `assumption_discarded` otherwise. A
 * target parked meanwhile on another question (its assumption kept in `assumed_on`, B6) is re-queued too: the code that
 * raised that question is the rejected code. A target that is `admitted|running` loses its admission reservation
 * (`release`) and its live workers are listed in `stop` for the caller to stop after the fenced phase (N14).
 * @returns {{state: object, events: object[], units: {unit: string, effect: string}[], handbacks: {unitId: string, reason: string, reasonCode: string}[],
 *   release: string[], stop: string[]}}
 */
export function discardAssumption(state, targets, question) {
  const changed = new Map();
  const events = [];
  const units = [];
  const handbacks = [];
  const release = [];
  const stop = [];
  for (const u of targets) {
    if (LIVE_STATES.includes(u.state)) { release.push(u.id); stop.push(...liveWorkers(state, u)); }
    const built = wasBuilt(u, question);
    if (built && u.attempt >= MAX_EXECUTIONS) {
      changed.set(u.id, { ...withoutAssumedOn(u), parked: null, pending_answer: null });
      events.push({ type: "parked", data: { unit: u.id, reason: null, question: null } });
      handbacks.push({ unitId: u.id, reasonCode: "answer_rework_budget", reason: `el owner rechazó la suposición de ${question} y la unidad no tiene más ejecuciones` });
      units.push({ unit: u.id, effect: "handed_back" });
      continue;
    }
    const requeued = {
      ...withoutAssumedOn(u), state: "queued", attempt: built ? u.attempt + 1 : u.attempt, parked: null, pending_answer: null,
      token_hash: null, worker: null, worktree: null, branch: null, review: null,
    };
    changed.set(u.id, requeued);
    if (u.state !== "queued") events.push({ type: "unit_state", data: { unit: u.id, from: u.state, to: "queued" } });
    events.push({ type: "unit_queued", data: requeued });
    units.push({ unit: u.id, effect: "assumption_discarded" });
  }
  return { state: replace(state, changed), events, units, handbacks, release, stop };
}
