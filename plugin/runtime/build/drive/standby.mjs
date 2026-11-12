// The standby file build/drive/standby.json: read, write and own-state transitions (split from drive.mjs).
import { atomicWriteJson, readJson } from "../fsx.mjs";
import { isoAt, nowMs, pathsOf, withDefaults } from "./context.mjs";

/**
 * Read `build/drive/standby.json` (`{pid, armed_at, run_id, state}`); null when absent or unreadable.
 * @param {string} project
 * @param {object} [deps]
 */
export async function readStandby(project, deps) {
  const d = withDefaults(deps);
  try { return await readJson(pathsOf(project, d).driveStandbyFile); } catch { return null; }
}

/**
 * Is the drive standby alive (pid alive and `state: standby`, optionally of `runId`)? The `driveAlive` input of
 * `quota.policy` (A11): `next` returns `handoff` only when this is true.
 * @param {string} project
 * @param {{runId?: string}} [opts]
 * @param {object} [deps] `isAlive`
 * @returns {Promise<boolean>}
 */
export async function isStandbyAlive(project, { runId } = {}, deps) {
  const d = withDefaults(deps);
  const standby = await readStandby(project, d);
  if (!standby || standby.state !== "standby") return false;
  if (runId && standby.run_id !== runId) return false;
  return Boolean(d.isAlive(standby.pid));
}

export const writeStandby = (project, value, d) => atomicWriteJson(pathsOf(project, d).driveStandbyFile, value);

// Only the process named in standby.json may change it (a re-armed standby must not be clobbered by an old drive).
export async function setOwnStandbyState(project, state, d) {
  const current = await readStandby(project, d);
  if (current && current.pid !== d.pid) return false;
  await writeStandby(project, { pid: d.pid, armed_at: current?.armed_at ?? isoAt(nowMs(d)), run_id: current?.run_id ?? null, state }, d);
  return true;
}
