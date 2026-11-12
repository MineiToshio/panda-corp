// Failure policy of the v2 build engine (BUILD-15, D21) and the `handback` command logic.
//
//  * Policy (pure): at most 3 executions per unit; attempt 3 is queued automatically and only with a diagnosis and
//    evidence that differs from the previous failure; a hand-back parks the unit and its dependents (units `blocked`,
//    WOs `BLOCKED`) while independent units go on; 3 consecutive `env-infra` hand-backs stop the run.
//  * Hand-back (I/O): `handback/<unit>.md`, a pending entry in `.pandacorp/inbox/decisions.md`, WO `BLOCKED` + a commit
//    on the integration branch, journal, state.
//  * Engine failure (a fault of the CLI, not of the product): retry the step once after `rebuildState`; if it repeats,
//    stop at the last safe point, write `handback/engine.md`, file the next free factory backlog item, journal
//    `engine_failure`, release the lease and raise ENGINE_FAILURE (exit 8). It consumes no unit attempt.
//
// Every function takes its injected `deps` LAST (fs, exec, env, clock, buildState, emit, factoryRoot); nothing here
// touches the real home, events file or host slots unless the caller's deps point there. Owner-facing text is Spanish
// and has no em/en dashes (the one exception is the `## <date> — <title>` heading that the decisions inbox format
// requires, see decisionHeading).
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken } from "./admission.mjs";
import { atomicWriteJson, atomicWriteText, defaultExec, nowIso, sha256Hex, writeTarget } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";
import { REVIEW_TYPE_KINDS, fencedTwoPhase, findUnit, isTerminalUnit, patchUnit, readLeaseToken, readState, rebuildState } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Policy constants (the Constants table of build-engine.md: executions per unit, env-infra streak, engine failures). */
export const POLICY = Object.freeze({ MAX_EXECUTIONS: 3, ENV_INFRA_STREAK_STOP: 3, ENGINE_RETRIES: 1, ENGINE_FAILURES_EXTRA_LINE: 3, TAIL_LINES: 40 });

const WO_UNIT_KINDS = Object.freeze(["build", "patch"]);
const DONE_STATES = Object.freeze(["committed", "integrated", "reviewing", "verified", "landed"]);
/** Failure sources that carry their own evidence (the reviewer's RED tests, a gate's failing run): no builder diagnosis is needed at attempt 3. */
const EVIDENCE_SOURCES = Object.freeze(["review_reopen", "g2_red", "g3_red"]);

const oneLine = (text, max = 160) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const uniqSorted = (list = []) => [...new Set(list.map(String))].sort();
const lastLines = (text, n = POLICY.TAIL_LINES) => String(text ?? "").replace(/\s+$/, "").split("\n").slice(-n).join("\n");
const woKey = (wo) => String(wo).toLowerCase();

// ---------------------------------------------------------------------------------------------
// Policy (pure)
// ---------------------------------------------------------------------------------------------

/**
 * Evidence of one failure as the CLI saw it (its own G1/G2 re-run plus the diff), and its identity hash.
 * The hash covers the failing test ids, the normalised command, the implicated files and the diagnosis CAUSE; the
 * diagnosis prose is left out on purpose (a model rewords it every time, which would make "identical" unreachable).
 * @param {{tests?: string[], command?: string|null, files?: string[], diagnosis?: {cause: string}|null}} input
 * @returns {{tests: string[], command: string|null, files: string[], cause: string|null, hash: string}}
 */
export function buildEvidence({ tests = [], command = null, files = [], diagnosis = null } = {}) {
  const canon = { tests: uniqSorted(tests), command: command ? oneLine(command, 2000) : null, files: uniqSorted(files), cause: diagnosis?.cause ?? null };
  return { ...canon, hash: sha256Hex(JSON.stringify(canon)) };
}

/**
 * Highest attempt already spent on any of the given work orders (build, patch and tests units; review-type units do not count).
 * The 3-execution budget is counted per WO as this maximum (A13).
 * @param {object} state run state
 * @param {string[]} wos work order ids
 * @returns {number} 0 when nothing ran
 */
export function executionsUsed(state, wos) {
  const wanted = new Set((wos ?? []).map(woKey));
  let used = 0;
  for (const unit of state.units) {
    if (REVIEW_TYPE_KINDS.includes(unit.kind) || !unit.wos.some((wo) => wanted.has(woKey(wo)))) continue;
    used = Math.max(used, unit.attempt);
  }
  return used;
}

/** Ids of every unit that transitively `depends_on` the given one (the given unit is not included). */
export function dependentsOf(state, unitId) {
  const found = new Set();
  const queue = [unitId];
  while (queue.length) {
    const head = queue.shift();
    for (const unit of state.units) {
      if (unit.depends_on.includes(head) && !found.has(unit.id)) { found.add(unit.id); queue.push(unit.id); }
    }
  }
  return [...found];
}

/** True when the run must stop at a safe point because of consecutive `env-infra` hand-backs (BUILD-15, A11). */
export const envInfraStop = (state) => (state.handbacks_in_a_row ?? 0) >= POLICY.ENV_INFRA_STREAK_STOP;

const handbackDecision = (base, reasonCode, cause) => ({ ...base, action: "handback", attempt: null, cause, reason_code: reasonCode });

/**
 * Decide what a failed execution leads to (D21). Pure.
 *
 * `failure.source` is one of `report_rejected | report_failed | worker_failed | g1_red | review_reopen | g2_red | g3_red`
 * (`worker_failed` = the worker ended without a valid report; same-unit mode, NOT an evidence source). Report-side
 * failures re-queue the SAME unit at attempt+1 (`unit_mode:"same"`); reviewer and gate failures need a new `patch`
 * unit (`unit_mode:"patch"`) whose attempt is the number returned here.
 *
 * Actions: `requeue` (attempt 2), `escalate` (attempt 3, the CLI's own automatic escalation, journaled as `escalated`),
 * `doubt` (spec-ambiguous or a missing decision: the doubt ladder, no attempt consumed), `dispute` (test-defective, the
 * reviewer answers once: no attempt consumed), `handback` (`reason_code` says why).
 *
 * @param {{state: object, unit?: object|null, wos?: string[], failure?: {source?: string}, diagnosis?: {cause: string, detail?: string}|null,
 *   evidence?: object, reviewer_replies?: number, decision_missing?: boolean, human_gate?: string|null}} input
 *   `unit` is the failing unit (omit for a brand-new patch); `wos` defaults to `unit.wos` and must be the IMPLICATED work orders
 * @returns {{action: string, attempt: number|null, failed_attempt: number, unit_mode: "same"|"patch", cause: string, reason_code: string|null, evidence: object, evidence_hash: string}}
 */
export function decideFailure(input) {
  const { state, unit = null, failure = {}, diagnosis = null, reviewer_replies: replies = 0, decision_missing: decisionMissing = false, human_gate: humanGate = null } = input;
  const wos = input.wos ?? unit?.wos ?? [];
  const evidence = buildEvidence({ ...(input.evidence ?? {}), diagnosis });
  const failedAttempt = Math.max(unit?.attempt ?? 0, executionsUsed(state, wos), 1);
  const cause = diagnosis?.cause ?? (humanGate ? "gate" : "code");
  const mode = EVIDENCE_SOURCES.includes(failure.source) ? "patch" : "same";
  const base = { failed_attempt: failedAttempt, unit_mode: mode, cause, reason_code: null, evidence, evidence_hash: evidence.hash };

  if (humanGate) return handbackDecision(base, "human_gate", "gate");
  if (diagnosis?.cause === "spec-ambiguous" || decisionMissing) return { ...base, action: "doubt", attempt: null };
  if (diagnosis?.cause === "dependency") return handbackDecision(base, "dependency_missing", cause);
  if (diagnosis?.cause === "test-defective") {
    return replies >= 1 ? handbackDecision(base, "test_defective_disputed", cause) : { ...base, action: "dispute", attempt: null };
  }
  if (failedAttempt >= POLICY.MAX_EXECUTIONS) return handbackDecision(base, "budget_exhausted", cause);
  if (failedAttempt === 1) return { ...base, action: "requeue", attempt: 2 };

  // failedAttempt === 2: attempt 3 only with a diagnosis (or the reviewer/gate's own RED evidence) and evidence that changed.
  const hasEvidence = evidence.tests.length > 0 || evidence.files.length > 0;
  if (!diagnosis && !(EVIDENCE_SOURCES.includes(failure.source) && hasEvidence)) return handbackDecision(base, "no_diagnosis", cause);
  const previousHash = unit?.evidence_hash ?? input.previous_evidence_hash ?? null;
  if (previousHash && previousHash === evidence.hash) return handbackDecision(base, "evidence_identical", cause);
  return { ...base, action: "escalate", attempt: POLICY.MAX_EXECUTIONS };
}

/**
 * State and journal effect of a `requeue`/`escalate` decision on the SAME unit (pure): attempt+1 in place, state `queued`,
 * token released, evidence hash recorded. The journal gets the full unit (`unit_queued`, A14) and, for attempt 3, `escalated`.
 * @param {{state: object, unitId: string, decision: object}} input
 * @returns {{state: object, events: {type: string, data: object}[]}}
 */
export function planRequeue({ state, unitId, decision }) {
  if (decision.action !== "requeue" && decision.action !== "escalate") throw err("INVALID_INPUT", `cannot requeue on a ${decision.action} decision`);
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  const next = { ...unit, attempt: decision.attempt, state: "queued", token_hash: null, evidence_hash: decision.evidence_hash };
  const events = [{ type: "unit_queued", data: next }];
  if (decision.action === "escalate") {
    events.push({ type: "escalated", data: { unit: unitId, attempt: decision.attempt, evidence: { tests: decision.evidence.tests, command: decision.evidence.command, files: decision.evidence.files, cause: decision.evidence.cause } } });
  }
  return { state: { ...state, units: state.units.map((u) => (u.id === unitId ? next : u)) }, events };
}

/**
 * State and journal effect of a hand-back (pure): the unit and every non-terminal dependent become `blocked` (the run's
 * terminal state for parked work, A11), their tokens are voided, and the env-infra streak is updated like replay does.
 * @param {{state: object, unitId: string, cause: string, reasonCode: string, reason: string, path?: string|null}} input
 * @returns {{state: object, events: {type: string, data: object}[], blocked: {unit: string, from: string, role: "self"|"dependent"}[], stop_run: boolean}}
 */
export function planHandback({ state, unitId, cause, reasonCode, reason, path: handbackPath = null }) {
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (unit.kind === "doubt-consult") throw err("INVALID_INPUT", `unit ${unitId} is a doubt consult: file its answer with doubt answer, a hand-back is not allowed`);
  const targets = [{ unit, role: "self" }];
  for (const id of dependentsOf(state, unitId)) {
    const dep = findUnit(state, id);
    if (!isTerminalUnit(dep)) targets.push({ unit: dep, role: "dependent" });
  }
  const ids = new Set(targets.map((t) => t.unit.id));
  const streak = cause === "env-infra" ? (state.handbacks_in_a_row ?? 0) + 1 : 0;
  const next = {
    ...state,
    handbacks_in_a_row: streak,
    units: state.units.map((u) => (ids.has(u.id) ? { ...u, state: "blocked", token_hash: null, parked: null, pending_answer: null, waiting_gate: null } : u)),
  };
  const events = [
    { type: "handback", data: { unit: unitId, cause, reason_code: reasonCode, reason: oneLine(reason, 400), attempt: unit.attempt, path: handbackPath, blocked: targets.map((t) => t.unit.id) } },
    ...targets.map((t) => ({ type: "unit_state", data: { unit: t.unit.id, from: t.unit.state, to: "blocked" } })),
  ];
  return { state: next, events, blocked: targets.map((t) => ({ unit: t.unit.id, from: t.unit.state, role: t.role })), stop_run: streak >= POLICY.ENV_INFRA_STREAK_STOP };
}

/**
 * Apply a pure plan under a phase-2 ctx of `fencedTwoPhase` (state first, then the journal events in order).
 * @param {{writeState: Function, appendEvent: Function}} ctx
 * @param {{state: object, events: object[]}} plan
 */
export async function commitPlan(ctx, plan) {
  await ctx.writeState(plan.state);
  for (const event of plan.events) await ctx.appendEvent(event);
}

// ---------------------------------------------------------------------------------------------
// Owner-facing text (Spanish)
// ---------------------------------------------------------------------------------------------

const CAUSE_ES = Object.freeze({
  code: "fallo de código", "test-defective": "prueba defectuosa", "spec-ambiguous": "especificación ambigua", "env-infra": "entorno o infraestructura",
  dependency: "dependencia externa (secreto, cuenta o servicio)", gate: "puerta humana", owner: "decisión del owner",
});
const REASON_ES = Object.freeze({
  budget_exhausted: "se agotaron las 3 ejecuciones de la unidad", evidence_identical: "el tercer intento no aportaba evidencia nueva respecto al segundo",
  no_diagnosis: "el segundo intento falló sin diagnóstico, no hay base para un tercero", test_defective_disputed: "la prueba sigue en disputa tras la réplica del revisor",
  dependency_missing: "falta un secreto, una cuenta o un servicio que solo tú puedes aportar", human_gate: "la unidad necesita una puerta humana",
  owner_refused_gate: "el owner rechazó la puerta humana", manual: "devuelta a mano por la sesión",
  worker_blocked: "el trabajador se declaró bloqueado y no puede seguir sin ti", worker_failed: "el trabajador falló sin informe válido en sus intentos",
  answer_rework_budget: "tu respuesta pedía rehacer una unidad que ya agotó sus 3 ejecuciones",
  review_blocked: "la revisión independiente bloqueó la unidad (toca algo fuera del alcance o no puede aprobarse)",
});
const causeEs = (cause) => CAUSE_ES[cause] ?? String(cause);
const reasonEs = (code) => REASON_ES[code] ?? String(code);

const OPTIONS_ES = Object.freeze({
  dependency: ["Aportar el secreto, la cuenta o el servicio que falta y reanudar (recomendada: es lo único que bloquea).", "Cambiar el work order para que no dependa de ello."],
  "test-defective": ["Corregir la prueba discutida con /pandacorp:change y reanudar (recomendada: el código no se toca).", "Mantener la prueba y reescribir el work order."],
  "env-infra": ["Arreglar el entorno (red, disco, herramienta) y reanudar (recomendada).", "Dejar la unidad bloqueada y seguir con lo que no depende de ella."],
  gate: ["Reformular el work order sin la acción protegida (recomendada).", "Aprobar la puerta con /pandacorp:decide si de verdad quieres esa acción."],
  default: ["Revisar el diagnóstico y ajustar el work order o la especificación con /pandacorp:change, luego reanudar (recomendada).", "Revertir a mano los commits de la unidad (solo tú decides un revert)."],
});

function decisionHeading(date, text) {
  // The decisions inbox format (decisions-inbox-template.md, parseDecisionBlocks) requires "## YYYY-MM-DD — <title>".
  return `## ${date} — ${text}`;
}

function handbackDecisionEntry(info) {
  const options = OPTIONS_ES[info.cause] ?? OPTIONS_ES.default;
  return [
    decisionHeading(info.date, `${info.wos.join(", ") || info.unit}: unidad devuelta al owner`),
    `- **Qué decidir:** cómo seguir con la unidad ${info.unit}, que el motor no ha podido terminar.`,
    `- **Contexto / por qué:** el motor construye cada unidad con un máximo de 3 ejecuciones y no insiste más allá. Causa: ${causeEs(info.cause)}. Motivo: ${reasonEs(info.reasonCode)}${info.reason ? ` (${oneLine(info.reason, 200)})` : ""}. Su trabajo anterior está a salvo (commits y ramas conservados). Si no decides, esa unidad y las que dependen de ella se quedan sin construir; el resto de la obra continúa. Detalle completo en ${info.path}.`,
    `- **Opciones:** ${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o.replace(/ \(recomendada.*$/, "").replace(/\.$/, "")}`).join(" · ")}`,
    `- **Detalle de alternativas:** ${options.map((o, i) => `${i + 1}) ${o}`).join(" ")}`,
    `- **Recomendación (del agente):** la opción A. Cambiaría de opinión si el diagnóstico del archivo de detalle apunta a un fallo de la especificación y no de la unidad.`,
    `- **Bloquea:** ${info.blockedUnits.join(", ")}`,
    "- **Estado:** PENDIENTE",
    "",
  ].join("\n");
}

function handbackMarkdown(info) {
  const options = OPTIONS_ES[info.cause] ?? OPTIONS_ES.default;
  const attempts = info.attempts.length ? info.attempts.map((a, i) => `  ${i + 1}) ${a}`).join("\n") : "  (sin detalle de intentos disponible)";
  return [
    `# Unidad devuelta: ${info.unit}`,
    "",
    `unidad: ${info.unit} / ${info.wos.join(", ") || "sin WO"}   estado: BLOCKED (needs-owner)   intento: ${info.attempt}/${POLICY.MAX_EXECUTIONS}   causa: ${causeEs(info.cause)}`,
    `motivo: ${reasonEs(info.reasonCode)}${info.reason ? ` (${oneLine(info.reason, 400)})` : ""}`,
    `falla: ${info.failure?.command ?? "sin comando registrado"}`,
    info.failure?.tail ? ["```", lastLines(info.failure.tail), "```"].join("\n") : "(sin salida registrada)",
    "intentos:",
    attempts,
    `diagnóstico: ${info.diagnosis?.detail ? oneLine(info.diagnosis.detail, 1500) : "sin diagnóstico del trabajador"}`,
    `preservado: ${info.preserved.length ? info.preserved.join("; ") : "sin ramas de intento registradas"}; commits de unidad, tests RED y probes, journal y worktrees registrados; las WOs ya aterrizadas siguen intactas`,
    `unidades bloqueadas: ${info.blockedUnits.join(", ")}`,
    info.skippedWos.length ? `work orders sin tocar: ${info.skippedWos.join("; ")}` : null,
    "opciones:",
    ...options.map((o, i) => `  (${i + 1}) ${o}`),
    "Decidir con /pandacorp:decide.",
    "",
  ].filter((line) => line !== null).join("\n");
}

const handbackNotice = (info) => `Unidad devuelta: ${info.unit} (${info.wos.join(", ") || "sin WO"}). Causa: ${causeEs(info.cause)}. Su trabajo anterior está a salvo y el resto de la obra sigue. Detalle en ${info.path}; decide con /pandacorp:decide.`;

// ---------------------------------------------------------------------------------------------
// Hand-back (I/O)
// ---------------------------------------------------------------------------------------------

async function findWorkOrderFiles(root, ids, { fs = fsp } = {}) {
  const wanted = new Set(ids.map(woKey));
  const found = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const frd of frds.sort()) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names = [];
    try { names = await fs.readdir(dir); } catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const head = (await fs.readFile(path.join(dir, name), "utf8")).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (head.match(/^id:[ \t]*(.*?)[ \t]*$/m)?.[1]?.replace(/^["']|["']$/g, "") || name.replace(/\.md$/, "")).toLowerCase();
      if (wanted.has(id)) found.set(id, path.posix.join("docs", "frds", frd, "work-orders", name));
    }
  }
  return found;
}

async function insertDecisionEntry(project, integrationRoot, entry, deps) {
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  const fs = deps.fs ?? fsp;
  let current = "";
  try { current = await fs.readFile(abs, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  // Most recent on top: before the first decision heading, or at the end when there is none.
  const firstHeading = current.search(/^## /m);
  const next = !current.trim() ? `# Decisiones pendientes\n\n${entry}` : firstHeading < 0 ? `${current.replace(/\s*$/, "\n\n")}${entry}` : `${current.slice(0, firstHeading)}${entry}\n${current.slice(firstHeading)}`;
  await atomicWriteText(abs, next, { fs, mode: 0o644 });
  return { rel, tracked };
}

async function branchTips(project, runId, unit, deps) {
  const paths = buildPaths(project, deps);
  const exec = deps.exec ?? defaultExec;
  const out = [];
  for (let attempt = 1; attempt <= unit.attempt; attempt += 1) {
    const branch = paths.unitBranch(runId, unit.id, attempt);
    const res = await exec("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: project });
    if (res.code === 0) out.push(`rama ${branch} @ ${res.stdout.trim().slice(0, 12)}`);
  }
  return out;
}

async function journalTimeline(project, unitId, deps) {
  const paths = buildPaths(project, deps);
  try {
    const raw = await (deps.fs ?? fsp).readFile(paths.journalFile, "utf8");
    const lines = [];
    for (const line of raw.split("\n").filter(Boolean)) {
      const ev = JSON.parse(line);
      if (ev.data?.unit !== unitId) continue;
      if (ev.type === "unit_dispatched") lines.push(`ejecución ${lines.length + 1}: ${ev.data.cell?.model ?? "?"} ${ev.data.cell?.effort ?? "sin esfuerzo"} (${ev.data.via ?? "?"})`);
      else if (ev.type === "report_received" && lines.length) lines[lines.length - 1] += `; resultado: ${ev.data.outcome ?? "sin dato"}`;
    }
    return lines;
  } catch (error) {
    return [`cronología del journal no disponible: ${oneLine(error.message, 120)}`];
  }
}

async function commitIntegration(root, files, message, deps) {
  const exec = deps.exec ?? defaultExec;
  if (!files.length) return null;
  // `files` comes from `git status`, which lists an ignored path only when it is already tracked (a force-tracked decisions
  // inbox): plain `git add` refuses those (code-conventions, verified trap), so force the add of exactly these paths.
  const add = await exec("git", ["add", "-f", "--", ...files], { cwd: root });
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${oneLine(add.stderr, 200)}`);
  const commit = await exec("git", ["commit", "-q", "-m", message, "--", ...files], { cwd: root });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${oneLine(commit.stderr || commit.stdout, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  return head.stdout.trim();
}

/** Prefix of `root` inside its git repository ("" at the top, else `dir/`): porcelain output is repository-top relative. */
async function repoPrefix(root, deps) {
  const res = await (deps.exec ?? defaultExec)("git", ["rev-parse", "--show-prefix"], { cwd: root });
  if (res.code !== 0) throw err("FAILCLOSED", `git rev-parse --show-prefix failed in the integration worktree: ${oneLine(res.stderr, 200)}`);
  const prefix = res.stdout.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return prefix ? `${prefix}/` : "";
}

/** Tracked files the hand-back touched, relative to `root` (the product root, which is below the repository top for a nested project). */
async function changedTrackedFiles(root, deps) {
  const exec = deps.exec ?? defaultExec;
  const prefix = await repoPrefix(root, deps);
  const res = await exec("git", ["status", "--porcelain=v1", "-z", "--", "docs/frds", ".pandacorp/status.yaml", ".pandacorp/inbox/decisions.md"], { cwd: root });
  if (res.code !== 0) throw err("FAILCLOSED", `git status failed in the integration worktree: ${oneLine(res.stderr, 200)}`);
  return res.stdout.split("\0").filter((entry) => entry.length > 3).map((entry) => entry.slice(3)).filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length));
}

/**
 * Hand a unit back to the owner, under a phase-2 ctx (the `handback` command, or `report`/`review` when the policy says
 * so). Writes `handback/<unit>.md`, the pending decisions entry, WO `BLOCKED` + one commit on the integration branch,
 * then state and journal. Idempotent: a unit that is already `blocked` returns its existing path and writes nothing.
 * @param {{readState: Function, writeState: Function, appendEvent: Function, paths: object, project: string, runId: string}} ctx
 * @param {{unitId: string, cause?: string, reasonCode?: string, reason: string, failure?: {command?: string, tail?: string}, attempts?: string[], diagnosis?: object|null}} input
 * @param {object} [deps] fs, exec, buildState, emit, clock/env
 * @returns {Promise<{path: string, already: boolean, blocked: object[], wos_blocked: string[], wos_skipped: string[], commit: string|null, stop_run: boolean, notice_es: string}>}
 * @throws INVALID_INPUT for a doubt-consult unit (exit 6); INVALID_STATE for an unknown unit
 */
export async function handBack(ctx, input, deps = {}) {
  const { project, paths } = ctx;
  const state = await ctx.readState();
  const unit = findUnit(state, input.unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${input.unitId}`);
  const handbackPath = paths.handbackFile(unit.id);
  if (unit.state === "blocked") return { path: handbackPath, already: true, blocked: [], wos_blocked: [], wos_skipped: [], commit: null, stop_run: envInfraStop(state), notice_es: "" };

  const cause = input.cause ?? "owner";
  const reasonCode = input.reasonCode ?? "manual";
  const plan = planHandback({ state, unitId: unit.id, cause, reasonCode, reason: input.reason, path: handbackPath });
  const bs = deps.buildState ?? await import("../build-state.mjs");
  const integrationRoot = path.resolve(project, state.integration.worktree);
  const date = nowIso(deps).slice(0, 10);

  // 1. WO BLOCKED in the integration worktree (a dependent's reason names the unit that blocked it).
  const targets = plan.blocked.map((t) => findUnit(state, t.unit));
  const wosOf = (u) => (WO_UNIT_KINDS.includes(u.kind) ? u.wos : []);
  const files = await (deps.findWorkOrderFiles ?? findWorkOrderFiles)(integrationRoot, targets.flatMap(wosOf), { fs: deps.fs ?? fsp });
  const wosBlocked = [];
  const wosSkipped = [];
  for (const target of targets) {
    for (const wo of wosOf(target)) {
      const file = files.get(woKey(wo));
      const reason = target.id === unit.id ? `needs-owner: ${cause}: ${oneLine(input.reason, 140)}` : `blocked-by: ${unit.id}`;
      if (!file) { wosSkipped.push(`${wo}: sin fichero de work order`); continue; }
      try {
        await bs.transitionWorkOrderAt(integrationRoot, { file, to: "BLOCKED", reason });
        wosBlocked.push(wo);
      } catch (error) {
        if (error.code !== "INVALID_STATE") throw error;
        wosSkipped.push(`${wo}: ${oneLine(error.message, 100)}`);
      }
    }
  }

  // 2. The owner's inbox entry and the hand-back file.
  const wos = wosOf(unit);
  const info = {
    unit: unit.id, wos, cause, reasonCode, reason: input.reason, attempt: unit.attempt, date, path: handbackPath, failure: input.failure ?? null, diagnosis: input.diagnosis ?? null,
    attempts: input.attempts ?? await journalTimeline(project, unit.id, deps), preserved: await branchTips(project, ctx.runId, unit, deps),
    blockedUnits: plan.blocked.map((t) => t.unit), skippedWos: wosSkipped,
  };
  const inbox = await insertDecisionEntry(project, integrationRoot, handbackDecisionEntry(info), deps);
  await atomicWriteText(handbackPath, handbackMarkdown(info), { fs: deps.fs ?? fsp });

  // 3. One commit on the integration branch with every tracked file touched (WOs, rollups, a tracked decisions inbox).
  const trailers = [`Unit: ${unit.id}`, ...wosBlocked.map((wo) => `WO: ${wo}`)].join("\n");
  const commit = await commitIntegration(integrationRoot, await changedTrackedFiles(integrationRoot, deps), `chore(build): hand back ${unit.id} (${cause})\n\n${trailers}\n`, deps);

  // 4. State and journal (the caller's phase 2 holds the lease mutex).
  await commitPlan(ctx, plan);
  const emitted = await emitSafely(deps, "unit.parked", { unit: unit.id, reason: "handback", cause, wos });
  return { path: handbackPath, already: false, blocked: plan.blocked, wos_blocked: wosBlocked, wos_skipped: wosSkipped, commit, inbox: inbox.rel, stop_run: plan.stop_run, notice_es: handbackNotice(info), ...(emitted ? { warnings: [emitted] } : {}) };
}

/**
 * The `handback` command: `handback --epoch E --unit U --reason "<text>"` (fenced, phase 2 does the work).
 * @param {{project: string, epoch: number, unit: string, reason: string, cause?: string}} input `cause` defaults to `owner`
 * @param {object} [deps] see handBack; plus `buildState` for the fence
 * @returns {Promise<{ok: true, cmd: "handback", path: string, blocked: string[], stop_run: boolean, notice_es: string}>}
 * @throws USAGE (exit 2) without unit/reason; INVALID_INPUT (exit 6) on a doubt-consult unit; FENCE (exit 3)
 */
export async function handbackCommand({ project, epoch, unit, reason, cause = "owner" }, deps = {}) {
  if (!unit) throw err("USAGE", "handback needs --unit");
  if (!String(reason ?? "").trim()) throw err("USAGE", "handback needs --reason");
  return fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
    const res = await handBack(ctx, { unitId: unit, cause, reasonCode: "manual", reason }, deps);
    return { ok: true, cmd: "handback", path: res.path, blocked: res.blocked.map((b) => b.unit), stop_run: res.stop_run, notice_es: res.notice_es, ...(res.warnings ? { warnings: res.warnings } : {}) };
  });
}

const FAILABLE_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);
const FAILABLE_STATES = Object.freeze(["admitted", "running", "reported"]);
const OUTCOME_OF_SOURCE = Object.freeze({ report_rejected: "rejected", g1_red: "rejected", report_failed: "failed", worker_failed: "failed" });

/**
 * Apply the D21 policy to one failed execution of a unit, inside a fencedTwoPhase phase 2 (the caller holds the mutex).
 * The one shared derivation of "what happens next" for `report` (rejected/failed/blocked) and for a worker that ended
 * without a valid report (`failUnit`): requeue at attempt+1, escalate at attempt 3, doubt ladder, dispute, or hand-back.
 * Idempotency key is `input.attempt`: a unit that already moved past it (attempt changed, or `blocked|queued`) is a no-op.
 * @param {{readState: Function, writeState: Function, appendEvent: Function, paths: object, project: string, runId: string}} ctx
 * @param {{unitId: string, attempt: number, source: "report_rejected"|"report_failed"|"worker_failed",
 *   diagnosis?: {cause: string, detail?: string}|null, evidence?: {tests?: string[], command?: string|null, files?: string[]}, reasons: string[],
 *   failure?: {command?: string|null, tail?: string}, override?: "worker_blocked"|null, receivedEvent?: object|null, outcome?: string}} input
 *   `outcome` (optional) labels `attempt-<n>.json` (`rejected|failed|blocked`); by default it follows `source` (`blocked` under the override)
 * @param {object} [deps] see handBack
 * @returns {Promise<{applied: boolean, reason: null|"already_applied", action: "requeue"|"escalate"|"doubt"|"dispute"|"handback",
 *   next_attempt: number|null, cause: string, reason_code: string|null, handback?: {path: string, blocked: string[], stop_run: boolean, notice_es: string, reason_code: string}}>}
 * @throws INVALID_STATE (unknown unit, or a unit that is not admitted/running/reported); INVALID_INPUT (a review-type or consult unit)
 */
export async function applyUnitFailure(ctx, input, deps = {}) {
  const { unitId, attempt, source, diagnosis = null, evidence = {}, reasons = [], failure = {}, override = null, receivedEvent = null } = input;
  const state = await ctx.readState();
  const unit = findUnit(state, unitId);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
  if (!FAILABLE_KINDS.includes(unit.kind)) throw err("INVALID_INPUT", `unit ${unitId} is a ${unit.kind} unit: ${unit.kind === "doubt-consult" ? "doubt answer" : "review-record"} files its result, not a failure`);
  if (unit.attempt !== attempt || unit.state === "blocked" || unit.state === "queued") {
    const requeued = unit.state === "queued" && unit.attempt > attempt;
    return { applied: false, reason: "already_applied", action: unit.state === "blocked" ? "handback" : "requeue", next_attempt: requeued ? unit.attempt : null, cause: diagnosis?.cause ?? "code", reason_code: null };
  }
  if (!FAILABLE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} is ${unit.state}: it has no execution to fail`);

  let decision = decideFailure({ state, unit, wos: unit.wos, failure: { source }, diagnosis, evidence });
  if (override === "worker_blocked" && (decision.action === "requeue" || decision.action === "escalate")) {
    decision = { ...decision, action: "handback", attempt: null, cause: diagnosis?.cause ?? "owner", reason_code: "worker_blocked" };
  }
  const tests = decision.evidence.tests;
  await atomicWriteJson(path.join(ctx.paths.unitDir(unit.id), `attempt-${unit.attempt}.json`), {
    attempt: unit.attempt, outcome: input.outcome ?? (decision.reason_code === "worker_blocked" ? "blocked" : OUTCOME_OF_SOURCE[source] ?? "failed"),
    reason: reasons.join("; "), failing: tests, tail: failure.tail ?? "", diagnosis,
  }, { fs: deps.fs });
  releaseToken(unit.id, { file: ctx.paths.admissionFile });
  const base = { applied: true, reason: null, action: decision.action, next_attempt: null, cause: decision.cause, reason_code: decision.reason_code };

  if (decision.action === "requeue" || decision.action === "escalate") {
    const plan = planRequeue({ state, unitId: unit.id, decision });
    await ctx.writeState(plan.state);
    for (const event of [...(receivedEvent ? [receivedEvent] : []), ...plan.events]) await ctx.appendEvent(event);
    return { ...base, next_attempt: decision.attempt };
  }
  if (decision.action === "doubt" || decision.action === "dispute") {
    await ctx.writeState(patchUnit(state, unit.id, { state: "reported", token_hash: null }));
    if (receivedEvent) await ctx.appendEvent(receivedEvent);
    await ctx.appendEvent({ type: "unit_state", data: { unit: unit.id, from: unit.state, to: "reported" } });
    return base;
  }
  if (receivedEvent) await ctx.appendEvent(receivedEvent);
  const back = await handBack(ctx, {
    unitId: unit.id, cause: decision.cause, reasonCode: decision.reason_code, reason: reasons.join("; "),
    failure: { command: failure.command ?? evidence.command ?? null, tail: failure.tail ?? "" }, diagnosis,
  }, deps);
  return { ...base, handback: { path: back.path, blocked: back.blocked.map((b) => b.unit), stop_run: back.stop_run, notice_es: back.notice_es, reason_code: decision.reason_code } };
}

/**
 * Fenced: a unit's execution failed without a valid report (worker crashed, watchdog, unreadable or invalid report.json).
 * Policy is the unchanged D21 one via {@link applyUnitFailure} (source `worker_failed`): attempt 1 -> attempt 2 on the same unit,
 * attempt 2 -> attempt 3 only when the evidence changed with a diagnosis, otherwise hand-back; budget 3 -> hand-back.
 * Not a public CLI command (no dispatcher entry); `next` calls it outside its own mutex section.
 * @param {{project: string, epoch: number, unit: string, attempt: number, cause?: "env-infra"|"code", detail: string,
 *   command?: string|null, tail?: string}} input
 * @param {object} [deps] see handBack
 * @returns {Promise<{ok: true, cmd: "fail", unit: string, applied: boolean, reason: string|null, action: string,
 *   next_attempt: number|null, handback?: object}>}
 * @throws USAGE (missing unit/attempt/detail), FENCE (exit 3), INVALID_STATE, INVALID_INPUT
 */
export async function failUnit(input, deps = {}) {
  const { project, epoch, unit, attempt, cause, detail, command = null, tail = "" } = input ?? {};
  if (!unit) throw err("USAGE", "fail needs a unit");
  if (!Number.isInteger(Number(attempt)) || attempt === null || attempt === undefined || attempt === "") throw err("USAGE", "fail needs the attempt of the failed execution");
  if (!String(detail ?? "").trim()) throw err("USAGE", "fail needs a detail");
  const diagnosis = { cause: cause ?? "code", detail };
  const out = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
    const res = await applyUnitFailure(ctx, {
      unitId: unit, attempt: Number(attempt), source: "worker_failed", diagnosis,
      evidence: { tests: [], command: command ?? null, files: [] }, reasons: [detail], failure: { command, tail },
    }, deps);
    return { ok: true, cmd: "fail", unit, applied: res.applied, reason: res.reason, action: res.action, next_attempt: res.next_attempt, ...(res.handback ? { handback: res.handback } : {}) };
  });
  // A doubt/dispute decision leaves the unit `reported` with no doubt record: open it now (B2), outside the mutex section.
  if (out.applied && (out.action === "doubt" || out.action === "dispute")) {
    const opened = await openUnitDoubt({ project, epoch, unit, diagnosis, actor: deps.actor }, deps);
    return opened.opened ? { ...out, doubt_opened: opened } : { ...out, action: "handback", next_attempt: null, handback: opened.handback };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Opening the doubt of a `reported` unit (a Codex worker has no shell to run `doubt open` itself: B2)
// ---------------------------------------------------------------------------------------------

/**
 * Synthesize the doubt object (`report.schema.json#/properties/doubt`) of a worker diagnosis that the policy turned into a
 * `doubt` (spec-ambiguous) or a `dispute` (test-defective) action. Two neutral, reversible options; the worker's detail is the evidence.
 * @param {{cause: string, detail?: string}|null} diagnosis
 * @returns {{question: string, options: {id: string, text: string}[], preferred: string, why: string}|null} null when the diagnosis has no detail to build from
 */
export function doubtFromDiagnosis(diagnosis) {
  const detail = oneLine(diagnosis?.detail ?? "", 1500);
  if (!detail) return null;
  if (diagnosis.cause === "test-defective") {
    return {
      question: `El trabajador discute una prueba de la unidad: ${detail}. ¿Se corrige la prueba o se mantiene y se rehace el código?`,
      options: [{ id: "fix-test", text: "Corregir la prueba discutida y mantener el código" }, { id: "keep-test", text: "Mantener la prueba y rehacer el código" }],
      preferred: "fix-test", why: "la prueba discutida se corrige sin tocar el código ya hecho",
    };
  }
  return {
    question: `El trabajador no puede seguir porque la especificación es ambigua: ${detail}. ¿Qué lectura se toma?`,
    options: [{ id: "conservative", text: "Tomar la lectura más conservadora y reversible y seguir" }, { id: "ask-owner", text: "Parar y pedir al owner que aclare la especificación" }],
    preferred: "conservative", why: "la lectura conservadora es reversible y no bloquea al resto de la obra",
  };
}

/**
 * Turn a `reported` unit's doubt into an OPENED doubt through `doubts.openDoubt` (fenced; call it OUTSIDE any mutex section).
 * Writes the doubt object to `units/<unit>/doubt.json`, then opens it: under drive or the Codex app the sources step is skipped
 * and the first consult unit is queued; a vetoed doubt parks at once. If the doubt cannot be built or the ladder refuses it
 * (`INVALID_INPUT` / `INVALID_STATE`), the unit is HANDED BACK instead of being left `reported` for good (reason `worker_blocked`).
 * Idempotent: a unit whose doubt is already open returns it with `applied: false`.
 * @param {{project: string, epoch: number, unit: string, doubt?: object|null, diagnosis?: object|null, actor?: string}} input
 *   `doubt` is the worker's doubt object; when absent it is built from `diagnosis` ({@link doubtFromDiagnosis})
 * @param {object} [deps] as `doubts.openDoubt`, plus `doubts` (module override)
 * @returns {Promise<{opened: true, applied: boolean, doubt_id: string, step: string, consult?: object, parked?: object, notice_es?: string, warnings?: string[]}
 *   | {opened: false, handback: {path: string, blocked: string[], stop_run: boolean, notice_es: string, reason_code: string}}>}
 */
export async function openUnitDoubt(input, deps = {}) {
  const { project, epoch, unit, diagnosis = null } = input;
  const doubt = input.doubt ?? doubtFromDiagnosis(diagnosis);
  const refused = async (why) => {
    const res = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
      const back = await handBack(ctx, { unitId: unit, cause: diagnosis?.cause ?? "owner", reasonCode: "worker_blocked", reason: `la duda de ${unit} no se pudo abrir: ${why}`, diagnosis }, deps);
      return { path: back.path, blocked: back.blocked.map((b) => b.unit), stop_run: back.stop_run, notice_es: back.notice_es, reason_code: "worker_blocked" };
    });
    return { opened: false, handback: res };
  };
  if (!doubt) return refused("el trabajador no aportó una duda ni un diagnóstico con detalle");
  const fs = deps.fs ?? fsp;
  const file = buildPaths(project, deps).unitDoubtFile(unit);
  await atomicWriteJson(file, doubt, { fs });
  const doubts = deps.doubts ?? await import("./doubts.mjs");
  try {
    const res = await doubts.openDoubt({ project, epoch, unit, file }, { ...deps, actor: input.actor ?? deps.actor });
    return {
      opened: true, applied: res.applied !== false, doubt_id: res.doubt_id, step: res.step,
      ...(res.consult ? { consult: res.consult } : {}), ...(res.parked ? { parked: res.parked } : {}),
      ...(res.notice_es ? { notice_es: res.notice_es } : {}), ...(res.warnings ? { warnings: res.warnings } : {}),
    };
  } catch (error) {
    if (error.code !== "INVALID_INPUT" && error.code !== "INVALID_STATE") throw error;
    return refused(oneLine(error.message, 200));
  }
}

async function emitSafely(deps, name, data) {
  if (!deps.emit) return null;
  try { await deps.emit({ name, data }); return null; } catch (error) { return `telemetry ${name}: ${oneLine(error.message, 120)}`; }
}

// ---------------------------------------------------------------------------------------------
// Engine failure
// ---------------------------------------------------------------------------------------------

/** Error codes that are control flow or bad input, never a fault of the engine itself. */
const EXPECTED_CODES = new Set(["FENCE", "QUIESCED", "USAGE", "CONTENDED", "INVALID_INPUT", "GATE_RED", "WAITING_GATE", "FAILCLOSED", "NOT_A_PROJECT", "INVALID_STATE", "INVALID_PATH", "EVIDENCE", "ENGINE_FAILURE"]);

/**
 * Is this error a fault of the CLI (retry once after rebuild-state, then stop) rather than expected control flow?
 * An error flagged `engine:true`, a `rebuild-state` hint (corrupt chain or state), a plain/unknown error (TypeError,
 * EIO, ENOSPC...) and an unsupported schema are engine faults; a fence, bad input or a refused state are not.
 */
export function isEngineFault(error) {
  if (!error || error.code === "ENGINE_FAILURE") return false;
  if (error.engine === true || error.hint === "rebuild-state") return true;
  return !EXPECTED_CODES.has(error.code);
}

/**
 * Build an engine-fault error from inside a module (e.g. a second consecutive merge-queue exit 20): flagged so
 * `withEngineRecovery` treats it as an engine failure; `noRetry` skips the retry when the repeat IS the confirmation.
 */
export const engineFault = (message, { step = null, noRetry = false } = {}) => err("ENGINE_FAULT", message, { engine: true, step, noRetry });

const sanitize = (text, project, deps) => {
  let out = String(text ?? "");
  const home = (deps.env ?? process.env).HOME;
  if (project) out = out.split(path.resolve(project)).join("<project>");
  if (home && home.length > 1) out = out.split(home).join("~");
  return out;
};

async function readFactoryRoot(project, deps) {
  if (deps.factoryRoot) return deps.factoryRoot;
  try {
    const guide = await (deps.fs ?? fsp).readFile(path.join(project, ".pandacorp", "guide.md"), "utf8");
    return guide.match(/^[-*]?\s*Factory:\s*`([^`]+)`/m)?.[1] ?? null;
  } catch { return null; }
}

/** Next free `factory/backlog/BL-NNNN` id, by the same rule as validate-backlog.sh (max existing + 1). */
async function nextBacklogId(dir, fs) {
  const names = await fs.readdir(dir);
  return names.reduce((max, name) => Math.max(max, Number(name.match(/^BL-(\d+)/)?.[1] ?? 0)), 0) + 1;
}

function backlogBody({ id, title, date, failure, project, deps }) {
  const stack = sanitize(failure.stack, project, deps).split("\n").slice(0, 8).join("\n");
  return [
    "---",
    `id: BL-${String(id).padStart(4, "0")}`,
    "type: bug",
    "area: build-engine",
    `title: ${JSON.stringify(title)}`,
    "status: open",
    "severity: p1",
    `opened: ${date}`,
    "closed:",
    `source: ${JSON.stringify(`pandacorp-build engine failure, run ${failure.runId ?? "unknown"}`)}`,
    "closes:",
    "links: [DR-103]",
    "---",
    "",
    "## Problem",
    `The v2 build engine stopped itself at a safe point (exit 8). Command: \`${failure.cmd ?? "unknown"}\`, step: \`${failure.step ?? "unknown"}\`. It failed, was retried once after \`rebuild-state\`, and failed again (the retry ${failure.retried ? "ran" : "was skipped: the fault confirms itself"}).`,
    `Error code: \`${failure.code ?? "none"}\`. Message: ${oneLine(sanitize(failure.message, project, deps), 400)}`,
    "```",
    stack || "(no stack trace)",
    "```",
    `Run \`${failure.runId ?? "unknown"}\`, epoch ${failure.epoch ?? "unknown"}. The product work is preserved on the run's \`lane/<run_id>\` branch; the run is resumable once this is fixed. This failure consumed no unit attempt.`,
    "",
    "## Root cause",
    "Not investigated yet. Reproduce from the run journal (`.pandacorp/run/build/journal.jsonl`) and `handback/engine.md` of the affected project.",
    "",
    "## Fix plan",
    "1. Reproduce with the journal of the failed run and a fixture of the same shape.",
    "2. Fix the module in `plugin/runtime/build/` named by the stack; keep the failure policy intact (BUILD-15).",
    "3. PATCH or MINOR plugin release; the owner resumes the SAME `run_id` with `/pandacorp:implement --resume`.",
    "",
    "## Tests (prove the fix, RED then GREEN)",
    "A regression case in the matching `plugin/scripts/test-build-v2-*.mjs` suite that fails with this error before the fix and passes after, plus a resume of the interrupted run.",
    "",
    "## Done when",
    "- The regression test is green and the engine suite passes.",
    "- The plugin version is bumped and the failed run resumes to completion.",
    "",
  ].join("\n");
}

/** File the factory backlog item (DR-103). Returns `{id, file}`, or `{id: null, reason}` when the factory cannot be reached. */
async function fileBacklogNote({ project, failure, deps }) {
  const fs = deps.fs ?? fsp;
  const factory = await readFactoryRoot(project, deps);
  if (!factory) return { id: null, file: null, reason: "no se encontró la ruta de la fábrica en .pandacorp/guide.md" };
  const dir = path.join(factory, "factory", "backlog");
  const date = nowIso(deps).slice(0, 10);
  const title = `Fix v2 build engine failure in ${failure.cmd ?? "a command"}: ${oneLine(sanitize(failure.message, project, deps), 90)}`;
  const slug = `engine-failure-${String(failure.cmd ?? "step").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 50);
  try {
    let id = await nextBacklogId(dir, fs);
    for (let tries = 0; tries < 5; tries += 1, id += 1) {
      const file = path.join(dir, `BL-${String(id).padStart(4, "0")}-${slug}.md`);
      try {
        await fs.writeFile(file, backlogBody({ id, title, date, failure, project, deps }), { flag: "wx", mode: 0o644 });
        return { id: `BL-${String(id).padStart(4, "0")}`, file, reason: null };
      } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    return { id: null, file: null, reason: "no quedó un número de BL libre tras 5 intentos" };
  } catch (error) {
    return { id: null, file: null, reason: `no se pudo escribir el BL: ${oneLine(error.message, 140)}` };
  }
}

const countEngineFailures = async (file, fs) => {
  try { return ((await fs.readFile(file, "utf8")).match(/"type":"engine_failure"/g) ?? []).length; } catch { return 0; }
};

const doneWorkOrders = (state) => new Set(state?.units?.filter((u) => WO_UNIT_KINDS.includes(u.kind) && DONE_STATES.includes(u.state)).flatMap((u) => u.wos.map(woKey)) ?? []).size;

function engineNotice({ runId, bl, doneWos, failures }) {
  const work = doneWos === null ? "tu trabajo" : `tu trabajo (${doneWos} WOs hechas)`;
  const how = bl.id ? `en la fábrica di 'arregla ${bl.id}'` : `avisa en la fábrica de este fallo (${bl.reason})`;
  const lines = [`El motor nuevo se ha parado por un fallo suyo, no de tu app. ${work[0].toUpperCase()}${work.slice(1)} está a salvo en la rama \`lane/${runId ?? "<run_id>"}\`. Para seguir: ${how}; luego aquí, \`/pandacorp:implement --resume\`.`];
  if (failures >= POLICY.ENGINE_FAILURES_EXTRA_LINE) lines.push("Si lo consideras un desastre, dilo y se aplica el regreso.");
  return lines.join(" ");
}

function engineMarkdown({ now, cmd, step, failure, runId, epoch, state, bl, notice, warnings, retried }) {
  return [
    "# Fallo del motor",
    "",
    `cuándo: ${now}`,
    `comando: ${cmd ?? "desconocido"}   paso: ${step ?? "desconocido"}`,
    `run: ${runId ?? "desconocido"}   epoch: ${epoch ?? "sin lease"}`,
    `error: ${failure.code ?? "sin código"}: ${oneLine(failure.message, 500)}`,
    `reintento tras rebuild-state: ${retried ? "sí, y volvió a fallar" : "no, el fallo se confirmó solo"}`,
    `último punto seguro: ${state?.last_safe_point ? `${state.last_safe_point.kind} @ ${String(state.last_safe_point.sha).slice(0, 12)}` : "ninguno registrado"}`,
    `backlog de la fábrica: ${bl.id ?? `no abierto (${bl.reason})`}${bl.file ? ` (${bl.file})` : ""}`,
    "",
    notice,
    "",
    "El fallo no ha consumido ningún intento de ninguna unidad.",
    warnings.length ? `\nPasos del cierre que no se completaron:\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
    "",
  ].join("\n");
}

/**
 * Stop the run after a confirmed engine failure. Best effort on every step (none may hide the others): backlog item,
 * `handback/engine.md`, state `stopped` + journal `engine_failure`, lease quiesce + release (`projectStatus:false`),
 * telemetry. Never throws; failed steps are listed in `warnings` and inside `engine.md`.
 * @param {{project: string, epoch?: number|null, cmd?: string, step?: string, error: Error, retried?: boolean}} input `epoch` absent: unfenced command, nothing to stop
 * @param {object} [deps] fs, exec, env, clock, buildState, factoryRoot, emit
 * @returns {Promise<{message: string, path: string, bl: {id: string|null, file: string|null, reason: string|null}, run_id: string|null, warnings: string[], released: boolean, failures: number}>}
 */
export async function handleEngineFailure({ project, epoch = null, cmd = null, step = null, error, retried = false }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const paths = buildPaths(project, deps);
  const bs = deps.buildState ?? await import("../build-state.mjs");
  const now = nowIso(deps);
  const warnings = [];
  const note = (what, e) => warnings.push(`${what}: ${oneLine(e?.message ?? e, 200)}`);

  let lease = null;
  try { lease = await bs.currentLease(project); } catch (e) { note("lease", e); }
  let state = null;
  try { state = await readState(project, deps); } catch (e) { note("state.json", e); }
  const runId = lease?.run_id ?? state?.run_id ?? deps.runId ?? null;
  const failures = (await countEngineFailures(paths.journalFile, fs)) + 1;
  const failure = { cmd, step, code: error?.code ?? null, message: error?.message ?? String(error), stack: error?.stack ?? "", runId, epoch, retried };

  const bl = await fileBacklogNote({ project, failure, deps });
  const notice = engineNotice({ runId, bl, doneWos: state ? doneWorkOrders(state) : null, failures });

  let released = false;
  if (epoch !== null && epoch !== undefined) {
    try {
      await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
        if (state) { try { await ctx.writeState({ ...state, status: "stopped", status_reason: "engine_failure" }); } catch (e) { note("state.json", e); } }
        try { await ctx.appendEvent({ type: "engine_failure", data: { reason: "engine_failure", cmd, step, code: failure.code, message: oneLine(sanitize(failure.message, project, deps), 400), retried, bl: bl.id } }); } catch (e) { note("journal", e); }
      });
    } catch (e) { note("fence (state and journal)", e); }
    try {
      const token = await readLeaseToken(project, epoch, deps);
      if (!lease?.quiesced_at) await bs.quiesce(project, token, epoch, { projectStatus: false });
      await bs.finalizeRelease(project, token, epoch);
      released = true;
    } catch (e) { note("lease release", e); }
  }

  const emitted = await emitSafely(deps, "engine.failure", { cmd, step, code: failure.code, bl: bl.id, run_id: runId });
  if (emitted) warnings.push(emitted);
  const file = paths.engineHandbackFile;
  try {
    await atomicWriteText(file, engineMarkdown({ now, cmd, step, failure, runId, epoch, state, bl, notice, warnings, retried }), { fs });
  } catch (e) { note("handback/engine.md", e); }
  return { message: notice, path: file, bl, run_id: runId, warnings, released, failures };
}

/** The error a command raises after an engine failure: code ENGINE_FAILURE (exit 8), Spanish message, `result` attached. */
export const engineFailureError = (result) => err("ENGINE_FAILURE", result.message, { result });

async function defaultRebuild({ project, epoch }, deps) {
  if (epoch === null || epoch === undefined) return;
  const rebuilt = await rebuildState({ project, deps });
  await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, (_result, _intent, ctx) => ctx.writeState(rebuilt.state));
}

/**
 * Run one command step under the engine-failure policy: a fault of the engine retries the step ONCE after `rebuild-state`;
 * if it repeats (or the rebuild itself fails) the run stops at the last safe point (`handleEngineFailure`) and ENGINE_FAILURE
 * (exit 8) is thrown. Expected errors (fence, bad input, refused state) pass through untouched and are never retried.
 * @param {{project: string, epoch?: number|null, cmd?: string, step: () => Promise<any>}} input `step` must be safe to run twice
 * @param {object} [deps] `rebuild({project, epoch})` replaces the default fenced rebuild; plus handleEngineFailure's deps
 * @returns {Promise<any>} the step's value
 * @throws ENGINE_FAILURE (exit 8) with `.result`; or the step's own expected error
 */
export async function withEngineRecovery({ project, epoch = null, cmd = null, step }, deps = {}) {
  let first;
  try { return await step(); } catch (error) { if (!isEngineFault(error)) throw error; first = error; }
  if (first.noRetry) throw engineFailureError(await handleEngineFailure({ project, epoch, cmd, step: first.step ?? cmd, error: first, retried: false }, deps));
  try {
    await (deps.rebuild ?? defaultRebuild)({ project, epoch }, deps);
    return await step();
  } catch (second) {
    if (!isEngineFault(second)) throw second;
    throw engineFailureError(await handleEngineFailure({ project, epoch, cmd, step: second.step ?? first.step ?? cmd, error: second, retried: true }, deps));
  }
}
