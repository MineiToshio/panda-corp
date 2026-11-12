// Constants of the owner-answer command: question kinds, per-unit effects, answerable gates and attempt limits.
/** Question kinds `answer` accepts (CLI 3.13). */
export const ANSWER_KINDS = Object.freeze(["ask", "parked", "gate"]);

/**
 * Per-unit effects of an answer (CLI 3.13). `handed_back` is an extension of the contract's list: an `ask` answer that
 * differs from the default a unit already ran on, when that unit has no execution left (attempt 3), hands it back.
 */
export const ANSWER_EFFECTS = Object.freeze([
  "unblocked", "none_default_matches", "rework_queued", "released", "assumption_accepted", "assumption_discarded", "refused", "handed_back",
]);

/** Gate kinds the owner answers with `answer`; `production` is refused (BUILD-13). */
export const ANSWERABLE_GATES = Object.freeze(["money", "delete", "external"]);

/** Hand-back reason of a gate answered `false` (A20). */
export const GATE_REFUSED_REASON = "owner refused gate";

/** Unit states that have not been dispatched yet: an `ask` answer simply unblocks them. */
export const NOT_DISPATCHED = Object.freeze(["queued", "admitted"]);

export const MAX_EXECUTIONS = 3;

export const PRODUCTION_MESSAGE = "the production gate is not answerable with answer: landing on the default branch is ordered only by the owner's chat order, PANDACORP_OWNER_RELEASE_OK=1 ... land --epoch <E>";
