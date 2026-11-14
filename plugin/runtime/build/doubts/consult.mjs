// Consult briefs and the queueing of the next `doubt-consult` unit of a doubt.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { logCapacityDecision } from "../../capacity.mjs";
import { readQuota } from "../quota.mjs";
import { atomicWriteText } from "../fsx.mjs";
import { consultCell } from "../routing.mjs";
import { findUnit, newUnit } from "../state.mjs";
import { cellText, consultOrigin, err } from "./common.mjs";
import { DOUBT_CAPS } from "./constants.mjs";

async function cardScope(project, slug, deps) {
  if (!slug) return null;
  try {
    const { readCard } = await import("../card.mjs");
    const card = await readCard(project, slug, { where: "any" }, deps.cardDeps ?? {});
    return card ? { dentro: card.dentro.map((i) => i.text), fuera: card.fuera.map((i) => i.text) } : null;
  } catch {
    return null;
  }
}

export async function consultBrief({ project, state, record, unit, consult, no, origin, reportPath }, deps) {
  const root = path.resolve(project, state.integration.worktree);
  const scope = await cardScope(project, state.scope.card, deps);
  const frds = [...new Set([unit.frd, ...(state.scope.frds ?? [])].filter(Boolean))];
  const answerShape = consult.via === "cli"
    ? '{"decision": "<option id>" | null, "rationale": "<text>", "consulted": null, "confidence": "high|medium|low", "reversible": true|false}'
    : '{"decision": "<option id>" | null, "rationale": "<text>", "confidence": "high|medium|low", "reversible": true|false}';
  const lines = [
    `# Unit ${consult.unit}: doubt-consult`,
    "",
    "## 1. Role",
    `You are consultant ${no} of an automated build's doubt ladder (${cellText(consult)}). You answer one design doubt. You do not write code, you do not edit any file except the answer file below, you never run git, and you never ask the owner.`,
    "",
    "## 2. The doubt",
    `- Doubt \`${record.id}\`, raised by unit \`${unit.id}\` (kind ${unit.kind}${unit.wos?.length ? `, work orders ${unit.wos.join(", ")}` : ""}${unit.frd ? `, ${unit.frd}` : ""}).`,
    `- Question: ${record.question}`,
    "- Options:",
    ...record.options.map((o) => `  - \`${o.id}\`: ${o.text}`),
    `- The author's preferred option: \`${record.preferred}\`. Why: ${record.why}`,
    ...(no > 1 ? ["- This is the tie-break consult; earlier consults are not shown on purpose: judge independently."] : []),
    "",
    "## 3. Scope of the work (Dentro / Fuera)",
    ...(scope ? [...scope.dentro.map((t) => `- Dentro: ${t}`), ...scope.fuera.map((t) => `- Fuera: ${t}`)] : ["- No card scope is available; use the FRDs below."]),
    "",
    "## 4. Sources (read-only)",
    `Read them in the integration worktree \`${root}\`: ${frds.map((f) => `\`docs/frds/${f}/frd.md\` (its AC lines) and \`docs/frds/${f}/blueprint.md\``).join(", ") || "`docs/frds/*/frd.md`"}, \`docs/decision-log.md\`, the DRs of \`factory/decisions/registry.yaml\` and \`factory/memory/INDEX.md\` of the factory.`,
    ...(origin === "drive" || origin === "codex_app" ? ["The sources step was skipped for this doubt: check those sources FIRST; if one states the answer explicitly, choose it and cite it as `path:line` in `rationale`."] : []),
    "",
    "## 5. The owner's priorities",
    "Precision first, then speed, then quota.",
    "",
    "## 6. Never decided by a consult",
    "Answer `\"decision\": null` when choosing would: widen the scope beyond Dentro, reduce or reinterpret a Dentro item, change product scope (PRD, epics), decide a DR marked `requiere_humano: true`, cross a human gate (production, deletion, external communication), spend money, or do anything irreversible.",
    "",
    "## 7. Answer",
    `Answer with ONE JSON object and nothing else: ${answerShape}. \`decision\` is one option id or null; \`reversible\` says whether the chosen option can be undone later by an ordinary code change with no data loss, money or owner-visible effect. Write it to \`${reportPath}\` and print it as your final message.`,
    "",
  ];
  await atomicWriteText(consult.brief_path, `${lines.join("\n")}`, { fs: deps.fs ?? fsp });
}

// ---------------------------------------------------------------------------------------------------------------
// Ladder effects (inside a phase that holds the lease mutex; the caller writes the returned state)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Queue the next consult of a doubt as a `doubt-consult` unit, or report why it cannot be queued.
 * @returns {Promise<{state: object, record: object, consult: object}|{park: string}>}
 */
export async function queueConsult(ctx, state, record, no, deps) {
  if (record.consults.length >= DOUBT_CAPS.CONSULTS_PER_DOUBT) return { park: "cap_per_doubt" };
  if (no === 1 && (state.doubts_consulted ?? 0) >= DOUBT_CAPS.CONSULTED_DOUBTS_PER_BUILD) return { park: "cap_per_build" };
  const unit = findUnit(state, record.unit);
  const origin = consultOrigin(state, unit);
  const consulted = record.consults.map((c) => ({ runtime: c.runtime, model: c.model }));
  let cell;
  try {
    cell = consultCell({ origin, consultNo: no, consulted, id: `consult-${record.id}-${no}`, zone: unit?.zone ?? "none", availability: deps.availability ?? (await readQuota({}, { env: deps.env })).policy }, deps.tiers ? { tiers: deps.tiers } : undefined);
  } catch (error) {
    throw err("INVALID_STATE", `doubt consult routing failed: ${error.message}`);
  }
  if (cell?.capacity) logCapacityDecision(cell.task, cell.capacity, { env: deps.env, log: ctx.paths.capacityDecisionsFile });
  if (cell?.paused) return { wait: { reason: "capacity", resumeAt: cell.resumeAt, no } };
  if (!cell) return { park: "no_consultant" };
  const unitId = `u-doubt-consult-${record.id}-c${no}`;
  if (findUnit(state, unitId)) throw err("INVALID_STATE", `consult unit ${unitId} already exists`);
  const via = cell.runtime === "codex" || ["drive", "codex-session"].includes(state.coordinator) ? "cli" : "agent";
  const consult = { runtime: cell.runtime, model: cell.model, effort: cell.effort, via, unit: unitId, brief_path: ctx.paths.briefFile(unitId), answer: null };
  const consultUnit = newUnit({ id: unitId, kind: "doubt-consult", frd: unit?.frd ?? null, doubt_id: record.id, zone: unit?.zone ?? "none" });
  await consultBrief({ project: ctx.project, state, record, unit, consult, no, origin, reportPath: ctx.paths.unitAnswerFile(unitId) }, deps);
  const { capacity_wait: _wait, ...readyRecord } = record;
  const nextRecord = { ...readyRecord, step: no === 1 ? "consult1" : "consult2", consults: [...record.consults, consult] };
  const nextState = { ...state, units: [...state.units, consultUnit], doubts_consulted: (state.doubts_consulted ?? 0) + (no === 1 ? 1 : 0) };
  await ctx.appendEvent({ type: "unit_queued", data: consultUnit });
  if (no === 1) await ctx.appendEvent({ type: "doubt_consulted", data: { doubt_id: record.id, unit: record.unit, consult_unit: unitId, consult_no: no, cell, via } });
  return { state: nextState, record: nextRecord, consult: { unit: unitId, runtime: cell.runtime, model: cell.model, effort: cell.effort, brief_path: consult.brief_path, via } };
}

/** Retry an unconsumed consult under the scheduler's existing lease mutex. */
export async function retryCapacityConsults(ctx, state, deps) {
  const { readDoubt, writeDoubt } = await import("./records.mjs");
  const waits = [];
  for (const unit of state.units.filter(u => u.doubt_id && u.kind !== "doubt-consult" && u.state === "reported")) {
    const record = await readDoubt(ctx.project, unit.doubt_id, deps);
    if (!record?.capacity_wait) continue;
    const queued = await queueConsult(ctx, state, record, record.capacity_wait.no, deps);
    if (queued.wait) {
      waits.push(queued.wait.resumeAt);
      await writeDoubt(ctx.project, { ...record, capacity_wait: queued.wait }, deps);
    } else if (queued.state) {
      state = queued.state;
      await writeDoubt(ctx.project, queued.record, deps);
    } else throw err("INVALID_STATE", `pending capacity consult cannot advance: ${queued.park}`);
  }
  return { state, waits };
}
