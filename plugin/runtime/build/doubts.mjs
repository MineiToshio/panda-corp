// The doubt ladder of the v2 build engine (BUILD-12, D20, PLAN 3.16 A7): sources -> consult 1 (the other company) ->
// consult 2 (tie-break) -> decided | parked. The CLI never asks the owner and never lets a model judge
// irreversibility: the veto is deterministic (risk.mjs on the unit's files, classify-change.mjs on the doubt text,
// fixed scope/gate patterns, DRs with `requiere_humano`). A consult is dispatched ONLY as a `doubt-consult` unit that
// `next` serves; the `consult` object returned here only announces it. Every autonomous decision is recorded on the
// integration branch ("Decidido sin el owner", with how to revert) and in the owner's inbox.
// This file is the public entry; the ladder is split by responsibility under `./doubts/` (constants, common, input,
// records, veto, ladder, texts, integrationLog, consult, effects, advance, repeat, open, answer, command).

export { DECIDING_CONFIDENCE, DOUBT_CAPS, ASK_OWNER_OPTION, SYNTHESIZED_OPTION_IDS, VETO_REASONS } from "./doubts/constants.mjs";
export { consultOrigin, sourcesSkipped } from "./doubts/common.mjs";
export { validateDoubtObject } from "./doubts/input.mjs";
export { briefDecision, isDoubtId, pendingConsult, readDoubt, rerouteConsult } from "./doubts/records.mjs";
export { assessVeto, classifyText, drsRequiringOwner, readWoArtifacts, vetoReasons } from "./doubts/veto.mjs";
export { preferredReversible, tally } from "./doubts/ladder.mjs";
export { isRepeatDoubt } from "./doubts/repeat.mjs";
export { openDoubt } from "./doubts/open.mjs";
export { answerDoubt, ingestConsultAnswer } from "./doubts/answer.mjs";
export { doubtCommand } from "./doubts/command.mjs";
