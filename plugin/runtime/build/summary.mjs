/**
 * Pandacorp build engine v2: owner-facing data of a run (BUILD-12, PLAN 3.2 `start --preflight` announce, `summary`,
 * `status`, `finish`; schema `schemas/summary.schema.json`).
 *
 * Two outputs, both pure functions over data the caller already loaded:
 *   - `buildAnnounce`: the "Arrancó" block data of the first-minute message (consumed by `preflight.mjs`).
 *   - `buildSummary`: the terminal report data (`need_from_owner`, `decided_without_owner`, `parked`, `reviews`,
 *     `deferred_pending`, `open_questions[]`), plus the extras the final report prints (`status_reason`, `done`,
 *     `quota`, `units_by_state`). `readSummary` loads the files and validates the result against the schema.
 *
 * Every string the owner reads is Spanish and carries no em or en dash. Nothing here writes a file or calls an LLM.
 */
import * as fsp from "node:fs/promises";
import path from "node:path";
import { assertValid, loadSchema, readJson } from "./fsx.mjs";
import { readJournal } from "./journal.mjs";
import { buildPaths } from "./paths.mjs";
import { loadThresholds } from "./quota.mjs";

/** Section headings of the final report, exactly as the owner sees them (autonomy.md section 6). */
export const REPORT_HEADINGS_ES = Object.freeze({
  need: "Necesito de ti",
  decided: "Decidí sin ti",
  parked: "Aparcado",
  done: "Hecho",
  reviews: "Revisiones",
  quota: "Cupo",
});

/** Plain-Spanish name of each human gate kind. */
export const GATE_LABELS_ES = Object.freeze({
  production: "aterrizar en producción",
  money: "un gasto de dinero",
  delete: "un borrado de datos",
  external: "una comunicación externa",
});

const MODEL_NAMES = Object.freeze({
  haiku: "Haiku", sonnet: "Sonnet", opus: "Opus", fable: "Fable", luna: "Luna", terra: "Terra", sol: "Sol", astra: "Astra",
});
const RUNTIME_NAMES = Object.freeze({ claude: "Claude", codex: "Codex" });
const SCOPE_LINE_MAX = 110;
const SCOPE_PREVIEW_ITEMS = 3;
const NO_DOUBT_RE = /^(?:ninguna?s?|none|n\/a|no hay|sin dudas?)[.\s]*$/i;

const asArray = (value) => (Array.isArray(value) ? value : []);
const clip = (text, max = SCOPE_LINE_MAX) => {
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 3).trimEnd()}...` : one;
};
const sentence = (text) => {
  const t = String(text ?? "").trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};
const unique = (list) => [...new Set(list)];

/**
 * One routed cell in plain words, e.g. `Codex Sol (high)`, `Claude Opus` when the effort is null.
 * @param {{runtime?: string, model?: string, effort?: string|null}|null|undefined} cell
 * @returns {string} `por decidir` when the cell is absent
 */
export function describeCell(cell) {
  if (!cell || !cell.model) return "por decidir";
  const runtime = RUNTIME_NAMES[cell.runtime] ?? cell.runtime ?? "";
  const model = MODEL_NAMES[cell.model] ?? cell.model;
  return `${runtime} ${model}${cell.effort ? ` (${cell.effort})` : ""}`.trim();
}

/**
 * The `announce` object of `start --preflight` (data only; the session renders it, autonomy.md 1.3).
 * @param {{scope?: {card?: string|null, frds?: string[], wos?: string[]}, card?: object|null, size?: string,
 *   zone?: "none"|"floor"|"r1", builders?: string, reviewers?: string, gates?: string[], launched?: boolean,
 *   driveArmable?: boolean, driveBlockReason?: string|null, quota?: {claude?: object, codex?: object},
 *   quotaStop?: number, deferredPending?: number}} input
 * @returns {{scope_lines_es: string[], size: string, builders: string, reviewers: string, risk_zone_provisional: string,
 *   gates_foreseen_es: string[], launched_project_line_es: string|null, drive_line_es: string|null,
 *   quota: {claude: object, codex: object}, deferred_pending: number}}
 */
export function buildAnnounce(input = {}) {
  const scope = input.scope ?? { card: null, frds: [], wos: [] };
  const frds = asArray(scope.frds);
  const wos = asArray(scope.wos);
  const card = input.card ?? null;
  const lines = [];
  lines.push(card ? `Tarjeta: ${clip(card.title)} (${card.slug})` : "Plan pendiente del proyecto, sin tarjeta nueva");
  lines.push(frds.length ? `Los FRDs del alcance son: ${frds.join(", ")}` : "Los FRDs los define el primer paso de documentos");
  lines.push(wos.length ? `Hay ${wos.length} tareas pendientes en el alcance` : "Las tareas las crea el primer paso de documentos");
  const dentro = asArray(card?.dentro);
  if (dentro.length) {
    const preview = dentro.slice(0, SCOPE_PREVIEW_ITEMS).map((i) => clip(i.text, 70)).join("; ");
    lines.push(`Dentro (${dentro.length}): ${preview}${dentro.length > SCOPE_PREVIEW_ITEMS ? "; ..." : ""}`);
  }
  const fuera = asArray(card?.fuera);
  if (fuera.length) lines.push(`Fuera (${fuera.length}): ${clip(fuera[0].text, 70)}${fuera.length > 1 ? "; ..." : ""}`);
  while (lines.length < 4) lines.push("Alcance cerrado: no construyo nada fuera de esta lista.");

  const codex = input.quota?.codex ?? { pct: null, state: "unknown" };
  const claude = input.quota?.claude ?? { pct: null, state: "unknown" };
  const stop = Number.isFinite(input.quotaStop) ? input.quotaStop : loadThresholds().quota_stop;
  const codexHigh = codex.state === "known" && Number.isFinite(codex.pct) && codex.pct >= stop;
  let driveLine = null;
  if (codexHigh) {
    driveLine = input.driveArmable === false
      ? `Relevo a Codex: no armado: ${input.driveBlockReason ?? "no se pudo verificar"}.`
      : `Relevo a Codex: armado (Codex al ${Math.round(codex.pct)} %, solo actuará si se renueva antes).`;
  }
  return {
    scope_lines_es: lines.slice(0, 6),
    size: input.size ?? "feature",
    builders: input.builders ?? "por decidir",
    reviewers: input.reviewers ?? "por decidir",
    risk_zone_provisional: input.zone ?? "none",
    gates_foreseen_es: asArray(input.gates),
    launched_project_line_es: input.launched ? "En proyecto lanzado no toco `main`: el código, los documentos y el estado esperan tu orden." : null,
    drive_line_es: driveLine,
    quota: { claude, codex },
    deferred_pending: Number.isInteger(input.deferredPending) ? input.deferredPending : 0,
  };
}

// ------------------------------------------------------------------------------------------------ open questions

/** Questions of the preflight that belong to the run: from `preflight.questions[]` or from the `ask` checks. */
function preflightQuestions(preflight) {
  if (!preflight || typeof preflight !== "object") return [];
  if (Array.isArray(preflight.questions)) return preflight.questions;
  return asArray(preflight.checks).filter((c) => c?.status === "ask" && c.question).map((c) => c.question);
}

const lastAnswer = (doubt) => asArray(doubt?.consults).map((c) => c.answer).filter(Boolean).at(-1) ?? null;
const optionText = (doubt, id) => asArray(doubt?.options).find((o) => o.id === id)?.text ?? null;

/** WOs of the units a question holds back: the units naming it as `pending_answer` or `doubt_id`, and their dependents. */
function affectedWos(state, questionId, extraUnits = []) {
  const units = asArray(state.units);
  const held = new Set([...units.filter((u) => u.pending_answer === questionId || u.doubt_id === questionId).map((u) => u.id), ...extraUnits]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (!held.has(u.id) && asArray(u.depends_on).some((d) => held.has(d))) { held.add(u.id); grew = true; }
    }
  }
  return unique(units.filter((u) => held.has(u.id)).flatMap((u) => asArray(u.wos)));
}

const affectsOf = (wos) => (wos.length > 0 ? { wos } : { all: true });

function parkedQuestion(unit, doubt, state) {
  const id = unit.pending_answer ?? unit.doubt_id;
  const assumption = unit.parked === "built_on_assumption" ? doubt?.assumption ?? null : null;
  const options = asArray(doubt?.options).map((o) => `${o.id}: ${clip(o.text, 80)}`).join("; ");
  const base = doubt?.question ? clip(doubt.question, 200) : `La pieza ${unit.id} quedó aparcada`;
  const text = `${sentence(base)}${options ? ` Opciones: ${options}.` : ""}`;
  const dflt = assumption
    ? `queda construido sobre "${assumption.option}" en la rama ${assumption.branch}, sin aterrizar`
    : "la pieza y sus dependientes siguen aparcadas, lo independiente sigue";
  return {
    id,
    kind: "parked",
    text_es: text,
    default_es: dflt,
    affects: affectsOf(affectedWos(state, id)),
    reversible: assumption ? true : lastAnswer(doubt)?.reversible === true,
  };
}

function gateQuestion(unit, degradedPending) {
  const what = GATE_LABELS_ES[unit.waiting_gate] ?? "una compuerta humana";
  const production = unit.waiting_gate === "production";
  const text = production
    ? `¿Aterrizo? La pieza ${unit.id} espera tu orden para ${what}.${degradedPending > 0 ? ` Hay ${degradedPending} revisión(es) degradada(s) sin re-revisar.` : ""} Solo con tu orden en el chat.`
    : `Esperando tu OK para ${what} en ${unit.id}.`;
  return {
    id: `g-${unit.id}`,
    kind: "gate",
    text_es: text,
    default_es: "la pieza sigue esperando en su compuerta y lo demás sigue",
    affects: affectsOf(unique(asArray(unit.wos))),
    reversible: false,
  };
}

/**
 * Every question still open for the owner: unanswered first-minute asks, parked doubts and human gates.
 * @returns {object[]} `summary.schema.json` `open_questions[]` items, in that order, ids unique
 */
function collectOpenQuestions({ state, preflight, doubts, degradedPending }) {
  const answers = state.answers && typeof state.answers === "object" ? state.answers : {};
  const open = [];
  for (const q of preflightQuestions(preflight)) {
    if (!q?.id || Object.hasOwn(answers, q.id)) continue;
    open.push({ id: q.id, kind: "ask", text_es: q.text_es, default_es: q.default_es ?? null, affects: q.affects ?? { all: true }, reversible: q.reversible === true });
  }
  const byId = new Map(asArray(doubts).map((d) => [d.id, d]));
  const seen = new Set();
  for (const unit of asArray(state.units)) {
    if (unit.state !== "parked" || (unit.parked !== "owner_question" && unit.parked !== "built_on_assumption")) continue;
    const id = unit.pending_answer ?? unit.doubt_id;
    if (!id || seen.has(id) || Object.hasOwn(answers, id)) continue;
    seen.add(id);
    open.push(parkedQuestion(unit, byId.get(id), state));
  }
  for (const unit of asArray(state.units)) {
    if (unit.state === "waiting_gate") open.push(gateQuestion(unit, degradedPending));
  }
  return open;
}

// ------------------------------------------------------------------------------------------- decisions, parked, reviews

const ITEM_KEYS = ["doubt_id", "question", "chosen", "advised_by", "confidence", "revert_hint"];

function decidedWithoutOwner(doubts, runId, events) {
  const out = [];
  for (const d of asArray(doubts)) {
    if (d.step !== "decided" || !d.decision || d.decision.decided_by === "owner") continue;
    const agreeing = asArray(d.consults).filter((c) => c.answer && c.answer.decision === d.decision.value);
    const advised = d.decision.decided_by === "sources"
      ? ["las fuentes del proyecto"]
      : agreeing.map((c) => describeCell(c));
    const order = { low: 0, medium: 1, high: 2 };
    const confidence = d.decision.decided_by === "sources"
      ? "high"
      : agreeing.map((c) => c.answer.confidence).sort((a, b) => order[a] - order[b])[0] ?? "low";
    out.push({
      doubt_id: d.id,
      question: clip(d.question, 300),
      chosen: clip(optionText(d, d.decision.value) ?? d.decision.value, 300),
      advised_by: advised.length ? advised : ["el motor"],
      confidence,
      revert_hint: `Pide una tarjeta nueva que revierta la decisión ${d.id} (entrada "Decidido sin el owner" en docs/decision-log.md de la rama ${buildPaths(path.sep).integrationBranch(runId)}).`,
    });
  }
  const seen = new Set(out.map((d) => d.doubt_id));
  for (const ev of asArray(events)) {
    const data = ev?.type === "autonomous_decision" ? ev.data : null;
    if (!data || seen.has(data.doubt_id) || !ITEM_KEYS.every((k) => data[k] !== undefined)) continue;
    seen.add(data.doubt_id);
    out.push(Object.fromEntries(ITEM_KEYS.map((k) => [k, data[k]])));
  }
  return out;
}

function parkedItems(state, doubts, events) {
  const byId = new Map(asArray(doubts).map((d) => [d.id, d]));
  const handbackReason = new Map();
  const parkedText = new Map();
  for (const ev of asArray(events)) {
    if (ev.type === "handback" && ev.data?.unit) handbackReason.set(ev.data.unit, ev.data.reason ?? null);
    // The `parked` event carries the question id (park.mjs); free text is accepted too when no doubt record exists.
    if (ev.type === "parked" && ev.data?.unit && /\s/.test(String(ev.data.question ?? ""))) parkedText.set(ev.data.unit, ev.data.question);
  }
  const out = [];
  for (const unit of asArray(state.units)) {
    if (unit.state === "parked" && unit.parked) {
      const doubt = byId.get(unit.pending_answer ?? unit.doubt_id);
      const branch = unit.parked === "built_on_assumption" ? doubt?.assumption?.branch ?? unit.branch ?? null : unit.branch ?? null;
      out.push({ unit: unit.id, reason: unit.parked, question: doubt?.question ? clip(doubt.question, 300) : parkedText.has(unit.id) ? clip(parkedText.get(unit.id), 300) : null, branch });
    } else if (unit.state === "blocked") {
      const reason = handbackReason.get(unit.id);
      out.push({ unit: unit.id, reason: "handback", question: reason ? clip(reason, 300) : null, branch: unit.branch ?? null });
    }
  }
  return out;
}

/** Cross-company reviews and the degraded ones not yet re-reviewed, from the latest `review_recorded` per unit. */
function reviewTotals(events, deferred) {
  const latest = new Map();
  for (const ev of asArray(events)) if (ev.type === "review_recorded" && ev.data?.unit) latest.set(ev.data.unit, ev.data);
  const done = asArray(deferred).filter((e) => e.status === "done");
  const reReviewed = new Set([...done.map((e) => e.unit), ...done.map((e) => e.frd).filter(Boolean)]);
  let cross = 0;
  const degraded = [];
  for (const [unit, data] of latest) {
    if (data.cross === true) cross += 1;
    if (data.degraded && !reReviewed.has(unit) && !reReviewed.has(data.frd)) degraded.push(String(data.degraded));
  }
  return { cross, degraded };
}

const WO_DONE_KINDS = new Set(["build", "patch"]);
function doneItems(state) {
  const units = asArray(state.units).filter((u) => WO_DONE_KINDS.has(u.kind));
  const wosOf = (pick) => unique(units.filter(pick).flatMap((u) => asArray(u.wos)));
  return {
    landed_wos: wosOf((u) => u.state === "landed"),
    waiting_on_branch_wos: wosOf((u) => u.state !== "landed" && u.state !== "blocked" && u.state !== "queued"),
    branch: state.integration?.branch ?? null,
  };
}

const unitsByState = (state) => {
  const counts = {};
  for (const u of asArray(state.units)) counts[u.state] = (counts[u.state] ?? 0) + 1;
  return counts;
};

/**
 * The summary object (`schemas/summary.schema.json`) of a run, computed from loaded data only.
 * @param {{state: object, events?: object[], doubts?: object[], preflight?: object|null, deferred?: object[],
 *   quota?: {claude?: object|null, codex?: object|null}|null}} input `state` is `build/state.json`, `events` the verified
 *   journal, `doubts` the `build/doubts/<id>.json` records, `preflight` the run's preflight result (`questions[]` or
 *   `checks[]`), `deferred` the deferred-reviews ledger, `quota` the stored readings.
 *   Given `{project}` instead of `state`, it loads the run's files through `readSummary` and returns a Promise of the validated object.
 * @param {object} [deps] forwarded to `readSummary` (`fs`, `env`, `homedir`) in the `{project}` form
 * @returns {object|Promise<object>} `{run_id, status, need_from_owner[], decided_without_owner[], parked[], reviews, deferred_pending,
 *   open_questions[], status_reason, done, quota, units_by_state}`; `need_from_owner[]` are the numbered lines of "Necesito de ti"
 */
export function buildSummary(input, deps = {}) {
  if (input && !input.state && typeof input.project === "string") return readSummary(input.project, deps);
  const state = input?.state;
  if (!state || typeof state !== "object") throw Object.assign(new Error("buildSummary needs the run state"), { code: "INVALID_STATE" });
  const reviews = reviewTotals(input.events, input.deferred);
  const deferredPending = asArray(input.deferred).filter((e) => e.status === "pending").length;
  const open = collectOpenQuestions({ state, preflight: input.preflight, doubts: input.doubts, degradedPending: reviews.degraded.length });
  return {
    run_id: state.run_id,
    status: state.status,
    need_from_owner: open.map((q) => `${sentence(q.text_es)} Si no respondes: ${q.default_es ?? "nada cambia"}.`),
    decided_without_owner: decidedWithoutOwner(input.doubts, state.run_id, input.events),
    parked: parkedItems(state, input.doubts, input.events),
    reviews,
    deferred_pending: deferredPending,
    open_questions: open,
    status_reason: state.status_reason ?? null,
    done: doneItems(state),
    quota: { claude: input.quota?.claude ?? null, codex: input.quota?.codex ?? null },
    units_by_state: unitsByState(state),
    admission: input.admission ?? null,
  };
}

const readDoubts = async (dir, fs) => {
  let names;
  try { names = await fs.readdir(dir); } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const doubts = [];
  for (const name of names.filter((n) => n.endsWith(".json") && !n.endsWith(".sources.json")).sort()) {
    const doubt = await readJson(path.join(dir, name), { fs });
    if (doubt) doubts.push(doubt);
  }
  return doubts;
};

/**
 * Load a run's files and return its validated summary (what `summary`, `status` and `finish` print).
 * @param {string} project absolute project root
 * @param {{fs?: object, env?: object, homedir?: string}} [deps] test hooks
 * @returns {Promise<object>} the `buildSummary` result, already checked against `summary.schema.json`
 * @throws INVALID_STATE when there is no run (`build/state.json` missing) or the result breaks the schema; JOURNAL_CHAIN on a broken journal
 */
export async function readSummary(project, deps = {}) {
  const fs = deps.fs ?? fsp;
  const p = buildPaths(project, deps);
  const state = await readJson(p.stateFile, { fs });
  if (!state) throw Object.assign(new Error("no build run: build/state.json does not exist"), { code: "INVALID_STATE" });
  const { events } = await readJournal(p.journalFile, { fs });
  const started = events.find((e) => e.type === "run_started");
  const preflight = started?.data?.preflight ?? (await readJson(p.preflightFile, { fs }));
  const quota = await readJson(p.quotaFile, { fs });
  const admission = await readJson(p.admissionFile, { fs });
  const summary = buildSummary({
    state,
    admission: admission?.ladder ? { step: admission.ladder.step, motivo: admission.disk_waiting ? "disco" : admission.ladder.motivo } : null,
    events,
    doubts: await readDoubts(p.doubtsDir, fs),
    preflight,
    deferred: (await readJson(p.deferredReviewsFile, { fs })) ?? [],
    quota: quota ? { claude: quota.claude ?? null, codex: quota.codex ?? null } : null,
  });
  assertValid(await loadSchema("summary", { fs }), summary, { label: "summary", code: "INVALID_STATE" });
  return summary;
}

/**
 * The final report as Spanish Markdown (the file `finish` writes at `report_path`), headings of `REPORT_HEADINGS_ES`.
 * Every heading is present even when empty ("ninguna").
 * @param {object} summary a `buildSummary` result
 * @returns {string}
 */
export function renderReportEs(summary) {
  const H = REPORT_HEADINGS_ES;
  const list = (items) => (items.length ? items.map((t, i) => `${i + 1}. ${t}`) : ["ninguna"]);
  const bullets = (items) => (items.length ? items.map((t) => `- ${t}`) : ["- ninguna"]);
  const decided = asArray(summary.decided_without_owner).map((d) => `${d.question} Elegí: ${d.chosen}. Aconsejó: ${d.advised_by.join(", ")} (confianza ${d.confidence}). ${d.revert_hint}`);
  const parked = asArray(summary.parked).map((p) => `${p.unit} (${p.reason})${p.question ? `: ${p.question}` : ""}${p.branch ? `. Rama: ${p.branch}` : ""}`);
  const done = summary.done ?? { landed_wos: [], waiting_on_branch_wos: [], branch: null };
  const doneLines = [
    `Aterrizadas en main: ${done.landed_wos.length ? done.landed_wos.join(", ") : "ninguna"}`,
    `Esperando tu orden en ${done.branch ?? "la rama del run"}: ${done.waiting_on_branch_wos.length ? done.waiting_on_branch_wos.join(", ") : "ninguna"}`,
  ];
  const reviews = summary.reviews ?? { cross: 0, degraded: [] };
  const reviewLines = [
    `${reviews.cross} cruzadas, ${reviews.degraded.length} degradadas${reviews.degraded.length ? ` (${reviews.degraded.join("; ")})` : ""}, ${summary.deferred_pending} diferidas pendientes`,
  ];
  const q = summary.quota ?? {};
  const quotaLine = (name, r) => `${name}: ${r ? "lectura guardada" : "desconocido"}`;
  return [
    `# Informe del build ${summary.run_id}`, "",
    `Estado: ${summary.status}${summary.status_reason ? ` (${summary.status_reason})` : ""}`, "",
    ...(summary.admission ? [`Concurrencia: paso ${summary.admission.step}. Motivo: ${summary.admission.motivo}.`, ""] : []),
    `## ${H.need}`, ...list(asArray(summary.need_from_owner)), "",
    `## ${H.decided} (${asArray(summary.decided_without_owner).length})`, ...bullets(decided), "",
    `## ${H.parked}`, ...bullets(parked), "",
    `## ${H.done}`, ...bullets(doneLines), "",
    `## ${H.reviews}`, ...bullets(reviewLines), "",
    `## ${H.quota}`, `- ${quotaLine("Claude", q.claude)}`, `- ${quotaLine("Codex", q.codex)}`, "",
  ].join("\n");
}
