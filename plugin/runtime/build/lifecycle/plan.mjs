// Planning helpers shared by start --run and the `plan` / `lint-plan` views.
import path from "node:path";
import { readJson } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { lintPlan, plan, planView, readPlanWorkOrders } from "../planner.mjs";
import { staticZones } from "../risk.mjs";
import { depsOf, readStateLoose, shapeOf } from "./common.mjs";

export async function planInput({ root, state, scope, questions, cardType, params }, d) {
  const read = await readPlanWorkOrders(root, d);
  const wos = await staticZones(read.wos, root, d.riskDeps ?? {});
  return {
    read,
    input: {
      wos, frd_acs: read.frd_acs, scope, units: state?.units ?? [], label: state?.label ?? "claude", size: state?.size ?? "feature",
      questions, card_type: cardType ?? null, shape: state ? shapeOf(state) : undefined, coordinator: state?.coordinator, session_model: params?.sessionModel ?? null,
    },
  };
}

/**
 * `plan` and `lint-plan` views over the live run's scope, or over `scopeFile` (default: every WO) without a run.
 * @returns {Promise<{ok: boolean, body: object}>} `ok:false` (lint with errors) makes the dispatcher exit 6
 */
export async function planCommand({ project, scopeFile = null, explain = false, strict = false, lint = false }, deps = {}) {
  const d = depsOf(deps);
  const state = await readStateLoose(project, d);
  const run = state && !["finished"].includes(state.status) ? state : null;
  const p = buildPaths(project, d);
  const root = run ? path.resolve(project, run.integration.worktree) : project;
  let scope = run?.scope;
  if (scopeFile) { const raw = await readJson(path.resolve(scopeFile), { required: true }); scope = { card: null, frds: [], wos: [], out_of_scope: [], ...(raw.scope ?? raw) }; }
  if (!scope) scope = { card: null, frds: (await readPlanWorkOrders(root, d)).frds, wos: [], out_of_scope: [] };
  const preflight = await readJson(p.preflightFile).catch(() => null);
  const answered = new Set(Object.keys(run?.answers ?? {}));
  const questions = (preflight?.questions ?? []).filter((q) => !answered.has(q.id));
  const { input } = await planInput({ root, state: run, scope, questions }, d);
  if (lint) { const r = lintPlan({ ...input, strict }, d); return { ok: r.ok, body: { strict: r.strict, issues: r.issues } }; }
  const result = plan(input, d);
  return { ok: true, body: planView(result, { explain, queued: [] }) };
}
