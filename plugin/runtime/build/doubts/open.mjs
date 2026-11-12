// `doubt open`: validate the worker's doubt, compute the deterministic veto, create the record and start the ladder.
import path from "node:path";
import { nowIso } from "../fsx.mjs";
import { fencedTwoPhase, findUnit } from "../state.mjs";
import { consultOrigin, err, oneLine, sourcesSkipped } from "./common.mjs";
import { OPEN_STEPS, OPENABLE_STATES } from "./constants.mjs";
import { advance, output, parkOut } from "./advance.mjs";
import { readInputFile, validateDoubtObject } from "./input.mjs";
import { nextDoubtId, readDoubt, writeDoubt } from "./records.mjs";
import { isRepeatDoubt } from "./repeat.mjs";
import { assessVeto } from "./veto.mjs";

/**
 * `doubt open --epoch E --unit U --file <doubt.json>` (fenced, two-phase): validate the worker's doubt object, compute
 * the deterministic veto outside the mutex, then create the record. A vetoed doubt parks at once (the root rule never
 * applies to a vetoed doubt); under drive or the Codex app the sources step is skipped and consult 1 is queued.
 * Idempotent: a unit whose doubt is still open returns that doubt with `applied:false`.
 * @param {{project: string, epoch: number, unit: string, file: string}} input
 * @param {object} [deps] fs, env, homedir, clock, exec, buildState, emit, notify, tiers, availability, computeRisk,
 *   classifyText, readArtifacts, registryFile
 * @returns {Promise<{ok: true, cmd: "doubt", sub: "open", doubt_id: string, step: string, consult?: object, decision: null, parked?: object}>}
 * @throws USAGE (missing args), INVALID_INPUT (bad file), INVALID_STATE (unknown unit, wrong state), FENCE
 */
export async function openDoubt({ project, epoch, unit: unitId, file }, deps = {}) {
  if (!unitId) throw err("USAGE", "--unit is required");
  const doubt = await validateDoubtObject(await readInputFile(file, deps), deps);
  return fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps },
    async (ctx) => {
      const state = await ctx.readState();
      if (!state) throw err("INVALID_STATE", "no run state: start the run first");
      const unit = findUnit(state, unitId);
      if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
      if (unit.kind === "doubt-consult") throw err("INVALID_INPUT", `unit ${unitId} is a doubt consult: file its answer with doubt answer`);
      if (unit.doubt_id) {
        const existing = await readDoubt(project, unit.doubt_id, deps);
        if (existing && OPEN_STEPS.includes(existing.step)) return { existing };
        if (existing && existing.step === "parked" && unit.state === "parked") return { existing };
      }
      if (!OPENABLE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} is ${unit.state}: a doubt is opened from running or reported`);
      const previous = unit.doubt_id ? await readDoubt(project, unit.doubt_id, deps) : null;
      return { unit, root: path.resolve(project, state.integration.worktree), repeat: isRepeatDoubt(previous, doubt) };
    },
    async (intent) => (intent.existing ? null : assessVeto({ project, root: intent.root, unit: intent.unit, doubt }, deps)),
    async (veto, intent, ctx) => {
      if (intent.existing) return output("open", intent.existing, { applied: false, reason: "already_open" });
      let state = await ctx.readState();
      const unit = findUnit(state, unitId);
      if (!unit || unit.state !== intent.unit.state || unit.doubt_id !== intent.unit.doubt_id) throw err("INVALID_STATE", `unit ${unitId} changed while its doubt was assessed; retry`);
      const id = await nextDoubtId(project, deps);
      let record = {
        schema: 1, id, unit: unitId, opened_at: nowIso(deps), question: doubt.question, options: doubt.options.map((o) => ({ id: o.id, text: o.text })),
        preferred: doubt.preferred, why: doubt.why, step: "sources", consults: [], decision: null, assumption: null,
      };
      state = { ...state, units: state.units.map((u) => (u.id === unitId ? { ...u, state: "reported", doubt_id: id, token_hash: null } : u)) };
      if (unit.state !== "reported") await ctx.appendEvent({ type: "unit_state", data: { unit: unitId, from: unit.state, to: "reported" } });
      await ctx.appendEvent({ type: "doubt_opened", data: { doubt_id: id, unit: unitId, question: oneLine(doubt.question, 400), preferred: doubt.preferred, veto: veto.reasons, origin: consultOrigin(state, unit) } });
      let out = {};
      if (veto.vetoed) {
        const parked = await parkOut(ctx, state, record, veto.reasons.map((r) => r.reason), deps);
        ({ state, record, out } = parked);
      } else if (intent.repeat) {
        // The unit raises again what the ladder already decided for it: another autonomous decision would loop with no attempt consumed (NB1).
        ({ state, record, out } = await parkOut(ctx, state, record, ["repeat_doubt"], deps));
      } else if (sourcesSkipped(state)) {
        ({ state, record, out } = await advance(ctx, state, record, deps));
      }
      await writeDoubt(project, record, deps);
      await ctx.writeState(state);
      return output("open", record, out);
    });
}
