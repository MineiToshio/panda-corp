// `drive`: the Codex relay of the v2 build engine (BUILD-14; D10 as amended by PLAN 3.16 A9, A10, A21).
// A long-lived Node process of the same CLI with NO LLM of its own that never calls Claude (LESSON-0501).
//   - Armed by `start --run` / `start --resume` (lifecycle calls `armDrive`): detached standby, `caffeinate -i -w <pid>`.
//     Codex quota is NOT checked at arming; never armed when `codex login status` fails or, in a launched project,
//     the pre-push hook is not verified.
//   - Standby polls every `drive_poll_s`: (a) `build/handoff.json`; (b) Claude's usage-limit text in the run's
//     unit reports / worker output (or an optional transcript); (c) no lease renewal for `drive_silent_s` AND pending
//     work AND the last Claude reading >= `drive_trigger_c_min_pct` or unknown. It exits when the run is not `active`.
//   - Takeover = the same-run epoch `transfer` (build-state.mjs): epoch+1, new token file, no quiesce, workers and
//     jobs survive and are adopted, the previous holder is fenced (exit 3). Codex re-read at takeover: >= quota_stop
//     -> `paused-quota` (both resets_at, lease released) once nothing runs; otherwise the loop.
//   - Loop: the same `next` logic with coordinator `drive` (routing shape `drive`: builders Codex, Claude counted as
//     out, reviews degraded and queued for re-review, the security audit deferred to Claude opus high), `land`,
//     `finish`; the lease is renewed every iteration (that renewal is also how a resumed owner is detected: FENCE ->
//     the relay yields and exits cleanly). Only Codex units launched by the CLI (`via:"cli"`) are accepted.
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
