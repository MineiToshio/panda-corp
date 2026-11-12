// Shared constants and helpers of the lifecycle modules (see ../lifecycle.mjs for the public entry).
import { installPrePush } from "../../../scripts/install-pre-push.mjs";
import * as buildStateModule from "../../build-state.mjs";
import { defaultExec } from "../fsx.mjs";
import { appendEvent } from "../journal.mjs";
import { readState } from "../state.mjs";
import { emitEvent } from "../telemetry.mjs";

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
export const LEASE_TTL_S = 1800;
export const COORDINATORS = Object.freeze({ claude: "claude-session", codex: "codex-session" });
export const SIZE_RANK = Object.freeze({ touch: 0, feature: 1, giant: 2 });
export const RESUMABLE_STATUSES = Object.freeze(["active", "paused", "waiting_owner", "waiting_gate", "stopped"]);

export const depsOf = (deps) => ({ ...deps, env: deps.env ?? process.env });
export const bsOf = (d) => d.buildState ?? buildStateModule;
export const clockMs = (d) => (d.env.PANDACORP_NOW ? Date.parse(d.env.PANDACORP_NOW) : d.clock ? d.clock().getTime() : Date.now());
export const runtimeOf = (state) => (state?.coordinator === "claude-session" ? "claude" : "codex");
export const isAliveDefault = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
};
export const shapeOf = (state) => (state.coordinator === "codex-session" ? "R-B" : state.coordinator === "drive" ? "drive" : state.label === "codex" ? "R-C" : "R-A");

export async function readStateLoose(project, d) {
  try { return await readState(project, d); } catch (error) { if (error?.code === "INVALID_STATE" || error?.code === "LEDGER_CORRUPT") return null; throw error; }
}

export const journal = (p, runId, epoch, type, data, d, actor = "cli") => appendEvent(p.journalFile, { run_id: runId, epoch, actor, type, data }, d);

export async function emit(project, state, name, data, d) {
  const sent = await emitEvent(project, { runtime: runtimeOf(state), runId: state.run_id, name, data }, d);
  return sent.ok ? null : `event ${name} not emitted: ${sent.error}`;
}

export const git = async (d, cwd, args) => (d.exec ?? defaultExec)("git", args, { cwd });

export async function ensurePrePush(project, launched) {
  if (!launched) return "not_needed";
  const r = installPrePush({ project });
  if (r.code === 0) return "installed";
  if (r.code === 3) throw err("INVALID_STATE", `the pre-push hook cannot be installed: ${r.message}`, { prepush: "refused" });
  throw err("INVALID_STATE", `the pre-push hook could not be installed: ${r.message}`, { prepush: "failed" });
}
