// The `answer` command: applies the pure plan under the lease mutex (state, journal, doubt record, inbox, hand-backs).
import path from "node:path";
import { releaseToken } from "../admission.mjs";
import { readDoubt } from "../doubts.mjs";
import { nowIso } from "../fsx.mjs";
import { fencedTwoPhase } from "../state.mjs";
import { err } from "./common.mjs";
import { isAncestor, lastAnswer, markInboxAnswered, writeDoubtRecord } from "./io.mjs";
import { planAnswer } from "./plan.mjs";
import { classifyQuestion, parseAnswerValue, readQuestions } from "./questions.mjs";

/**
 * `answer --epoch E --question <id> --value '<json>'` (fenced; one phase under the lease mutex). Effects in order:
 * validate; write `state.answers[id]`; journal `answer_recorded {question, kind, value, units}`; update the affected
 * units (journaled after it); a `parked` answer writes the doubt record (`decision` by `owner`, `step: decided`) and
 * marks its inbox entry answered; a gate answered `false` hands the unit back (its dependents end `blocked`, R4).
 * @param {{project: string, epoch: number, question: string, value: string|unknown, parsed?: boolean}} input `value` is
 *   the raw JSON text of `--value` (pass `parsed: true` to hand an already parsed value)
 * @param {object} [deps] fs, env, homedir, clock, exec, buildState, emit (passed on to `failure.handBack`)
 * @returns {Promise<{ok: true, cmd: "answer", question: string, kind: "ask"|"parked"|"gate", applied: boolean,
 *   units: {unit: string, effect: string}[], reason: string|null, blocked?: string[], assumption?: object, stopped_workers?: string[], warnings?: string[]}>}
 * @throws USAGE (exit 2: missing epoch/question/value, invalid JSON), FENCE (exit 3), INVALID_INPUT (exit 6: unknown
 *   id, value that does not fit, production gate), INVALID_STATE (exit 5: no run state)
 */
export async function answerCommand({ project, epoch, question, value: raw, parsed = false }, deps = {}) {
  if (epoch === undefined || epoch === null || Number.isNaN(Number(epoch))) throw err("USAGE", "--epoch is required");
  if (typeof question !== "string" || !question.trim()) throw err("USAGE", "--question is required");
  const value = parseAnswerValue(raw, { parsed });
  const kind = classifyQuestion(question);
  const result = await fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps }, undefined, undefined, async (_r, _i, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no run state: start the run first");
    const questions = kind === "ask" ? await readQuestions(project, deps) : new Map();
    const doubt = kind === "parked" ? await readDoubt(project, question, deps) : null;
    let previous = null;
    let assumptionMerged = false;
    if (Object.hasOwn(state.answers ?? {}, question)) {
      previous = await lastAnswer(ctx.paths.journalFile, question, deps);
      if (doubt?.assumption) assumptionMerged = await isAncestor(path.resolve(project, state.integration.worktree), doubt.assumption.branch, state.integration.branch, deps);
    }
    const plan = planAnswer({ state, question, value, questions, doubt, previous, assumptionMerged });
    const out = { ok: true, cmd: "answer", question, kind: plan.kind, applied: plan.applied, units: plan.units, reason: plan.reason, ...(plan.replaced ? { replaced: true } : {}) };
    if (!plan.applied) return out;

    const warnings = [];
    if (plan.record) await writeDoubtRecord(project, plan.record, deps);
    await ctx.writeState(plan.state);
    await ctx.appendEvent({ type: "answer_recorded", data: { question, kind: plan.kind, value, units: plan.units } });
    for (const event of plan.events) await ctx.appendEvent(event);
    for (const unitId of plan.release ?? []) {
      try { releaseToken(unitId, { file: ctx.paths.admissionFile }); } catch (error) { warnings.push(`admission token of ${unitId} not released: ${String(error.message).slice(0, 120)}`); }
    }

    const blocked = [];
    if (plan.handbacks.length) {
      const { handBack } = await import("../failure.mjs");
      for (const hb of plan.handbacks) {
        const res = await handBack(ctx, { unitId: hb.unitId, cause: "owner", reasonCode: hb.reasonCode ?? (plan.kind === "gate" ? "owner_refused_gate" : "answer_rework_budget"), reason: hb.reason }, deps);
        blocked.push(...res.blocked.map((b) => b.unit));
        if (res.warnings) warnings.push(...res.warnings);
      }
    }

    if (plan.kind === "parked") {
      try {
        await markInboxAnswered(project, path.resolve(project, state.integration.worktree), { id: question, value, date: nowIso(deps).slice(0, 10) }, deps);
      } catch (error) {
        warnings.push(`decisions.md not updated: ${String(error.message).slice(0, 160)}`);
      }
    }
    return {
      ...out,
      ...(blocked.length ? { blocked } : {}),
      ...(plan.assumption ? { assumption: plan.assumption } : {}),
      ...(plan.stop?.length ? { stopped_workers: plan.stop } : {}),
      ...(warnings.length ? { warnings } : {}),
    };
  });
  // N14: the live workers of units re-queued or handed back off a rejected assumption are stopped AFTER the fenced phase
  // (signalling processes never runs under the lease mutex), as resume does for an orphan worker.
  if (result.stopped_workers?.length) {
    try {
      const { stopWorkers } = await import("../workers.mjs");
      stopWorkers(project, result.stopped_workers, deps);
    } catch (error) {
      return { ...result, warnings: [...(result.warnings ?? []), `workers not stopped (${result.stopped_workers.join(", ")}): ${String(error.message).slice(0, 160)}`] };
    }
  }
  return result;
}
