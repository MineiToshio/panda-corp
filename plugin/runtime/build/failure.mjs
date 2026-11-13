// Failure policy of the v2 build engine (BUILD-15, D21) and the `handback` command logic.
//
//  * Policy (pure): at most 3 executions per unit; attempt 3 is queued automatically and only with a diagnosis and
//    evidence that differs from the previous failure; a hand-back parks the unit and its dependents (units `blocked`,
//    WOs `BLOCKED`) while independent units go on; 3 consecutive `env-infra` hand-backs stop the run.
//  * Hand-back (I/O): `handback/<unit>.md`, a pending entry in `.pandacorp/inbox/decisions.md`, WO `BLOCKED` + a commit
//    on the integration branch, journal, state.
//  * Engine failure (a fault of the CLI, not of the product): retry the step once after `rebuildState`; if it repeats,
//    stop at the last safe point, write `handback/engine.md`, file the next free factory backlog item, journal
//    `engine_failure`, release the lease and raise ENGINE_FAILURE (exit 8). It consumes no unit attempt.
//
// Every function takes its injected `deps` LAST (fs, exec, env, clock, buildState, emit, factoryRoot); nothing here
// touches the real home, events file or host slots unless the caller's deps point there. Owner-facing text is Spanish
// and has no em/en dashes (the one exception is the `## <date> — <title>` heading that the decisions inbox format
// requires, see decisionHeading).
//
// This file is the public entry: it only re-exports. The code lives by responsibility in ./failure/:
// common (constants, helpers), policy (pure decision and plans), handbackText (Spanish text), handback (hand-back I/O),
// unitFailure (apply the policy to one failed execution), unitDoubt (open a unit's doubt), engineBacklog and
// engineFailure (engine failure handling).
export { POLICY } from "./failure/common.mjs";
export { buildEvidence, commitPlan, decideFailure, dependentsOf, envInfraStop, executionsUsed, planHandback, planRequeue } from "./failure/policy.mjs";
export { handBack, handbackCommand } from "./failure/handback.mjs";
export { UNBLOCK_CAUSE, UNBLOCK_NOTE, UNBLOCKABLE_KINDS, applyUnblock, checkUnblock, planUnblock, unblockCommand } from "./failure/unblock.mjs";
export { applyUnitFailure, failUnit } from "./failure/unitFailure.mjs";
export { doubtFromDiagnosis, openUnitDoubt } from "./failure/unitDoubt.mjs";
export { engineFailureError, engineFault, handleEngineFailure, isEngineFault, withEngineRecovery } from "./failure/engineFailure.mjs";
