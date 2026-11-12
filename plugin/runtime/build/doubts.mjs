// The doubt ladder of the v2 build engine (BUILD-12, D20, PLAN 3.16 A7): sources -> consult 1 (the other company) ->
// consult 2 (tie-break) -> decided | parked. The CLI never asks the owner and never lets a model judge
// irreversibility: the veto is deterministic (risk.mjs on the unit's files, classify-change.mjs on the doubt text,
// fixed scope/gate patterns, DRs with `requiere_humano`). A consult is dispatched ONLY as a `doubt-consult` unit that
// `next` serves; the `consult` object returned here only announces it. Every autonomous decision is recorded on the
// integration branch ("Decidido sin el owner", with how to revert) and in the owner's inbox.
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseToken, verifyToken } from "./admission.mjs";
import { atomicWriteJson, atomicWriteText, defaultExec, loadSchema, nowIso, readJson, validate, writeTarget } from "./fsx.mjs";
import { assumeUnits, createAssumeBranch, parkOrAssume, parkUnits } from "./park.mjs";
import { buildPaths } from "./paths.mjs";
import { computeRisk } from "./risk.mjs";
import { consultCell, modelSlug } from "./routing.mjs";
import { fencedTwoPhase, findUnit, isTerminalUnit, newUnit } from "./state.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Caps (BUILD-12 constants). */
export const DOUBT_CAPS = Object.freeze({ CONSULTS_PER_DOUBT: 3, CONSULTED_DOUBTS_PER_BUILD: 8 });

/** Confidence levels that may decide (BUILD-12: "confidence >= medium"). */
export const DECIDING_CONFIDENCE = Object.freeze(["high", "medium"]);

/** Deterministic reasons a doubt is never decided without the owner (BUILD-12 "Never decided this way"). */
export const VETO_REASONS = Object.freeze(["irreversible", "scope", "money", "human_gate", "requires_owner_dr", "floor_signal", "failclosed"]);

/** Ladder steps a doubt can be answered in. */
const OPEN_STEPS = Object.freeze(["sources", "consult1", "consult2"]);

/** Unit states a doubt can be opened from (a report or review with `status: doubt`, A13). */
const OPENABLE_STATES = Object.freeze(["running", "reported"]);

const DOUBT_ID_RE = /^d-(\d{4,})$/;
const CITATION_RE = /\S+:\d+/;
const CLASSIFY_TIMEOUT_MS = 60_000;

// Text patterns of the never-decide list that no classifier signal covers. Matching is deliberately wide: a false
// positive parks a doubt (the owner answers it), a false negative would decide something only the owner may decide.
const SCOPE_RE_I = /\b(out of scope|in scope|scope|widen\w*|narrow the scope|reduce the scope|reinterpret\w*|product scope|prd|epics?|alcance|ampliar el alcance|reducir el alcance|reinterpretar|[ée]picas?)\b/i;
const SCOPE_RE_CASED = /\b(Dentro|Fuera)\b/;
const GATE_RE = /\b(deploy\w*|despleg\w*|production|producci[oó]n|release to|publish\w*|publicar|send (an? )?e-?mails?|e-?mails? (to )?(the )?(users|customers|clients)|newsletter|enviar (un |el )?correo|correos? a (los )?(usuarios|clientes)|sms|push notifications?|notificaci[oó]n push|PANDACORP_OWNER_RELEASE_OK)\b/i;
const MONEY_RE = /\b(payments?|billing|pricing|prices?|invoices?|subscriptions?|refunds?|spend\w*|money|pago|pagos|cobr(ar|o|os)|precios?|dinero|factur\w*|suscripci[oó]n\w*|tarifas?|gastar|reembolso\w*)\b|[€$£]\s?\d/i;
const DR_RE = /\bDR-\d{3,}\b/g;

/** Classifier signals that make the doubt itself irreversible (risk.mjs IRREVERSIBLE_SIGNALS). */
const TEXT_SIGNAL_REASON = Object.freeze({ S5: "irreversible", S8: "irreversible", S6: "money", S7: "human_gate" });

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

/** Owner strings carry no em or en dash (CONV-11): a worker's text is normalised before it reaches the inbox. */
const es = (text) => String(text ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const oneLine = (text, max = 200) => {
  const v = String(text ?? "").replace(/\s+/g, " ").trim();
  return v.length > max ? `${v.slice(0, max - 3)}...` : v;
};
const cellText = (c) => `${c.runtime} ${c.model} ${c.effort}`;
const optionText = (record, id) => record.options.find((o) => o.id === id)?.text ?? id;
const resolveFile = (file) => (path.isAbsolute(file) ? file : path.resolve(process.cwd(), file));

async function emitSafely(deps, name, data) {
  if (!deps.emit) return null;
  try { await deps.emit({ name, data }); return null; } catch (error) { return `telemetry ${name}: ${oneLine(error.message, 120)}`; }
}

async function notifySafely(deps, note) {
  if (!deps.notify) return;
  try { await deps.notify(note); } catch { /* a notification never fails a build command */ }
}

async function readInputFile(file, deps) {
  if (typeof file !== "string" || !file) throw err("USAGE", "--file is required");
  try {
    const value = await readJson(resolveFile(file), { required: true, fs: deps.fs ?? fsp });
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not a JSON object");
    return value;
  } catch (error) {
    throw err("INVALID_INPUT", `cannot read ${file}: ${oneLine(error.message, 160)}`);
  }
}

/**
 * Who the consults come from (CLI doc table 2.4): a drive coordinator or the Codex app always consult as such; a Claude
 * session consults from the doubted unit's author company (its dispatch cell).
 * @param {{coordinator: string}} state
 * @param {object|null} unit the doubted unit
 * @returns {"claude"|"codex"|"drive"|"codex_app"}
 */
export function consultOrigin(state, unit) {
  if (state.coordinator === "drive") return "drive";
  if (state.coordinator === "codex-session") return "codex_app";
  return unit?.worker?.runtime === "codex" ? "codex" : "claude";
}

/** Under drive or the Codex app (R-B) the sources step is skipped (D20). */
export const sourcesSkipped = (state) => state.coordinator === "drive" || state.coordinator === "codex-session";

/**
 * Validate a worker's or reviewer's doubt object (`report.schema.json#/properties/doubt`, non-null) and its semantics.
 * @param {unknown} doubt
 * @returns {Promise<{question: string, options: {id: string, text: string}[], preferred: string, why: string}>}
 * @throws INVALID_INPUT
 */
export async function validateDoubtObject(doubt, deps = {}) {
  const schema = (await loadSchema("report", { fs: deps.fs ?? fsp })).properties.doubt;
  const check = validate(schema, doubt);
  if (!check.ok || doubt === null) throw err("INVALID_INPUT", `doubt object invalid: ${doubt === null ? "null" : check.errors.map((e) => `${e.path || "/"} ${e.message}`).join("; ")}`);
  if (!doubt.question.trim()) throw err("INVALID_INPUT", "doubt.question is empty");
  if (!doubt.options.length) throw err("INVALID_INPUT", "doubt.options is empty");
  const ids = doubt.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id.trim())) throw err("INVALID_INPUT", "doubt.options ids must be unique and non-empty");
  if (!ids.includes(doubt.preferred)) throw err("INVALID_INPUT", `doubt.preferred ${JSON.stringify(doubt.preferred)} is not an option id`);
  return doubt;
}

// ---------------------------------------------------------------------------------------------------------------
// Doubt records (build/doubts/<id>.json, doubt.schema.json)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Read one doubt record.
 * @param {string} project @param {string} id doubt id
 * @param {object} [deps] fs, env, homedir
 * @returns {Promise<object|null>} null when it does not exist
 * @throws INVALID_STATE when the record does not match its schema
 */
export async function readDoubt(project, id, deps = {}) {
  const record = await readJson(buildPaths(project, deps).doubtFile(id), { fs: deps.fs ?? fsp });
  if (record === null) return null;
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `doubt record ${id} is invalid: ${check.errors[0].path} ${check.errors[0].message}`, { hint: "rebuild-state" });
  return record;
}

async function writeDoubt(project, record, deps) {
  const check = validate(await loadSchema("doubt", { fs: deps.fs ?? fsp }), record);
  if (!check.ok) throw err("INVALID_STATE", `refusing to write an invalid doubt record ${record.id}: ${check.errors[0].path} ${check.errors[0].message}`);
  await atomicWriteJson(buildPaths(project, deps).doubtFile(record.id), record, { fs: deps.fs ?? fsp });
}

async function nextDoubtId(project, deps) {
  let names = [];
  try { names = await (deps.fs ?? fsp).readdir(buildPaths(project, deps).doubtsDir); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const max = names.reduce((m, n) => {
    const hit = n.match(/^d-(\d{4,})\.json$/);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return `d-${String(max + 1).padStart(4, "0")}`;
}

/**
 * The option a unit's brief must carry for its doubt: the decision, or the assumed option of a built-on-assumption park.
 * Used by `units.mjs` when it regenerates the brief of a unit with `doubt_id`.
 * @param {object|null} record doubt record
 * @returns {{value: string, text: string, source: "decided"|"assumption", decided_by: string|null, why: string}|null}
 */
export function briefDecision(record) {
  if (!record) return null;
  if (record.step === "decided" && record.decision) {
    return { value: record.decision.value, text: optionText(record, record.decision.value), source: "decided", decided_by: record.decision.decided_by, why: record.decision.why };
  }
  if (record.assumption) {
    return { value: record.assumption.option, text: optionText(record, record.assumption.option), source: "assumption", decided_by: null, why: `built on assumption on ${record.assumption.branch}; never landed until the owner answers` };
  }
  return null;
}

/**
 * The consult a `doubt-consult` unit carries (for `next`): cell, `via`, brief and report paths, Codex slug for `via:"cli"`.
 * @param {string} project
 * @param {{id: string, kind: string, doubt_id: string|null}} unit a state unit of kind `doubt-consult`
 * @param {object} [deps] fs, env, homedir, tiers
 * @returns {Promise<{doubt_id: string, unit: string, runtime: string, model: string, effort: string, via: "agent"|"cli", model_slug: string|null, brief_path: string, report_path: string, schema_path: string, answered: boolean}>}
 * @throws INVALID_STATE when the unit is not a known consult
 */
export async function pendingConsult(project, unit, deps = {}) {
  if (unit?.kind !== "doubt-consult" || !unit.doubt_id) throw err("INVALID_STATE", `unit ${unit?.id} is not a doubt consult`);
  const record = await readDoubt(project, unit.doubt_id, deps);
  const consult = record?.consults.find((c) => c.unit === unit.id);
  if (!consult) throw err("INVALID_STATE", `doubt ${unit.doubt_id} has no consult ${unit.id}`);
  const paths = buildPaths(project, deps);
  return {
    doubt_id: record.id, unit: unit.id, runtime: consult.runtime, model: consult.model, effort: consult.effort, via: consult.via,
    model_slug: consult.via === "cli" ? modelSlug(consult, deps.tiers ? { tiers: deps.tiers } : undefined) : null,
    brief_path: consult.brief_path, report_path: paths.unitAnswerFile(unit.id), schema_path: paths.schemaFile("doubt-answer"), answered: consult.answer !== null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Deterministic veto
// ---------------------------------------------------------------------------------------------------------------

/**
 * DR ids whose registry entry has `requiere_humano: true`.
 * @param {string} yaml text of `factory/decisions/registry.yaml`
 * @returns {Set<string>}
 */
export function drsRequiringOwner(yaml) {
  const out = new Set();
  let current = null;
  for (const line of String(yaml).split("\n")) {
    const id = line.match(/^\s*-\s+id:\s*["']?(DR-\d+)/);
    if (id) { current = id[1]; continue; }
    if (current && /^\s+requiere_humano:\s*true\b/.test(line)) out.add(current);
  }
  return out;
}

async function registryText(project, deps) {
  const fs = deps.fs ?? fsp;
  const candidates = [];
  if (deps.registryFile) candidates.push(deps.registryFile);
  try {
    const guide = await fs.readFile(path.join(project, ".pandacorp", "guide.md"), "utf8");
    const factory = guide.match(/Factory:\s*`([^`]+)`/);
    if (factory) candidates.push(path.join(factory[1], "factory", "decisions", "registry.yaml"));
  } catch { /* no guide: fall back to the plugin's own factory */ }
  candidates.push(path.resolve(HERE, "../../../factory/decisions/registry.yaml"));
  for (const file of candidates) {
    try { return await fs.readFile(file, "utf8"); } catch { /* try the next location */ }
  }
  return null;
}

/**
 * The `artifacts` of the given WOs, read from the frontmatter of `docs/frds/<frd>/work-orders/*.md` under `root`.
 * @param {string} root worktree root (the integration worktree)
 * @param {string[]} wos WO ids
 * @returns {Promise<{artifacts: string[], missing: string[]}>}
 */
export async function readWoArtifacts(root, wos, deps = {}) {
  const fs = deps.fs ?? fsp;
  const wanted = new Map(wos.map((w) => [String(w).toLowerCase(), w]));
  const artifacts = new Set();
  const found = new Set();
  let frds = [];
  try { frds = (await fs.readdir(path.join(root, "docs", "frds"))).filter((n) => n.startsWith("frd-")); } catch { frds = []; }
  for (const frd of frds) {
    const dir = path.join(root, "docs", "frds", frd, "work-orders");
    let names = [];
    try { names = (await fs.readdir(dir)).filter((n) => /^wo-.*\.md$/i.test(n)); } catch { continue; }
    for (const name of names) {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (fm.match(/^id:\s*["']?([^"'\s]+)/m)?.[1] ?? name.replace(/\.md$/i, "")).toLowerCase();
      const key = wanted.has(id) ? id : [...wanted.keys()].find((w) => name.toLowerCase().startsWith(w));
      if (!key) continue;
      found.add(key);
      const block = fm.match(/^artifacts:\s*\r?\n((?:[ \t]+-.*\r?\n?)*)/m)?.[1] ?? "";
      for (const line of block.split(/\r?\n/)) {
        const item = line.match(/^\s+-\s*["']?([^"']+?)["']?\s*$/);
        if (item) artifacts.add(item[1]);
      }
    }
  }
  return { artifacts: [...artifacts], missing: [...wanted.keys()].filter((k) => !found.has(k)).map((k) => wanted.get(k)) };
}

/**
 * Run classify-change.mjs over a text (its `--text` content signals S5-S8), by execFile, never imported. The text is a
 * `.ts` file in a private temp dir outside the repository so the prose exemption of S8 does not hide a destructive
 * statement and nothing lands in the project tree.
 * @param {{root: string, text: string}} input root = a git worktree of the project
 * @param {{exec?: Function, classifyScript?: string, tmpdir?: string, fs?: object}} [deps]
 * @returns {Promise<{ok: true, hits: {signal: string, level: string, detail: string}[]}|{ok: false, detail: string}>}
 */
export async function classifyText({ root, text }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const dir = await fs.mkdtemp(path.join(deps.tmpdir ?? os.tmpdir(), "pandacorp-doubt-"));
  try {
    const file = path.join(dir, "doubt-text.ts");
    await fs.writeFile(file, text, { mode: 0o600 });
    const script = deps.classifyScript ?? path.resolve(HERE, "../../scripts/classify-change.mjs");
    const exec = deps.exec ?? defaultExec;
    const res = await exec(process.execPath, [script, "--repo", root, "--files", "doubt-text.ts", "--text", file], { cwd: root, timeout: CLASSIFY_TIMEOUT_MS });
    if (res.code !== 0) return { ok: false, detail: `classify-change exited ${res.code}` };
    const line = String(res.stdout).trim().split("\n").pop();
    let parsed;
    try { parsed = JSON.parse(line); } catch { return { ok: false, detail: "classify-change printed no JSON" }; }
    if (!Array.isArray(parsed?.floor_hits)) return { ok: false, detail: "classify-change JSON has no floor_hits" };
    if (parsed.floor_hits.some((h) => h.signal === "FAILCLOSED")) return { ok: false, detail: "classify-change failed closed" };
    return { ok: true, hits: parsed.floor_hits };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Pure part of the veto: the never-decide reasons implied by a unit, a risk result, the classifier hits on the doubt
 * text, the doubt text itself and the DRs it cites.
 * @param {{unit: object, doubt: object, risk?: {irreversible: boolean, failclosed: boolean, zone: string}|null,
 *   text?: {ok: boolean, hits?: object[], detail?: string}|null, ownerDrs?: Set<string>|null}} input
 *   `ownerDrs` null = the registry could not be read
 * @returns {{reason: string, detail: string}[]} empty = the ladder may decide
 */
export function vetoReasons({ unit, doubt, risk = null, text = null, ownerDrs = new Set() }) {
  const out = [];
  const add = (reason, detail) => { if (!out.some((r) => r.reason === reason && r.detail === detail)) out.push({ reason, detail }); };
  if (unit.zone === "r1") add("irreversible", "unit zone r1");
  if (unit.waiting_gate) add("human_gate", `unit waits at gate ${unit.waiting_gate}`);
  if (risk?.failclosed) add("failclosed", "risk of the unit files was computed fail-closed");
  else if (risk?.irreversible) add("irreversible", `risk of the unit files: zone ${risk.zone}`);
  if (text && !text.ok) add("failclosed", `doubt text classifier: ${text.detail}`);
  for (const hit of text?.hits ?? []) {
    if (hit.level !== "critical") continue;
    add(TEXT_SIGNAL_REASON[hit.signal] ?? "floor_signal", `${hit.signal} in the doubt text`);
  }
  const body = [doubt.question, doubt.why, ...doubt.options.map((o) => o.text)].join("\n");
  if (SCOPE_RE_I.test(body) || SCOPE_RE_CASED.test(body)) add("scope", "the doubt is about scope (Dentro/Fuera, PRD, epics)");
  if (MONEY_RE.test(body)) add("money", "the doubt mentions money");
  if (GATE_RE.test(body)) add("human_gate", "the doubt mentions production, publishing or external communication");
  const cited = [...new Set(body.match(DR_RE) ?? [])];
  if (cited.length && ownerDrs === null) add("requires_owner_dr", `cites ${cited.join(", ")} and the decision registry is unreadable`);
  for (const dr of cited) if (ownerDrs?.has(dr)) add("requires_owner_dr", `${dr} has requiere_humano: true`);
  return out;
}

/**
 * Compute the deterministic veto of a doubt (outside the lease mutex: it runs the classifier).
 * @param {{project: string, root: string, unit: object, doubt: object}} input root = the integration worktree
 * @param {object} [deps] `computeRisk(input)`, `classifyText(input)`, `readArtifacts(root, wos)`, `registryFile`, fs, exec
 * @returns {Promise<{reasons: {reason: string, detail: string}[], vetoed: boolean}>}
 */
export async function assessVeto({ project, root, unit, doubt }, deps = {}) {
  const wos = Array.isArray(unit.wos) ? unit.wos : [];
  const { artifacts } = wos.length ? await (deps.readArtifacts ?? ((r, w) => readWoArtifacts(r, w, deps)))(root, wos) : { artifacts: [] };
  let risk = null;
  if (artifacts.length) {
    try {
      risk = await (deps.computeRisk ?? computeRisk)({ root, files: artifacts }, deps.riskDeps ?? {});
    } catch (error) {
      risk = { zone: "r1", irreversible: true, failclosed: true, detail: oneLine(error.message, 120) };
    }
  }
  const body = [`Question: ${doubt.question}`, `Why: ${doubt.why}`, ...doubt.options.map((o) => `Option ${o.id}: ${o.text}`)].join("\n");
  let text;
  try {
    text = await (deps.classifyText ?? ((input) => classifyText(input, deps)))({ root, text: `${body}\n` });
  } catch (error) {
    text = { ok: false, detail: oneLine(error.message, 120) };
  }
  const cites = DR_RE.test(body);
  DR_RE.lastIndex = 0;
  const yaml = cites ? await registryText(project, deps) : "";
  const reasons = vetoReasons({ unit, doubt, risk, text, ownerDrs: yaml === null ? null : drsRequiringOwner(yaml) });
  return { reasons, vetoed: reasons.length > 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// The ladder (pure)
// ---------------------------------------------------------------------------------------------------------------

/**
 * What the ladder does after the consults recorded so far (BUILD-12): decide when consult 1 agrees with the preferred
 * option at confidence >= medium; else a tie-break consult; after it, the option with 2 of 3 votes wins (the author's
 * preferred option is one vote; a consult votes only with a non-null decision at confidence >= medium). A consult that
 * calls a winning or preferred option irreversible parks the doubt. Caps are applied by the caller.
 * @param {object} record doubt record
 * @returns {{action: "decide", value: string, decided_by: "consult1"|"consult2", voters: object[]}
 *   | {action: "consult", no: number} | {action: "park", reason: string}}
 */
export function tally(record) {
  const answered = record.consults.filter((c) => c.answer !== null);
  const n = answered.length;
  if (n === 0) return { action: "consult", no: 1 };
  const voting = answered.filter((c) => c.answer.decision !== null && DECIDING_CONFIDENCE.includes(c.answer.confidence));
  if (n === 1) {
    const c1 = answered[0].answer;
    if (c1.decision === record.preferred && c1.reversible === false) return { action: "park", reason: "consult_irreversible" };
    if (voting.length === 1 && c1.decision === record.preferred) return { action: "decide", value: record.preferred, decided_by: "consult1", voters: voting };
    return { action: "consult", no: 2 };
  }
  const votes = new Map([[record.preferred, 1]]);
  for (const c of voting) votes.set(c.answer.decision, (votes.get(c.answer.decision) ?? 0) + 1);
  const winner = [...votes.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!winner) return n >= DOUBT_CAPS.CONSULTS_PER_DOUBT ? { action: "park", reason: "no_consensus" } : { action: "consult", no: n + 1 };
  const voters = voting.filter((c) => c.answer.decision === winner);
  if (voters.some((c) => c.answer.reversible !== true)) return { action: "park", reason: "consult_irreversible" };
  return { action: "decide", value: winner, decided_by: n >= 2 ? "consult2" : "consult1", voters };
}

/**
 * Is the preferred option reversible for the root rule? No veto, and no consult that voted for it called it irreversible.
 * @param {object} record @param {{vetoed?: boolean, reason?: string}} [ctx]
 * @returns {boolean}
 */
export function preferredReversible(record, { vetoed = false, reason = null } = {}) {
  if (vetoed || reason === "consult_irreversible" || VETO_REASONS.includes(reason)) return false;
  return !record.consults.some((c) => c.answer && c.answer.decision === record.preferred && c.answer.reversible === false);
}

// ---------------------------------------------------------------------------------------------------------------
// Owner-facing texts (Spanish, no dashes) and the decision-log entry (English, committed)
// ---------------------------------------------------------------------------------------------------------------

const PARK_REASON_ES = Object.freeze({
  irreversible: "es irreversible (lo decide el motor, no un modelo)",
  scope: "toca el alcance acordado (Dentro o Fuera)",
  money: "implica dinero o datos personales",
  human_gate: "toca una puerta humana (producción, borrado o comunicación externa)",
  requires_owner_dr: "una regla de decisión exige tu respuesta",
  floor_signal: "toca una zona crítica del proyecto",
  failclosed: "el clasificador de riesgo no pudo evaluarla y se aplica el camino prudente",
  cap_per_build: "ya se consultaron 8 dudas en este build (el máximo)",
  cap_per_doubt: "se agotaron las 3 consultas de esta duda",
  no_consultant: "no hay consultor disponible de la otra compañía",
  no_consensus: "las consultas no coincidieron con confianza suficiente",
  consult_irreversible: "un consultor la marcó como irreversible",
});

const parkReasonEs = (reasons) => reasons.map((r) => PARK_REASON_ES[r] ?? r).join("; ");

function optionsLine(record) {
  return record.options.map((o) => `${o.id}) ${es(o.text)}`).join(" · ");
}

function advisorsEs(record) {
  const lines = record.consults.filter((c) => c.answer).map((c) => {
    const a = c.answer;
    return `${cellText(c)}: ${a.decision === null ? "sin respuesta" : `opción ${a.decision}`} (confianza ${a.confidence}${a.reversible ? "" : ", no reversible"})`;
  });
  return lines.length ? lines.join("; ") : "ninguna";
}

function inboxEntry({ record, unit, runId, date, status, blocks, effect }) {
  const wos = unit.wos?.length ? unit.wos.join(", ") : unit.frd ?? "sin work order";
  return [
    `## ${date} - Duda ${record.id}: ${oneLine(es(record.question), 110)}`,
    `- **Id:** \`${record.id}\` (unidad \`${unit.id}\`, build \`${runId}\`)`,
    `- **Qué decidir:** ${es(record.question)}`,
    `- **Contexto / por qué:** El build la encontró al trabajar en la unidad \`${unit.id}\` (${wos}). Quien la planteó explica: ${es(record.why)}. ${effect}`,
    `- **Opciones:** ${optionsLine(record)}`,
    `- **Detalle de alternativas:** ${record.options.map((o) => `${o.id}) ${es(o.text)}${o.id === record.preferred ? " (la preferida por quien la planteó)" : ""}`).join("; ")}. Consultas hechas: ${advisorsEs(record)}.`,
    `- **Recomendación (del agente):** opción ${record.preferred}, la preferida por quien la planteó: ${es(record.why)}. Cambiaría de opinión si tu intención para esta tarea es otra.`,
    `- **Bloquea:** ${blocks.length ? blocks.map((b) => `\`${b}\``).join(", ") : "nada"}`,
    `- **Estado:** ${status}`,
    `- **Cómo responder:** dile tu opción a la sesión del build; la registra con \`answer --question ${record.id} --value '"<opción>"'\`.`,
    "",
  ].join("\n");
}

function decisionLogEntry({ record, unit, runId, card, date, advisors }) {
  const chosen = record.decision.value;
  const by = record.decision.decided_by === "sources"
    ? `sources (${record.decision.why})`
    : `${record.decision.decided_by} (${advisors.map((c) => `${cellText(c)}, confidence ${c.answer.confidence}`).join("; ")})`;
  return [
    `## ${date} · Decidido sin el owner: ${oneLine(record.question, 120)}`,
    "",
    `**Doubt:** \`${record.id}\` · unit \`${unit.id}\` · run \`${runId}\` · card ${card ? `\`${card}\`` : "none"}`,
    "",
    `**Question:** ${oneLine(record.question, 600)}`,
    "",
    `**Options:** ${record.options.map((o) => `\`${o.id}\` ${oneLine(o.text, 200)}`).join("; ")}`,
    "",
    `**Chosen:** \`${chosen}\` (${oneLine(optionText(record, chosen), 200)}); the author preferred \`${record.preferred}\`.`,
    "",
    `**Decided by:** ${by}. All advisors: ${record.consults.filter((c) => c.answer).map((c) => `${cellText(c)} -> ${c.answer.decision ?? "no answer"} (${c.answer.confidence})`).join("; ") || "none"}.`,
    "",
    `**Commit:** this entry on \`lane/${runId}\`; the implementation lands with unit \`${unit.id}\`${unit.wos?.length ? ` (${unit.wos.join(", ")})` : ""}.`,
    "",
    `**How to revert:** the owner says "Revierte la decisión ${record.id}"; it becomes a new change card (never a hand revert of this run).`,
    "",
  ].join("\n");
}

async function prependEntry(abs, entry, header, deps) {
  const fs = deps.fs ?? fsp;
  let current = "";
  try { current = await fs.readFile(abs, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const first = current.search(/^## /m);
  const next = !current.trim() ? `${header}\n\n${entry}` : first < 0 ? `${current.replace(/\s*$/, "\n\n")}${entry}` : `${current.slice(0, first)}${entry}\n${current.slice(first)}`;
  await atomicWriteText(abs, next, { fs, mode: 0o644 });
}

/**
 * Append (on top) an entry of `.pandacorp/inbox/decisions.md`: in the main checkout when the file is untracked, in the
 * integration worktree when it is tracked (D1; the caller commits it).
 * @returns {Promise<{rel: string, tracked: boolean}>}
 */
async function writeInbox(project, integrationRoot, entry, deps) {
  const rel = ".pandacorp/inbox/decisions.md";
  const { abs, tracked } = await writeTarget(project, rel, { integrationRoot, exec: deps.exec });
  await prependEntry(abs, entry, "# Decisiones pendientes", deps);
  return { rel, tracked };
}

/**
 * Stage paths in the integration worktree. A force-tracked file under a gitignored directory (decisions.md under
 * .pandacorp/inbox) is refused by a plain `git add`: use `git add -u`, then `git add -f` (code-conventions trap).
 */
async function gitAddTracked(exec, root, files) {
  const plain = await exec("git", ["add", "-u", "--", ...files], { cwd: root });
  const untracked = await exec("git", ["ls-files", "--others", "--", ...files], { cwd: root });
  if (plain.code === 0 && untracked.code === 0 && !untracked.stdout.trim()) return plain;
  return exec("git", ["add", "-f", "--", ...files], { cwd: root });
}

async function commitIntegration(root, files, message, deps) {
  const exec = deps.exec ?? defaultExec;
  if (!files.length) return null;
  const add = await gitAddTracked(exec, root, files);
  if (add.code !== 0) throw err("FAILCLOSED", `git add failed in the integration worktree: ${oneLine(add.stderr, 200)}`);
  const commit = await exec("git", ["commit", "-q", "-m", message, "--", ...files], { cwd: root });
  if (commit.code !== 0) throw err("FAILCLOSED", `git commit failed in the integration worktree: ${oneLine(commit.stderr || commit.stdout, 200)}`);
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  return head.stdout.trim();
}

// ---------------------------------------------------------------------------------------------------------------
// Consult briefs
// ---------------------------------------------------------------------------------------------------------------

async function cardScope(project, slug, deps) {
  if (!slug) return null;
  try {
    const { readCard } = await import("./card.mjs");
    const card = await readCard(project, slug, { where: "any" }, deps.cardDeps ?? {});
    return card ? { dentro: card.dentro.map((i) => i.text), fuera: card.fuera.map((i) => i.text) } : null;
  } catch {
    return null;
  }
}

async function consultBrief({ project, state, record, unit, consult, no, origin, reportPath }, deps) {
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
async function queueConsult(ctx, state, record, no, deps) {
  if (record.consults.length >= DOUBT_CAPS.CONSULTS_PER_DOUBT) return { park: "cap_per_doubt" };
  if (no === 1 && (state.doubts_consulted ?? 0) >= DOUBT_CAPS.CONSULTED_DOUBTS_PER_BUILD) return { park: "cap_per_build" };
  const unit = findUnit(state, record.unit);
  const origin = consultOrigin(state, unit);
  const consulted = record.consults.map((c) => ({ runtime: c.runtime, model: c.model }));
  let cell;
  try {
    cell = consultCell({ origin, consultNo: no, consulted, availability: deps.availability }, deps.tiers ? { tiers: deps.tiers } : undefined);
  } catch (error) {
    throw err("INVALID_STATE", `doubt consult routing failed: ${error.message}`);
  }
  if (!cell) return { park: "no_consultant" };
  const unitId = `u-doubt-consult-${record.id}-c${no}`;
  if (findUnit(state, unitId)) throw err("INVALID_STATE", `consult unit ${unitId} already exists`);
  const via = cell.runtime === "codex" ? "cli" : "agent";
  const consult = { runtime: cell.runtime, model: cell.model, effort: cell.effort, via, unit: unitId, brief_path: ctx.paths.briefFile(unitId), answer: null };
  const consultUnit = newUnit({ id: unitId, kind: "doubt-consult", frd: unit?.frd ?? null, doubt_id: record.id, zone: "none" });
  await consultBrief({ project: ctx.project, state, record, unit, consult, no, origin, reportPath: ctx.paths.unitAnswerFile(unitId) }, deps);
  const nextRecord = { ...record, step: no === 1 ? "consult1" : "consult2", consults: [...record.consults, consult] };
  const nextState = { ...state, units: [...state.units, consultUnit], doubts_consulted: (state.doubts_consulted ?? 0) + (no === 1 ? 1 : 0) };
  await ctx.appendEvent({ type: "unit_queued", data: consultUnit });
  if (no === 1) await ctx.appendEvent({ type: "doubt_consulted", data: { doubt_id: record.id, unit: record.unit, consult_unit: unitId, consult_no: no, cell, via } });
  return { state: nextState, record: nextRecord, consult: { unit: unitId, runtime: cell.runtime, model: cell.model, effort: cell.effort, brief_path: consult.brief_path, via } };
}

async function decide(ctx, state, record, { value, decided_by, why, voters }, deps) {
  const unit = findUnit(state, record.unit);
  const decided = { ...record, step: "decided", decision: { value, why: oneLine(why, 600) || "decided by the ladder", decided_by } };
  const integrationRoot = path.resolve(ctx.project, state.integration.worktree);
  const date = nowIso(deps).slice(0, 10);
  const logAbs = path.join(integrationRoot, "docs", "decision-log.md");
  await prependEntry(logAbs, decisionLogEntry({ record: decided, unit, runId: ctx.runId, card: state.scope.card, date, advisors: voters }), "# Decision Log", deps);
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

async function park(ctx, state, record, { reasons, reversible }, deps) {
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

/**
 * Advance the ladder after the record changed (an answer was filed): decide, queue the next consult, or park.
 * @returns {Promise<{state: object, record: object, out: object}>}
 */
async function advance(ctx, state, record, deps) {
  const verdict = tally(record);
  if (verdict.action === "decide") {
    const why = verdict.voters.map((c) => `${cellText(c)}: ${c.answer.rationale}`).join(" | ");
    const done = await decide(ctx, state, record, { value: verdict.value, decided_by: verdict.decided_by, why, voters: verdict.voters }, deps);
    return { state: done.state, record: done.record, out: { step: "decided", decision: done.decision, sha: done.sha, warnings: done.warnings } };
  }
  if (verdict.action === "consult") {
    const queued = await queueConsult(ctx, state, record, verdict.no, deps);
    if (!queued.park) return { state: queued.state, record: queued.record, out: { step: queued.record.step, consult: queued.consult } };
    return parkOut(ctx, state, record, [queued.park], deps);
  }
  return parkOut(ctx, state, record, [verdict.reason], deps);
}

async function parkOut(ctx, state, record, reasons, deps) {
  const reversible = preferredReversible(record, { reason: reasons[0] }) && !reasons.some((r) => VETO_REASONS.includes(r) || r === "consult_irreversible");
  const parked = await park(ctx, state, record, { reasons, reversible }, deps);
  return {
    state: parked.state, record: parked.record,
    out: { step: "parked", parked: { mode: parked.mode, reasons, units: parked.units, branch: parked.branch, ratio: parked.block.ratio }, notice_es: parked.notice_es, warnings: parked.warnings },
  };
}

function output(sub, record, out) {
  return {
    ok: true, cmd: "doubt", sub, doubt_id: record.id, step: record.step,
    ...(out.consult ? { consult: out.consult } : {}),
    decision: record.step === "decided" ? record.decision : null,
    ...(out.parked ? { parked: out.parked } : {}),
    ...(out.notice_es ? { notice_es: out.notice_es } : {}),
    ...(out.applied === false ? { applied: false, reason: out.reason } : {}),
    ...(out.warnings?.length ? { warnings: out.warnings } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------------

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
      return { unit, root: path.resolve(project, state.integration.worktree) };
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
      } else if (sourcesSkipped(state)) {
        ({ state, record, out } = await advance(ctx, state, record, deps));
      }
      await writeDoubt(project, record, deps);
      await ctx.writeState(state);
      return output("open", record, out);
    });
}

function validateSourcesAnswer(answer, record) {
  if (!("decision" in answer) || (answer.decision !== null && typeof answer.decision !== "string")) throw err("INVALID_INPUT", "sources answer: decision must be a string or null");
  if (typeof answer.rationale !== "string" || !answer.rationale.trim()) throw err("INVALID_INPUT", "sources answer: rationale must be a non-empty string");
  if (answer.consulted !== null && answer.consulted !== undefined) throw err("INVALID_INPUT", "sources answer: consulted must be null on the sources step");
  if (answer.decision !== null) {
    if (!record.options.some((o) => o.id === answer.decision)) throw err("INVALID_INPUT", `sources answer: ${answer.decision} is not an option of ${record.id}`);
    if (!CITATION_RE.test(answer.rationale)) throw err("INVALID_INPUT", "sources answer: a source hit must cite path:line in rationale");
  }
  return { decision: answer.decision, rationale: answer.rationale.trim() };
}

async function validateConsultAnswer(answer, record, deps) {
  const check = validate(await loadSchema("doubt-answer", { fs: deps.fs ?? fsp }), answer);
  if (!check.ok) throw err("INVALID_INPUT", `consult answer invalid: ${check.errors.map((e) => `${e.path || "/"} ${e.message}`).join("; ")}`);
  if (answer.decision !== null && !record.options.some((o) => o.id === answer.decision)) throw err("INVALID_INPUT", `consult answer: ${answer.decision} is not an option of ${record.id}`);
  return answer;
}

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
      } else {
        const done = await decide(ctx, state, record, { value: filed.decision, decided_by: "sources", why: filed.rationale, voters: [] }, deps);
        next = { state: done.state, record: done.record, out: { step: "decided", decision: done.decision, warnings: done.warnings } };
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

/**
 * Dispatcher entry for `doubt open|answer`.
 * @param {{sub: "open"|"answer", project: string, epoch: number, unit?: string, id?: string, file: string, token?: string}} input
 * @param {object} [deps]
 */
export async function doubtCommand(input, deps = {}) {
  if (input?.epoch === undefined || input.epoch === null || Number.isNaN(Number(input.epoch))) throw err("USAGE", "--epoch is required");
  if (input.sub === "open") return openDoubt(input, deps);
  if (input.sub === "answer") return answerDoubt(input, deps);
  throw err("USAGE", "doubt takes open|answer");
}

/** The doubt id pattern (`d-NNNN`). */
export const isDoubtId = (id) => DOUBT_ID_RE.test(String(id ?? ""));
