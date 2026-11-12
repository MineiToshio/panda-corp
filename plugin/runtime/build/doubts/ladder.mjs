// The pure part of the doubt ladder (BUILD-12): the tally of consults and the reversibility of the preferred option.
import { DECIDING_CONFIDENCE, LADDER_CONSULTS, VETO_REASONS } from "./constants.mjs";

/**
 * What the ladder does after the consults recorded so far (BUILD-12): decide when consult 1 agrees with the preferred
 * option at confidence >= medium; else a tie-break consult; after it, the option with 2 of 3 votes wins (the author's
 * preferred option is one vote; a consult votes only with a non-null decision at confidence >= medium); no winner after
 * consult 2 parks `no_consensus`. Any answered consult (voting or not) that chose the winning or preferred option and
 * called it irreversible parks the doubt `consult_irreversible`. Caps are applied by the caller.
 * @param {object} record doubt record
 * @returns {{action: "decide", value: string, decided_by: "consult1"|"consult2", voters: object[]}
 *   | {action: "consult", no: number} | {action: "park", reason: string}}
 */
export function tally(record) {
  const answered = record.consults.filter((c) => c.answer !== null);
  const n = answered.length;
  if (n === 0) return { action: "consult", no: 1 };
  const voting = answered.filter((c) => c.answer.decision !== null && DECIDING_CONFIDENCE.includes(c.answer.confidence));
  if (n === 1) {
    const c1 = answered[0].answer;
    if (c1.decision === record.preferred && c1.reversible === false) return { action: "park", reason: "consult_irreversible" };
    if (voting.length === 1 && c1.decision === record.preferred) return { action: "decide", value: record.preferred, decided_by: "consult1", voters: voting };
    return { action: "consult", no: 2 };
  }
  const votes = new Map([[record.preferred, 1]]);
  for (const c of voting) votes.set(c.answer.decision, (votes.get(c.answer.decision) ?? 0) + 1);
  const winner = [...votes.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!winner) return n >= LADDER_CONSULTS ? { action: "park", reason: "no_consensus" } : { action: "consult", no: n + 1 };
  const voters = voting.filter((c) => c.answer.decision === winner);
  if (voters.some((c) => c.answer.reversible !== true)) return { action: "park", reason: "consult_irreversible" };
  if (answered.some((c) => c.answer.decision === winner && c.answer.reversible === false)) return { action: "park", reason: "consult_irreversible" };
  return { action: "decide", value: winner, decided_by: n >= 2 ? "consult2" : "consult1", voters };
}

/**
 * Is the preferred option reversible for the root rule? No veto, and no consult that voted for it called it irreversible.
 * @param {object} record @param {{vetoed?: boolean, reason?: string}} [ctx]
 * @returns {boolean}
 */
export function preferredReversible(record, { vetoed = false, reason = null } = {}) {
  if (vetoed || reason === "consult_irreversible" || VETO_REASONS.includes(reason)) return false;
  return !record.consults.some((c) => c.answer && c.answer.decision === record.preferred && c.answer.reversible === false);
}
