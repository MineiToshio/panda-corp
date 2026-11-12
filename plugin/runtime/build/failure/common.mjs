// Shared constants and small helpers of the failure modules (see ../failure.mjs for the public entry).
import { buildPaths } from "../paths.mjs";

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Policy constants (the Constants table of build-engine.md: executions per unit, env-infra streak, engine failures). */
export const POLICY = Object.freeze({ MAX_EXECUTIONS: 3, ENV_INFRA_STREAK_STOP: 3, ENGINE_RETRIES: 1, ENGINE_FAILURES_EXTRA_LINE: 3, TAIL_LINES: 40 });

export const WO_UNIT_KINDS = Object.freeze(["build", "patch"]);
export const DONE_STATES = Object.freeze(["committed", "integrated", "reviewing", "verified", "landed"]);
/** Failure sources that carry their own evidence (the reviewer's RED tests, a gate's failing run): no builder diagnosis is needed at attempt 3. */
export const EVIDENCE_SOURCES = Object.freeze(["review_reopen", "g2_red", "g3_red"]);

export const oneLine = (text, max = 160) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const uniqSorted = (list = []) => [...new Set(list.map(String))].sort();
export const lastLines = (text, n = POLICY.TAIL_LINES) => String(text ?? "").replace(/\s+$/, "").split("\n").slice(-n).join("\n");
export const woKey = (wo) => String(wo).toLowerCase();
/** The run's integration branch (DEC-2) for owner and backlog text; a missing or unsafe run id keeps a placeholder. */
export const integrationBranchOf = (runId) => {
  try { return buildPaths(".").integrationBranch(runId); } catch { return "lane/<run_id>/integration"; }
};

/** Best-effort telemetry: a failing emit becomes a warning string, never an error. */
export async function emitSafely(deps, name, data) {
  if (!deps.emit) return null;
  try { await deps.emit({ name, data }); return null; } catch (error) { return `telemetry ${name}: ${oneLine(error.message, 120)}`; }
}
