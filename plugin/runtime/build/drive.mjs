// `drive`: deterministic same-run CLI relay (BUILD-14 / DR-162), with no LLM of its own.
//   - Start/resume arms standby with valid Codex login and the launched-project pre-push guard;
//     infrastructure qualification is independent of quota. caffeinate keeps the host awake.
//   - Standby reacts to explicit current-epoch handoff or silent lease with pending work, never quota.
//   - Transfer checks native continuation ownership under the lease mutex. Native agent/session work
//     retains its capable lead, credential, checkpoint and wake; eligible CLI executions survive relay.
//   - next allocates each new unit/review/audit/consultation from shared role/risk capacity on either tool.
//     Current executions stay pinned; only no fitting eligible cell waits with resumeAt and fenced wake.
//   - Real report/review-record evidence and normal gates decide completion. No automatic audit
//     deferral, false verified or mandatory cross-company re-review. Fenced relay yields to owner resume.
// Everything time- or process-related is injected (clock, sleep, spawn, isAlive, exec) so tests run on fixture clocks.
// Sibling engine modules (next, land, finish, workers, failure) are injected by the dispatcher, never imported here.
// This file is the public entry; the relay is split by responsibility under `./drive/` (constants, context, standby,
// arm, triggers, takeover, audit, loop, run).

export { CLI_ENTRY, armDrive, keepAwake, standbyArgs } from "./drive/arm.mjs";
export { deferAuditUnit } from "./drive/audit.mjs";
export { STANDBY_STATES, TRIGGERS } from "./drive/constants.mjs";
export { assertNoForbiddenWord, driveDeps, driveLog } from "./drive/context.mjs";
export { driveLoop, runLoop } from "./drive/loop.mjs";
export { parseDriveArgs, runDrive, runStandby } from "./drive/run.mjs";
export { isStandbyAlive, readStandby } from "./drive/standby.mjs";
export { takeOver } from "./drive/takeover.mjs";
export { checkTriggers } from "./drive/triggers.mjs";
