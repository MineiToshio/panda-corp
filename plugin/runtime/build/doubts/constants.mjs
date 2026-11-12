// Constants of the doubt ladder (BUILD-12): caps, confidence levels, veto reasons, ladder steps and option ids.
/** Caps (BUILD-12 constants). */
export const DOUBT_CAPS = Object.freeze({ CONSULTS_PER_DOUBT: 3, CONSULTED_DOUBTS_PER_BUILD: 8 });

/**
 * Consults the ladder itself asks for: consult 1 and the consult 2 tie-break (BUILD-12 steps 1-2; routing has no third
 * consult cell). `CONSULTS_PER_DOUBT` stays the hard cap on recorded consults; after consult 2 without a 2-of-3 winner
 * the doubt parks `no_consensus` (N13).
 */
export const LADDER_CONSULTS = 2;

/** Confidence levels that may decide (BUILD-12: "confidence >= medium"). */
export const DECIDING_CONFIDENCE = Object.freeze(["high", "medium"]);

/** Deterministic reasons a doubt is never decided without the owner (BUILD-12 "Never decided this way"). */
export const VETO_REASONS = Object.freeze(["irreversible", "scope", "money", "human_gate", "requires_owner_dr", "floor_signal", "failclosed"]);

/** Ladder steps a doubt can be answered in. */
export const OPEN_STEPS = Object.freeze(["sources", "consult1", "consult2"]);

/** Option id that means "stop and ask the owner": never an autonomous decision, it parks the doubt (NB1). */
export const ASK_OWNER_OPTION = "ask-owner";

/**
 * Option ids of the doubts the engine SYNTHESIZES from a worker diagnosis (`failure.doubtFromDiagnosis`): every
 * test-defective dispute and every spec-ambiguous doubt shares these ids and preferred option, so only the question
 * (which carries the worker's own detail) tells two of them apart (DR1c-N1).
 */
export const SYNTHESIZED_OPTION_IDS = Object.freeze({ dispute: Object.freeze(["fix-test", "keep-test"]), ambiguity: Object.freeze(["conservative", ASK_OWNER_OPTION]) });

/** Park reasons the engine raises itself (not vetoes, not a ladder outcome): the unit always parks, it never builds on an assumption. */
export const FORCED_PARK_REASONS = Object.freeze(["owner_requested", "repeat_doubt"]);

/** Unit states a doubt can be opened from (a report or review with `status: doubt`, A13). */
export const OPENABLE_STATES = Object.freeze(["running", "reported"]);

export const DOUBT_ID_RE = /^d-(\d{4,})$/;
export const CITATION_RE = /\S+:\d+/;
