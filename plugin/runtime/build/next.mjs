// next.mjs: the scheduler behind `pandacorp-build next` (CLI doc section 4, PLAN 3.3, D19, D32, AR2 A11/A12).
// One call = harvest finished jobs and workers -> integrate committed chains -> G2 bookkeeping -> land when the batch
// is complete -> quota policy (handoff) -> admission and dispatch -> wait or a terminal action.
// Invariants:
//   - every call renews the lease (each fenced step's phase 1 renews it, `projectStatus:false`); that is the liveness;
//   - one admission reading is recorded per call (`recordReading`), never more;
//   - a terminal action is returned only when no unit, job or worker of the run is running (A11), already applied
//     (status, journal, quiesce + finalizeRelease with `projectStatus:false`) except `done` (the session calls `finish`);
//   - the change queue (`.pandacorp/inbox/changes/`) is never read nor drained here; no unit outside the run scope is
//     ever returned;
//   - the A11 quota priority lives in `quota.policy({..., driveAlive})`; this module applies it and never re-derives it.
// Sibling modules are injected as namespaces `deps.<stem>` (default: the real `./<stem>.mjs`, imported lazily so a missing
// sibling fails only the step that needs it); the functions used are listed in `NEXT_SIBLING_CONTRACT`. Pure readers of
// sibling modules (`frdsReadyForG2`, `readDeferred`, `productPrefix`) are imported statically.
// This file is the public entry; the scheduler is split by responsibility under `./next/` (constants, context, harvest,
// g2, integration, planning, scope, landing, candidates, dispatch, terminal, wait, step).
import { buildPaths } from "./paths.mjs";
import { MAX_WAIT_S } from "./next/constants.mjs";
import { err, resolveDeps } from "./next/context.mjs";
import { step } from "./next/step.mjs";
import { waitForChange } from "./next/wait.mjs";

export {
  ENV_INFRA_STOP, G2_BOOTSTRAP_EXIT, G2_SNAPSHOT_FAIL_MAX, MAX_WAIT_S, NEXT_ACTIONS, NEXT_SIBLING_CONTRACT, TERMINAL_ACTIONS,
} from "./next/constants.mjs";
export { dispatchLine } from "./next/dispatch.mjs";
export { g2PinOf, removeAllG2Snapshots } from "./next/g2.mjs";
export { batchState, blockedClosure, inScope } from "./next/scope.mjs";
export { applyTerminal, chooseTerminal } from "./next/terminal.mjs";

/**
 * The `next` command: decide and apply what the coordinator does next.
 * @param {{project: string, epoch: number, wait?: number, actor?: "cli"|"drive", sessionModel?: string|null, k?: number|null}} input
 *   `sessionModel`/`k` override the values the run journaled at start/resume (`run_started|run_resumed.data.session_model|k`).
 * @param {object} [deps] state deps (`fs` promises API, `env`, `homedir`, `clock`, `buildState`) plus the sibling
 *   modules of {@link NEXT_SIBLING_CONTRACT} and optional overrides `quota`, `admission`, `routing`, `risk`,
 *   `thresholds`, `tiers`, `riskDeps`, `signalExec`, `isAlive`, `sleep`, `monotonic`, `pollMs`, `log`.
 * @returns {Promise<object>} `{ok, cmd:"next", epoch, action, units, wait, admit, quota, notes_es}`
 * @throws USAGE (bad args), FENCE/QUIESCED (exit 3), INVALID_STATE/LEDGER_CORRUPT/JOURNAL_CHAIN (5), anything else = engine failure (8)
 */
export async function next(input = {}, deps = {}) {
  const { project, actor = "cli" } = input;
  if (typeof project !== "string" || !project) throw err("USAGE", "next: --project is required");
  const epoch = Number(input.epoch);
  if (!Number.isInteger(epoch) || epoch < 0) throw err("USAGE", "next: --epoch <n> is required");
  const waitS = input.wait === undefined || input.wait === null ? 0 : Number(input.wait);
  if (!Number.isFinite(waitS) || waitS < 0 || waitS > MAX_WAIT_S) throw err("USAGE", `next: --wait must be 0..${MAX_WAIT_S} seconds`);
  if (actor !== "cli" && actor !== "drive") throw err("USAGE", `next: bad actor ${actor}`);

  const d = resolveDeps(deps);
  const run = {
    ref: { project, epoch, actor, deps: d }, d, paths: buildPaths(project, d),
    overrides: { sessionModel: input.sessionModel ?? null, k: input.k ?? null }, l4: null, recorded: false,
  };
  const started = d.monotonic();
  const first = await step(run);
  if (first.out.action !== "wait" || waitS === 0) return first.out;
  const cap = ["ram", "cpu_H"].includes(first.out.wait.reason) ? Math.min(waitS, first.out.wait.retry_after_s) : waitS;
  await waitForChange(run, first.watch, started + cap * 1000);
  return (await step(run)).out;
}
