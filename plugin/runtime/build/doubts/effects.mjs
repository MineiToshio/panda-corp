// Ladder effects that end a doubt: decide (decision-log entry, inbox, commit, unit re-queued) and park (park or build on
// an assumption). They run inside a phase that holds the lease mutex; the caller writes the returned state.
import path from "node:path";
import { nowIso } from "../fsx.mjs";
import { assumeUnits, createAssumeBranch, parkOrAssume, parkUnits } from "../park.mjs";
import { findUnit, isTerminalUnit } from "../state.mjs";
import { emitSafely, es, notifySafely, oneLine } from "./common.mjs";
import { commitIntegration, prependEntry, writeInbox } from "./integrationLog.mjs";
import { advisorsEs, decisionLogEntry, inboxEntry, parkReasonEs } from "./texts.mjs";

/** The doubted unit was settled meanwhile (a hand-back blocked it, N3): the ladder changes nothing on its behalf. */
export const settledUnit = (state, record) => {
  const unit = findUnit(state, record.unit);
  return !unit || isTerminalUnit(unit);
};
export const settledOut = (state, record) => ({ state, record, out: { step: record.step, applied: false, reason: "unit_settled" } });

export async function decide(ctx, state, record, { value, decided_by, why, voters }, deps) {
  if (settledUnit(state, record)) return { state, record, decision: null, sha: null, warnings: [], applied: false };
  const unit = findUnit(state, record.unit);
  const decided = { ...record, step: "decided", decision: { value, why: oneLine(why, 600) || "decided by the ladder", decided_by } };
  const integrationRoot = path.resolve(ctx.project, state.integration.worktree);
  const date = nowIso(deps).slice(0, 10);
  const logAbs = path.join(integrationRoot, "docs", "decision-log.md");
  await prependEntry(logAbs, decisionLogEntry({ record: decided, unit, runId: ctx.runId, branch: ctx.paths.integrationBranch(ctx.runId), card: state.scope.card, date, advisors: voters }), "# Decision Log", deps);
  const inbox = await writeInbox(ctx.project, integrationRoot, inboxEntry({
    record: decided, unit, runId: ctx.runId, date, blocks: [],
    status: `RESUELTO: decidido sin el owner, opción ${value} (${date}). Para revertirlo di "Revierte la decisión ${record.id}".`,
    effect: `Se decidió sin ti (${decided_by === "sources" ? `lo dice ${es(decided.decision.why)}` : `consultas: ${advisorsEs(decided)}`}) porque es reversible y está dentro del alcance.`,
  }), deps);
  const files = ["docs/decision-log.md", ...(inbox.tracked ? [inbox.rel] : [])];
  const sha = await commitIntegration(integrationRoot, files, `docs(build): decided without the owner ${record.id} (${unit.id})\n\nUnit: ${unit.id}\nDoubt: ${record.id}\n`, deps);
  const nextState = { ...state, units: state.units.map((u) => (u.id === unit.id ? { ...u, state: "queued", token_hash: null } : u)) };
  if (unit.state !== "queued") await ctx.appendEvent({ type: "unit_state", data: { unit: unit.id, from: unit.state, to: "queued" } });
  await ctx.appendEvent({
    type: "autonomous_decision",
    data: {
      doubt_id: record.id, unit: unit.id, question: oneLine(record.question, 400), value, preferred: record.preferred, decided_by, sha,
      advisors: (voters ?? []).map((c) => ({ runtime: c.runtime, model: c.model, effort: c.effort, decision: c.answer.decision, confidence: c.answer.confidence })),
      revert_es: `Di "Revierte la decisión ${record.id}": se abre una tarjeta de cambio.`,
    },
  });
  const warning = await emitSafely(deps, "AutonomousDecision", { unit: unit.id, doubt: record.id, value, decided_by });
  return { state: nextState, record: decided, decision: decided.decision, sha, warnings: warning ? [warning] : [] };
}

export async function park(ctx, state, record, { reasons, reversible }, deps) {
  if (settledUnit(state, record)) return { state, record, mode: null, branch: null, units: [], commit: null, block: { ratio: 0 }, reasons, notice_es: null, warnings: [], applied: false };
  if (reversible === true) {
    const why = `Reversible technical assumption: ${record.why || record.question}. Evidence was inconclusive (${reasons.join(", ")}). Revert by replacing option ${record.preferred} in unit ${record.unit} through a change card; no protected action is authorized.`;
    const chosen = await decide(ctx, state, record, { value: record.preferred, decided_by: "engine", why, voters: [] }, deps);
    const assumed = { ...chosen.record, assumption: { option: record.preferred, branch: state.integration.branch,
      reversible: true, accepted: true, rationale: why, revert: `Replace option ${record.preferred} in ${record.unit} through a change card.` } };
    return { ...chosen, record: assumed, mode: "assume", branch: null, units: [record.unit], commit: chosen.sha,
      block: { ratio: 0 }, reasons, notice_es: null };
  }
  const unit = findUnit(state, record.unit);
  const integrationRoot = path.resolve(ctx.project, state.integration.worktree);
  const date = nowIso(deps).slice(0, 10);
  const { mode, block } = parkOrAssume(state, unit.id, { reversible });
  let plan;
  let parkedRecord;
  let effect;
  let blocks;
  let branch = null;
  if (mode === "assume") {
    branch = ctx.paths.assumeBranch(ctx.runId, record.id);
    await createAssumeBranch({ integrationRoot, branch }, deps);
    plan = assumeUnits(state, unit.id, { question: record.id });
    parkedRecord = { ...record, step: "parked", assumption: { option: record.preferred, branch } };
    blocks = [];
    effect = `Nadie pudo decidirla con seguridad (${parkReasonEs(reasons)}). Como arrastra más de la mitad del trabajo pendiente y la opción preferida es reversible, sigo construyendo sobre la opción ${record.preferred} en la rama \`${branch}\`, que NO se aterriza hasta que respondas. Si eliges otra opción, esa parte se rehace con tu respuesta.`;
  } else {
    plan = parkUnits(state, unit.id, { reason: "owner_question", question: record.id });
    parkedRecord = { ...record, step: "parked" };
    blocks = plan.parked.map((p) => p.unit);
    effect = `Nadie pudo decidirla con seguridad (${parkReasonEs(reasons)}). Esperan ${blocks.length} unidad(es); todo lo independiente sigue. Si no respondes, esas unidades siguen esperando y no se aterrizan.`;
  }
  const inbox = await writeInbox(ctx.project, integrationRoot, inboxEntry({ record: parkedRecord, unit, runId: ctx.runId, date, status: "PENDIENTE", blocks, effect }), deps);
  const commit = inbox.tracked ? await commitIntegration(integrationRoot, [inbox.rel], `chore(build): park ${unit.id} on ${record.id}\n\nUnit: ${unit.id}\nDoubt: ${record.id}\n`, deps) : null;
  for (const event of plan.events) await ctx.appendEvent(event);
  const warning = await emitSafely(deps, "UnitParked", { unit: unit.id, doubt: record.id, reason: mode === "assume" ? "built_on_assumption" : "owner_question", units: mode === "assume" ? plan.units : blocks });
  await notifySafely(deps, mode === "assume"
    ? { title: "Build: construyo sobre un supuesto", message: `Sigo con la opción ${record.preferred} en ${unit.id} sin aterrizarla. Necesito tu decisión (${record.id}).` }
    : { title: "Build: duda aparcada", message: `Aparqué ${unit.id}: necesito tu decisión (${record.id}). Lo demás sigue.` });
  return {
    state: plan.state, record: parkedRecord, mode, branch, units: mode === "assume" ? plan.units : blocks, commit, block, reasons,
    notice_es: mode === "assume" ? `Construyo sobre supuesto: ${unit.id} y dependientes en ${branch}, sin aterrizar. Pregunta ${record.id}.` : `Aparqué ${unit.id}: necesito tu decisión (${record.id}). Lo demás sigue.`,
    warnings: warning ? [warning] : [],
  };
}
