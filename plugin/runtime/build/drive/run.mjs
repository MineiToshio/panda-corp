// Standby polling and the `drive` subcommand entry: `runStandby`, `parseDriveArgs`, `runDrive` (split from drive.mjs).
import { STATE_ERRORS_BEFORE_EXIT, err, isFenceError } from "./constants.mjs";
import { driveLog, isoAt, limitsOf, nowMs, withDefaults } from "./context.mjs";
import { keepAwake } from "./arm.mjs";
import { driveLoop, engineFailure } from "./loop.mjs";
import { readStandby, setOwnStandbyState, writeStandby } from "./standby.mjs";
import { checkTriggers } from "./triggers.mjs";
import { takeOver } from "./takeover.mjs";

/**
 * Standby: poll the triggers until the run leaves `active` (exit) or a trigger fires (takeover, then the loop).
 * @param {{project: string, runId: string, transcript?: string|null, handoffAfter?: number|null}} input
 * @param {object} [deps]
 * @returns {Promise<{outcome: string, trigger: string|null, exitCode: number}>}
 */
export async function runStandby({ project, runId, transcript = null, handoffAfter = null }, deps) {
  const d = withDefaults(deps);
  const limits = limitsOf(d);
  const current = await readStandby(project, d);
  await writeStandby(project, { pid: d.pid, armed_at: current?.pid === d.pid ? current.armed_at : isoAt(nowMs(d)), run_id: runId, state: "standby" }, d);
  try { await keepAwake(project, d.pid, d); } catch (error) { driveLog(project, `standby: keep-awake failed: ${error.message}`, d); }
  driveLog(project, `standby: pid ${d.pid} watching ${runId}`, d);

  let stateErrors = 0;
  for (let i = 0; i < d.maxPolls; i++) {
    let verdict;
    try {
      verdict = await checkTriggers({ project, runId, transcript, handoffAfter }, d);
      stateErrors = 0;
    } catch (error) {
      stateErrors += 1;
      driveLog(project, `standby: poll failed (${error.code ?? "ERROR"}: ${error.message})`, d);
      if (stateErrors >= STATE_ERRORS_BEFORE_EXIT) { await setOwnStandbyState(project, "stopped", d); return { outcome: "standby_exit", trigger: null, exitCode: 0 }; }
      await d.sleep(limits.drive_poll_s * 1000);
      continue;
    }
    if (verdict.exit) {
      driveLog(project, `standby: exit (${verdict.exit}${verdict.detail ? `: ${verdict.detail}` : ""})`, d);
      await setOwnStandbyState(project, "stopped", d);
      return { outcome: "standby_exit", trigger: null, reason: verdict.exit, exitCode: 0 };
    }
    if (verdict.trigger) {
      const taken = await takeOverAndLoop({ project, runId, trigger: verdict.trigger, detail: verdict.detail }, d);
      if (taken) return taken;
    }
    await d.sleep(limits.drive_poll_s * 1000);
  }
  return { outcome: "poll_budget", trigger: null, exitCode: 0 };
}

async function takeOverAndLoop(input, d) {
  let taken;
  try { taken = await takeOver(input, d); } catch (error) {
    driveLog(input.project, `takeover failed: ${error.code ?? "ERROR"}: ${error.message}`, d);
    if (isFenceError(error)) return null;
    return { ...(await engineFailure(input.project, error?.epoch ?? null, error, d, d.engineDeps ?? {})), trigger: input.trigger };
  }
  if (taken.outcome === "retry") return null;
  if (taken.outcome === "paused-quota") {
    await setOwnStandbyState(input.project, "stopped", d);
    return { outcome: "paused-quota", trigger: input.trigger, exitCode: 0 };
  }
  const looped = await driveLoop({ project: input.project, epoch: taken.epoch }, d);
  return { ...looped, trigger: input.trigger };
}

/**
 * Parse `drive` arguments: `--standby --run R [--transcript <path>]` or `--run R [--handoff-after N]`.
 * @param {string[]} argv arguments after the `drive` subcommand
 * @returns {{standby: boolean, runId: string, handoffAfter: number|null, transcript: string|null}}
 * @throws USAGE
 */
export function parseDriveArgs(argv) {
  const out = { standby: false, runId: null, handoffAfter: null, transcript: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = String(argv[i]).split(/=(.*)/s, 2);
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (flag === "--standby") out.standby = true;
    else if (flag === "--run") out.runId = value();
    else if (flag === "--handoff-after") out.handoffAfter = Number(value());
    else if (flag === "--transcript") out.transcript = value();
    else if (flag === "--project") i += inline !== undefined ? 0 : 1; // resolved by the dispatcher
    else throw err("USAGE", `unknown drive flag ${flag}`);
  }
  if (!out.runId) throw err("USAGE", "drive needs --run <run_id>");
  if (out.handoffAfter !== null && !(Number.isInteger(out.handoffAfter) && out.handoffAfter >= 0)) throw err("USAGE", "--handoff-after needs a non-negative integer");
  if (out.standby && out.handoffAfter !== null) throw err("USAGE", "--handoff-after is for the direct form (drive --run R)");
  return out;
}

/**
 * Entry of the `drive` subcommand (the dispatcher resolves the project and injects the engine functions).
 * `--standby`: wait for a trigger. `--run R --handoff-after N` (test only): take over after N committed WOs.
 * `--run R`: take over now (trigger `direct`) and run the loop. Writes nothing to stdout; logs to drive.log.
 * @param {{project: string, argv: string[]}} input
 * @param {object} [deps]
 * @returns {Promise<number>} process exit code (0, or 8 after an engine failure)
 */
export async function runDrive({ project, argv }, deps) {
  const d = withDefaults(deps);
  const args = parseDriveArgs(argv);
  if (args.standby || args.handoffAfter !== null) {
    const result = await runStandby({ project, runId: args.runId, transcript: args.transcript, handoffAfter: args.handoffAfter }, d);
    return result.exitCode;
  }
  await writeStandby(project, { pid: d.pid, armed_at: isoAt(nowMs(d)), run_id: args.runId, state: "active" }, d);
  try { await keepAwake(project, d.pid, d); } catch (error) { driveLog(project, `keep-awake failed: ${error.message}`, d); }
  const result = await takeOverAndLoop({ project, runId: args.runId, trigger: "direct", detail: null }, d);
  if (!result) { await setOwnStandbyState(project, "stopped", d); return 0; }
  return result.exitCode;
}
