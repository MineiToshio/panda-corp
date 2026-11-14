// Advancing the doubt ladder after its record changed: decide, queue the next consult, or park; and the command output.
import { FORCED_PARK_REASONS, ASK_OWNER_OPTION, VETO_REASONS } from "./constants.mjs";
import { cellText } from "./common.mjs";
import { queueConsult } from "./consult.mjs";
import { decide, park, settledOut, settledUnit } from "./effects.mjs";
import { preferredReversible, tally } from "./ladder.mjs";

/**
 * Advance the ladder after the record changed (an answer was filed): decide, queue the next consult, or park.
 * @returns {Promise<{state: object, record: object, out: object}>}
 */
export async function advance(ctx, state, record, deps) {
  if (settledUnit(state, record)) return settledOut(state, record);
  const verdict = tally(record);
  if (verdict.action === "decide" && verdict.value === ASK_OWNER_OPTION) return parkOut(ctx, state, record, ["owner_requested"], deps);
  if (verdict.action === "decide") {
    const why = verdict.voters.map((c) => `${cellText(c)}: ${c.answer.rationale}`).join(" | ");
    const done = await decide(ctx, state, record, { value: verdict.value, decided_by: verdict.decided_by, why, voters: verdict.voters }, deps);
    if (done.applied === false) return settledOut(state, record);
    return { state: done.state, record: done.record, out: { step: "decided", decision: done.decision, sha: done.sha, warnings: done.warnings } };
  }
  if (verdict.action === "consult") {
    const queued = await queueConsult(ctx, state, record, verdict.no, deps);
    if (queued.wait) return { state, record: { ...record, capacity_wait: queued.wait }, out: { step: record.step, wait: queued.wait } };
    if (!queued.park) return { state: queued.state, record: queued.record, out: { step: queued.record.step, consult: queued.consult } };
    return parkOut(ctx, state, record, [queued.park], deps);
  }
  return parkOut(ctx, state, record, [verdict.reason], deps);
}

export async function parkOut(ctx, state, record, reasons, deps) {
  if (settledUnit(state, record)) return settledOut(state, record);
  const reversible = preferredReversible(record, { reason: reasons[0] }) && !reasons.some((r) => VETO_REASONS.includes(r) || FORCED_PARK_REASONS.includes(r) || r === "consult_irreversible");
  const parked = await park(ctx, state, record, { reasons, reversible }, deps);
  return {
    state: parked.state, record: parked.record,
    out: parked.record.step === "decided"
      ? { step: "decided", decision: parked.record.decision, warnings: parked.warnings }
      : { step: "parked", parked: { mode: parked.mode, reasons, units: parked.units, branch: parked.branch, ratio: parked.block.ratio }, notice_es: parked.notice_es, warnings: parked.warnings },
  };
}

export function output(sub, record, out) {
  return {
    ok: true, cmd: "doubt", sub, doubt_id: record.id, step: record.step,
    ...(out.wait ? { wait: out.wait } : {}),
    ...(out.consult ? { consult: out.consult } : {}),
    decision: record.step === "decided" ? record.decision : null,
    ...(out.parked ? { parked: out.parked } : {}),
    ...(out.notice_es ? { notice_es: out.notice_es } : {}),
    ...(out.applied === false ? { applied: false, reason: out.reason } : {}),
    ...(out.warnings?.length ? { warnings: out.warnings } : {}),
  };
}
