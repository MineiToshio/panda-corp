// Standby triggers (a) handoff file, (b) Claude usage limit, (c) silent lease: `checkTriggers` (split from drive.mjs).
import nodeFs from "node:fs";
import { loadSchema, readJson, validate } from "../fsx.mjs";
import { readJournal } from "../journal.mjs";
import { isTerminalUnit, readState } from "../state.mjs";
import { buildStateOf, driveLog, limitsOf, nowMs, pathsOf, withDefaults } from "./context.mjs";
import { readStandby } from "./standby.mjs";

const pendingWork = (state) => state.units.some((u) => !isTerminalUnit(u)) || state.jobs.some((j) => j.state === "running");
const readText = (file) => { try { return nodeFs.readFileSync(file, "utf8"); } catch { return null; } };

async function readHandoff(paths, runId) {
  let value;
  try { value = await readJson(paths.handoffFile); } catch { return { file: true, valid: false }; }
  if (!value) return null;
  const check = validate(await loadSchema("handoff"), value);
  if (!check.ok || value.run_id !== runId) return { file: true, valid: false, value };
  return { file: true, valid: true, value };
}

async function committedCount(paths) {
  try {
    const { events } = await readJournal(paths.journalFile);
    return events.filter((e) => e.type === "wo_committed").length;
  } catch { return 0; }
}

/**
 * One standby poll: should the relay take over, keep waiting, or leave?
 * @param {{project: string, runId: string, transcript?: string|null, handoffAfter?: number|null}} input
 * @param {object} [deps] `now`, `buildState`, `thresholds`, `pid`
 * @returns {Promise<{trigger: string|null, exit: string|null, detail: string|null}>}
 *   exit reasons: `run_not_active`, `run_changed`, `no_lease`, `drive_active`, `replaced`
 */
export async function checkTriggers({ project, runId, transcript = null, handoffAfter = null }, deps) {
  const d = withDefaults(deps);
  const bs = await buildStateOf(d);
  const paths = pathsOf(project, d);
  const limits = limitsOf(d);
  const none = { trigger: null, exit: null, detail: null };

  const state = await readState(project, { env: d.env, homedir: d.homedir });
  if (!state) return { ...none, exit: "run_not_active", detail: "no state.json" };
  if (state.run_id !== runId) return { ...none, exit: "run_changed", detail: state.run_id };
  if (state.status !== "active") return { ...none, exit: "run_not_active", detail: state.status };

  const standby = await readStandby(project, d);
  if (standby && standby.pid !== d.pid && d.isAlive(standby.pid)) return { ...none, exit: "replaced", detail: String(standby.pid) };

  const lease = await bs.currentLease(project);
  if (!lease) return { ...none, exit: "no_lease", detail: null };
  if (lease.run_id !== runId) return { ...none, exit: "run_changed", detail: lease.run_id };
  const now = nowMs(d);
  const silentMs = now - Date.parse(lease.renewed_at);
  const silent = Number.isFinite(silentMs) && silentMs >= limits.drive_silent_s * 1000;
  if (lease.coordinator === "drive" && !silent) return { ...none, exit: "drive_active", detail: `epoch ${lease.epoch}` };

  // (a) handoff file of this run, requested from the current epoch.
  const handoff = await readHandoff(paths, runId);
  if (handoff?.valid) {
    if (handoff.value.from_epoch === lease.epoch) return { ...none, trigger: "a", detail: handoff.value.reason };
    driveLog(project, `standby: stale handoff from epoch ${handoff.value.from_epoch} (lease epoch ${lease.epoch}) ignored`, d);
    try { nodeFs.renameSync(paths.handoffFile, paths.handoffConsumedFile(handoff.value.from_epoch)); } catch { /* raced */ }
  } else if (handoff?.file && handoff.valid === false) {
    driveLog(project, "standby: invalid handoff.json ignored", d);
  }

  // Provider exhaustion suspends its execution; it never transfers a live coordinator.

  // Test-only: the session "hands off" after N committed WOs (`--handoff-after N`).
  if (Number.isInteger(handoffAfter) && handoffAfter >= 0 && (await committedCount(paths)) >= handoffAfter) {
    return { ...none, trigger: "test", detail: `handoff-after ${handoffAfter}` };
  }

  // (c) lease recovery is independent of quota. Dispatch after takeover uses the shared allocator.
  if (silent && pendingWork(state)) return { ...none, trigger: "c", detail: `silent ${Math.round(silentMs / 1000)} s` };

  return none;
}
