// Native-agent limit bridge. Claude's lead records the provider receipt and exact Agent resume id.
import { readJson } from "./fsx.mjs";
import { findUnit } from "./state.mjs";
import { buildPaths } from "./paths.mjs";
import { resolveDeps, fresh } from "./next/context.mjs";
import { suspendAfterLimit } from "./next/harvest.mjs";
import { classifyWorkerPayload } from "./workers.mjs";
import { recordLimit } from "./quota.mjs";
import { capacityNow } from "../capacity/scheduler.mjs";

export async function suspendExecution({ project, epoch, unit, file }, deps = {}) {
  const d = resolveDeps(deps), paths = buildPaths(project, d);
  const run = { ref: { project, epoch, deps: d }, d, paths };
  const state = await fresh(run), u = findUnit(state, unit);
  const receipt = await readJson(file, d);
  const verdict = classifyWorkerPayload(receipt ?? {}, { now: capacityNow(d) });
  if (!u || !["running", "admitted"].includes(u.state) || !receipt?.sessionId || verdict.outcome !== "limit")
    throw Object.assign(new Error("suspend requires a live unit, a provider limit receipt and its exact sessionId"), { code: "INVALID_INPUT" });
  const recorded = verdict.limit === "usage_limit" ? recordLimit({ provider: u.worker.runtime, resetsAt: verdict.resetsAt },
    { file: paths.quotaFile, epoch, deps: d }) : null;
  await suspendAfterLimit(run, u, state.jobs.find(j => j.unit === u.id && j.state === "running"), { state: "done", exit: null },
    { ...verdict, sessionId: receipt.sessionId, recorded });
  return { unit, state: "suspended", resumeAt: (await fresh(run)).units.find(u => u.id === unit).suspension.resumeAt };
}
