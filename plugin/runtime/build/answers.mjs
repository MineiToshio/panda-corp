// Owner answers of a live v2 build (D19, CLI 3.13, PLAN 3.16 A20): `answer --epoch E --question <id> --value '<json>'`
// for the three question kinds `ask` (first-minute `q-<check id>`), `parked` (a doubt id parked `owner_question` or built
// on assumption) and `gate` (`g-<unit>` of a `money|delete|external` waiting gate), plus `applyStartAnswers` for the
// `--answers` of `start --run`. The production gate is never answerable here: it is ordered only through
// `PANDACORP_OWNER_RELEASE_OK=1 ... land` (BUILD-13). The decision logic is the pure `planAnswer`; `answerCommand`
// applies it under the lease mutex (state, journal, doubt record, the owner's inbox line, a hand-back on a refused gate).
// This file is the public entry; the command is split by responsibility under `./answers/` (constants, common,
// questions, assumption, planEffects, plan, start, io, command).

export { ANSWERABLE_GATES, ANSWER_EFFECTS, ANSWER_KINDS, GATE_REFUSED_REASON } from "./answers/constants.mjs";
export { sameValue } from "./answers/common.mjs";
export { answerNotes, classifyQuestion, fitsAsk, matchesDefault, parseAnswerValue, readQuestions } from "./answers/questions.mjs";
export { actedOn, planAnswer } from "./answers/plan.mjs";
export { applyStartAnswers, readAnswersArg } from "./answers/start.mjs";
export { answerCommand } from "./answers/command.mjs";
