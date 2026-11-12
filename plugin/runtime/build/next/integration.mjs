// (2) Integration (CLI doc 4.1): git work outside the mutex, state and journal under it; accepted assumption branches
// merge first (C10); a conflict hands the unit back.
import { readJson } from "../fsx.mjs";
import { fencedTwoPhase, findUnit } from "../state.mjs";
import { PLANNED_KINDS } from "./constants.mjs";
import { err, fenceOf, gitOk, integrationRoot, nowIsoOf, sibling, unitEvent } from "./context.mjs";

export async function integrateStep(run, state, notes) {
  const { d, ref } = run;
  const committed = state.units.some((u) => u.state === "committed" && PLANNED_KINDS.includes(u.kind));
  if (!committed && !(await acceptedAssumptionPending(run, state))) return;
  const res = await fencedTwoPhase(run.ref,
    async (ctx) => {
      const s = await ctx.readState();
      if (!s || s.run_id !== ctx.runId) throw err("FENCE", "state does not belong to the lease run");
      return s;
    },
    async (s) => (await sibling(d, "integrate", "integrateCommitted"))({ state: s, runId: s.run_id }, { ...d, project: ref.project }),
    async (result, _intent, ctx) => {
      const s = await ctx.readState();
      const done = (Array.isArray(result?.integrated) ? result.integrated : []).filter((x) => x && typeof x.unit === "string");
      const merged = (Array.isArray(result?.merged) ? result.merged : []).filter((x) => x && typeof x.doubt === "string");
      const events = [];
      let units = s.units;
      let safe = s.last_safe_point;
      const safePoint = (sha) => {
        events.push({ type: "safe_point", data: { kind: "integration-land", sha } });
        safe = { sha, kind: "integration-land", at: nowIsoOf(d) };
      };
      // Accepted assumption branches merged first (they precede the chains integrated after them).
      for (const m of merged) {
        events.push({ type: "integrated", data: { unit: null, doubt: m.doubt, sha: m.sha ?? null } });
        if (typeof m.sha === "string") safePoint(m.sha);
      }
      for (const item of done) {
        const u = findUnit(s, item.unit);
        if (!u || u.state !== "committed") continue;
        units = units.map((x) => (x.id === u.id ? { ...x, state: "integrated" } : x));
        const onAssumption = typeof item.assumption === "string" ? item.assumption : null;
        events.push({ type: "integrated", data: { unit: u.id, sha: item.sha ?? null, ...(onAssumption ? { assumption: onAssumption } : {}) } });
        events.push(unitEvent(u.id, "committed", "integrated"));
        // A chain integrated on an assume branch is not a safe point of the integration branch.
        if (typeof item.sha === "string" && !onAssumption) safePoint(item.sha);
      }
      for (const ev of events) await ctx.appendEvent(ev);
      if (events.length) await ctx.writeState({ ...s, units, last_safe_point: safe });
      return { conflicts: Array.isArray(result?.conflicts) ? result.conflicts : [] };
    });
  for (const c of res.conflicts) {
    const unitId = c?.unit?.id ?? c?.unit;
    if (typeof unitId !== "string") continue;
    const reason = typeof c.doubt === "string"
      ? `conflicto al unir la rama de la suposición aceptada (${c.doubt}) con la rama de integración`
      : typeof c.assumption === "string"
        ? `conflicto al integrar la cadena en la rama de la suposición ${c.assumption}`
        : "conflicto al integrar la cadena en la rama de integración";
    await (await sibling(d, "failure", "handbackCommand"))({ ...fenceOf(run), unit: unitId, reason, cause: "code" }, d);
    notes.push(typeof c.doubt === "string" ? `La suposición aceptada ${c.doubt} chocó al unirse: se devuelve ${unitId}.` : `${unitId} chocó al integrarse: se devuelve.`);
  }
}

/**
 * Is there an assumption the owner accepted whose branch is not merged into the integration branch yet? Reads the doubt
 * records of the answered questions (`state.answers`) and checks ancestry with git; integrate.mjs does the merge (C10).
 */
async function acceptedAssumptionPending(run, state) {
  const branchOf = state.integration?.branch;
  if (!branchOf) return false;
  for (const id of Object.keys(state.answers ?? {})) {
    let file;
    try { file = run.paths.doubtFile(id); } catch { continue; }
    const record = await readJson(file, { fs: run.d.fs }).catch(() => null);
    if (!record?.assumption || !record.decision || !Object.hasOwn(record.decision, "value")) continue;
    if (JSON.stringify(record.decision.value) !== JSON.stringify(record.assumption.option)) continue;
    const branch = run.paths.assumeBranch(state.run_id, id);
    if (!(await gitOk(integrationRoot(run, state), ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]))) continue;
    if (!(await gitOk(integrationRoot(run, state), ["merge-base", "--is-ancestor", branch, branchOf]))) return true;
  }
  return false;
}

export const landRunning = (state) => state.jobs.some((j) => j.kind === "land" && j.state === "running");
