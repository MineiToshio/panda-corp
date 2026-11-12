// `doubt answer`: file a sources or consult answer and advance the ladder.
import { releaseToken, verifyToken } from "../admission.mjs";
import { fencedTwoPhase, findUnit, isTerminalUnit } from "../state.mjs";
import { err } from "./common.mjs";
import { ASK_OWNER_OPTION, OPEN_STEPS } from "./constants.mjs";
import { advance, output, parkOut } from "./advance.mjs";
import { decide, settledOut } from "./effects.mjs";
import { readInputFile, validateConsultAnswer, validateSourcesAnswer } from "./input.mjs";
import { readDoubt, writeDoubt } from "./records.mjs";

/**
 * File one consult answer and advance the ladder, inside a phase that already holds the lease mutex (the `next` harvest
 * of a `via:"cli"` consult, or `doubt answer`). The consult unit becomes `verified`. The caller writes the returned state.
 * @param {{project: string, paths: object, runId: string, appendEvent: Function}} ctx mutex-holding ctx of `fencedTwoPhase`
 * @param {object} state current run state (not mutated)
 * @param {{doubtId: string, answer: object}} input `answer` = a doubt-answer.schema.json object
 * @param {object} [deps]
 * @returns {Promise<{state: object, result: object}>} `result` = the `doubt` command output
 * @throws INVALID_INPUT (answer does not fit), INVALID_STATE (no pending consult)
 */
export async function ingestConsultAnswer(ctx, state, { doubtId, answer }, deps = {}) {
  const record = await readDoubt(ctx.project, doubtId, deps);
  if (!record) throw err("INVALID_INPUT", `unknown doubt ${doubtId}`);
  if (record.step !== "consult1" && record.step !== "consult2") throw err("INVALID_INPUT", `doubt ${doubtId} is at step ${record.step}: no consult is pending`);
  const index = record.consults.findIndex((c) => c.answer === null);
  if (index < 0) throw err("INVALID_STATE", `doubt ${doubtId} has no pending consult`);
  const consult = record.consults[index];
  const valid = await validateConsultAnswer(answer, record, deps);
  const filed = { ...valid, consulted: { runtime: consult.runtime, model: consult.model, effort: consult.effort } };
  const nextRecord = { ...record, consults: record.consults.map((c, i) => (i === index ? { ...c, answer: filed } : c)) };
  let nextState = state;
  const cu = findUnit(state, consult.unit);
  if (cu && !isTerminalUnit(cu)) {
    nextState = { ...state, units: state.units.map((u) => (u.id === cu.id ? { ...u, state: "verified", token_hash: null } : u)) };
    await ctx.appendEvent({ type: "unit_state", data: { unit: cu.id, from: cu.state, to: "verified" } });
  }
  const advanced = await advance(ctx, nextState, nextRecord, deps);
  await writeDoubt(ctx.project, advanced.record, deps);
  return { state: advanced.state, result: output("answer", advanced.record, advanced.out) };
}

/**
 * `doubt answer --epoch E --id D --file F [--token T]` (fenced): the sources answer (no token) or a consult answer. The
 * token is required for a consult served `via:"agent"`; it is verified against the consult unit and released.
 * @param {{project: string, epoch: number, id: string, file: string, token?: string}} input
 * @param {object} [deps] as openDoubt
 * @returns {Promise<{ok: true, cmd: "doubt", sub: "answer", doubt_id: string, step: string, consult?: object, decision: object|null}>}
 * @throws USAGE, INVALID_INPUT (bad file, wrong token, doubt not open), INVALID_STATE, FENCE
 */
export async function answerDoubt({ project, epoch, id, file, token = null }, deps = {}) {
  if (!id) throw err("USAGE", "--id is required");
  const answer = await readInputFile(file, deps);
  return fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps }, undefined, undefined, async (_result, _intent, ctx) => {
    const state = await ctx.readState();
    if (!state) throw err("INVALID_STATE", "no run state: start the run first");
    const record = await readDoubt(project, id, deps);
    if (!record) throw err("INVALID_INPUT", `unknown doubt ${id}`);
    if (!OPEN_STEPS.includes(record.step)) throw err("INVALID_INPUT", `doubt ${id} is ${record.step}: it is not open`);
    if (record.step === "sources") {
      const filed = validateSourcesAnswer(answer, record);
      let next;
      if (filed.decision === null) {
        next = await advance(ctx, state, record, deps);
      } else if (filed.decision === ASK_OWNER_OPTION) {
        next = await parkOut(ctx, state, record, ["owner_requested"], deps);
      } else {
        const done = await decide(ctx, state, record, { value: filed.decision, decided_by: "sources", why: filed.rationale, voters: [] }, deps);
        next = done.applied === false ? settledOut(state, record) : { state: done.state, record: done.record, out: { step: "decided", decision: done.decision, warnings: done.warnings } };
      }
      await writeDoubt(project, next.record, deps);
      await ctx.writeState(next.state);
      return output("answer", next.record, next.out);
    }
    const pending = record.consults.find((c) => c.answer === null);
    if (!pending) throw err("INVALID_STATE", `doubt ${id} has no pending consult`);
    const admission = { file: ctx.paths.admissionFile };
    if (pending.via === "agent") {
      if (!token) throw err("INVALID_INPUT", `--token of ${pending.unit} is required for a consult served via agent`);
      const check = verifyToken(pending.unit, token, admission);
      if (!check.ok) throw err("INVALID_INPUT", `unit token rejected for ${pending.unit} (${check.reason})`);
    }
    const { state: nextState, result } = await ingestConsultAnswer(ctx, state, { doubtId: id, answer }, deps);
    if (pending.via === "agent") releaseToken(pending.unit, admission);
    await ctx.writeState(nextState);
    return result;
  });
}
