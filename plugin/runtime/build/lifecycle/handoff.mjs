// `handoff`: ask the drive loop for a cold handoff at the next safe point.
import { atomicWriteJson, loadSchema, nowIso, validate } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase } from "../state.mjs";
import { depsOf, emit, err, readStateLoose } from "./common.mjs";

/** `handoff --epoch N --reason R`: write build/handoff.json (drive consumes it), journal `handoff_requested`, emit `build.handoff`. */
export async function requestHandoff({ project, epoch, reason }, deps = {}) {
  const d = depsOf(deps);
  const p = buildPaths(project, d);
  const written = await fencedTwoPhase({ project, epoch: Number(epoch), deps: d }, undefined, undefined, async (_r, _i, ctx) => {
    const body = { run_id: ctx.runId, from_epoch: Number(epoch), reason, requested_at: nowIso(d) };
    const check = validate(await loadSchema("handoff"), body);
    if (!check.ok) throw err("INVALID_INPUT", `handoff request invalid: ${JSON.stringify(check.errors)}`);
    await atomicWriteJson(p.handoffFile, body);
    await ctx.appendEvent({ type: "handoff_requested", data: { reason, from_epoch: Number(epoch) } });
    return body;
  });
  const state = await readStateLoose(project, d);
  const warning = state ? await emit(project, state, "build.handoff", { reason, from_epoch: Number(epoch) }, d) : null;
  return { handoff_path: p.handoffFile, ...(warning ? { warnings: [warning] } : {}), request: written };
}
