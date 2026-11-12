// review-record (CLI doc 3.10, BUILD-10, D23, D11, A8, A19): ingest a reviewer's report for a `review`,
// `deferred-review` or `audit` unit. Validates it against review-report.schema.json, stores the failed-first probes
// (committed on `lane/<run_id>`, hashed into the review unit's `probe_hashes`, within the probe budget), applies the
// verdict (pass / reopen -> patch unit / blocked -> hand-back / doubt), queues a deferred re-review when the review was
// degraded (other company out of quota or unreachable, N7, Sol at capacity) and journals `review_recorded` with
// `data.verdict`. Reviewer selection is never hardcoded: the matrix lives in model-tiers.json behind routing.mjs.
//
// Two-phase rule (D5): phase 1 verifies fence, unit, token and report; the work phase hashes files read-only; phase 2
// (mutex held) commits probes and work-order transitions in the integration worktree, writes the deferred ledger,
// appends the journal events, then the state, then releases the token. Never writes a tracked file in the main checkout.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken, verifyToken } from "./admission.mjs";
import { createCard } from "./card.mjs";
import { completeDeferred, enqueueDeferred, entryForUnit, readDeferred } from "./deferred.mjs";
import { assertValid, atomicWriteJson, defaultExec, loadSchema, nowIso, sha256Hex } from "./fsx.mjs";
import { handBack as failureHandBack } from "./failure.mjs";
import { readJournal } from "./journal.mjs";
import { resolveInside } from "./paths.mjs";
import { reviewCell } from "./routing.mjs";
import { fencedTwoPhase, findUnit, newUnit } from "./state.mjs";

/** At most this many probes per FRD beyond one per finding. The number is stated once, in build-engine.md BUILD-10. */
export const PROBE_EXTRA_PER_FRD = 3;
/** Unit kinds whose report is filed with `review-record` (A8). */
export const REVIEW_RECORD_KINDS = Object.freeze(["review", "deferred-review", "audit"]);

const RECORDABLE_STATES = ["admitted", "running"];
const REVIEWED_FROM = ["integrated", "reviewing", "verified"];
const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const BLOCKING_SEVERITIES = ["critical", "high"];
const STRENGTH = { haiku: 1, luna: 1, sonnet: 2, sol: 2, terra: 2, opus: 3, astra: 3, fable: 4 };
const AVAILABILITY_LEVELS = ["ok", "quota", "unreachable", "at_capacity"];
const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const frdKey = (value) => (value ?? "").toLowerCase();
const unique = (items) => [...new Set(items)];

// ---------------------------------------------------------------------------------------------
// Report validation
// ---------------------------------------------------------------------------------------------

/**
 * Is `rel` a path a review may add as a probe (A2: the test globs only, repo-relative, no traversal)?
 * @param {string} rel
 * @returns {boolean}
 */
export function isProbePath(rel) {
  if (typeof rel !== "string" || rel === "" || rel.includes("\\") || rel.includes("\0") || path.posix.isAbsolute(rel) || path.posix.normalize(rel) !== rel) return false;
  const segments = rel.split("/");
  if (segments.includes("..")) return false;
  const dir = segments.slice(0, -1);
  return dir.includes("_tests") || /\.(test|spec)\.[^/]+$/.test(rel) || (rel.startsWith("e2e/") && dir.length > 0) || rel.startsWith("src/test/");
}

/** Counts of findings by severity (the `review_recorded` shape). */
export const countFindings = (findings) => findings.reduce((acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }), { critical: 0, high: 0, medium: 0, low: 0 });

async function loadReport({ file, report }, fs) {
  if (report !== undefined) return report;
  if (typeof file !== "string" || !file) throw err("USAGE", "review-record needs --file <review.json>");
  let text;
  try {
    if ((await fs.stat(file)).size > MAX_REPORT_BYTES) throw new Error("too large");
    text = await fs.readFile(file, "utf8");
  } catch { throw err("INVALID_INPUT", `review file is unreadable or too large: ${file}`); }
  try { return JSON.parse(text); } catch { throw err("INVALID_INPUT", `review file is not valid JSON: ${file}`); }
}

/**
 * Validate a review report: the schema plus the cross-field rules the schema cannot state. Exit 6 on any failure.
 * @param {object} report parsed review.json
 * @param {{unit: string, token: string}} expect the unit and token the CLI was called with (the report echoes both)
 * @param {{fs?: object}} [deps]
 * @returns {Promise<object>} the report
 * @throws INVALID_INPUT
 */
export async function validateReviewReport(report, expect, deps = {}) {
  assertValid(await loadSchema("review-report", { fs: deps.fs ?? fsp }), report, { label: "review report", code: "INVALID_INPUT" });
  if (report.unit !== expect.unit) throw err("INVALID_INPUT", `review report is for unit ${report.unit}, not ${expect.unit}`);
  if (report.token !== expect.token) throw err("INVALID_INPUT", "review report does not echo the unit token");
  const { verdict, findings, probes, traceability, doubt } = report;
  if ((verdict === "doubt") !== (doubt !== null)) throw err("INVALID_INPUT", 'a review report carries `doubt` exactly when its verdict is "doubt"');
  if ((verdict === "reopen" || verdict === "blocked") && findings.length === 0) throw err("INVALID_INPUT", `verdict "${verdict}" needs at least one finding (it is the reason)`);
  if (verdict === "pass" && findings.some((f) => BLOCKING_SEVERITIES.includes(f.severity))) throw err("INVALID_INPUT", 'verdict "pass" cannot carry a critical or high finding');
  if (verdict === "pass" && traceability.some((t) => t.status === "fail")) throw err("INVALID_INPUT", 'verdict "pass" cannot carry a failing traceability entry');
  const paths = probes.map((p) => p.path);
  const bad = paths.find((p) => !isProbePath(p));
  if (bad !== undefined) throw err("INVALID_INPUT", `probe path is not an allowed test path: ${bad}`);
  if (unique(paths).length !== paths.length) throw err("INVALID_INPUT", "a probe path is listed twice");
  const stray = findings.find((f) => f.probe !== null && !paths.includes(f.probe));
  if (stray) throw err("INVALID_INPUT", `finding ${stray.id} names a probe that is not in probes[]: ${stray.probe}`);
  return report;
}

// ---------------------------------------------------------------------------------------------
// Which units are reviewed, who authored them, was the review degraded
// ---------------------------------------------------------------------------------------------

const isWorkUnit = (u) => u.kind === "build" || u.kind === "patch";

/**
 * The build and patch units a review unit judges: its `depends_on` work units, else the same FRD's integrated or
 * verified ones (an audit judges every such unit of the run).
 * @param {object} state
 * @param {object} review the review-type unit
 * @returns {object[]}
 */
export function reviewedUnits(state, review) {
  const named = (review.depends_on ?? []).map((id) => findUnit(state, id)).filter((u) => u && isWorkUnit(u));
  if (named.length > 0) return named;
  return state.units.filter((u) => isWorkUnit(u) && REVIEWED_FROM.includes(u.state) && (review.kind === "audit" || (review.frd && u.frd === review.frd)));
}

/** Author cells (the dispatch cells) of the reviewed units, deduplicated. */
export function authorsOf(units) {
  const seen = new Map();
  for (const u of units) {
    if (!u.worker) continue;
    const author = { runtime: u.worker.runtime, model: u.worker.model, effort: u.worker.effort ?? null, via: u.worker.via };
    seen.set(`${author.runtime}/${author.model}/${author.effort}/${author.via}`, author);
  }
  return [...seen.values()];
}

const sameCell = (a, b) => a.runtime === b.runtime && a.model === b.model && a.effort === b.effort;
const asSchemaCell = (cell) => ({ runtime: cell.runtime, model: cell.model, effort: cell.effort ?? "high" });

function availabilityCandidates(hint) {
  const combos = [];
  for (const claude of AVAILABILITY_LEVELS.filter((l) => l !== "at_capacity")) for (const codex of AVAILABILITY_LEVELS) combos.push({ claude, codex });
  const weight = (c) => (c.claude !== "ok") + (c.codex !== "ok");
  combos.sort((a, b) => weight(a) - weight(b));
  return hint ? [hint, ...combos] : combos;
}

/**
 * Was this review degraded? Replays the BUILD-10 matrix (routing.mjs `reviewCell`, never a local copy) over the
 * availabilities that could have applied, fewest degradations first, and returns the first whose reviewer cell is the
 * one that actually reviewed. All companies available is tried first, so a primary reviewer is never degraded.
 * @param {{authors: object[], kind: "frd"|"touch", zone: string, reviewer: object, hint?: object, shapes?: Array<string|undefined>}} input
 * @param {object} [deps] `deps.tiers` replaces model-tiers.json (tests)
 * @returns {{matched: boolean, degraded: string|null, deferred: object|null, primary: object|null, row: number|null}}
 */
/** Keep only the quota picture's claude/codex fields. */
const normalizeHint = (a) => (a ? { claude: a.claude, codex: a.codex } : undefined);

export function inferDegradation({ authors, kind, zone, reviewer, hint, shapes = [undefined] }, deps = {}) {
  if (authors.length === 0) return { matched: true, degraded: null, deferred: null, primary: null, row: null };
  for (const shape of shapes) {
    for (const availability of availabilityCandidates(hint)) {
      let result;
      try { result = (deps.routing?.reviewCell ?? deps.reviewCell ?? reviewCell)({ authors, kind, zone, availability, ...(shape ? { shape } : {}) }, deps); } catch (error) {
        if (error?.code === "ROUTING") continue;
        throw error;
      }
      if (result.used && sameCell(result.used, reviewer)) return { matched: true, degraded: result.degraded, deferred: result.deferred, primary: result.primary, row: result.row };
    }
  }
  return { matched: false, degraded: null, deferred: null, primary: null, row: null };
}

const strongestAuthor = (authors) => authors.reduce((best, a) => ((STRENGTH[a.model] ?? 0) > (STRENGTH[best.model] ?? 0) ? a : best));

// ---------------------------------------------------------------------------------------------
// Git and work-order helpers (integration worktree only)
// ---------------------------------------------------------------------------------------------

async function git(exec, cwd, args) {
  const r = await exec("git", args, { cwd });
  if (r.code !== 0) throw err("INVALID_STATE", `git ${args[0]} failed in ${cwd}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
  return r.stdout.trim();
}

async function commitStaged(exec, cwd, subject, trailers) {
  if ((await exec("git", ["diff", "--cached", "--quiet"], { cwd })).code === 0) return null;
  await git(exec, cwd, ["-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", subject, "-m", trailers.join("\n")]);
  return git(exec, cwd, ["rev-parse", "HEAD"]);
}

async function stageTrackedChanges(exec, cwd) {
  const changed = (await git(exec, cwd, ["diff", "--name-only"])).split("\n").filter((f) => f && !f.startsWith(".pandacorp/run/"));
  if (changed.length > 0) await git(exec, cwd, ["add", "--", ...changed]);
}

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

function readArtifacts(block) {
  const lines = block.split(/\r?\n/);
  const at = lines.findIndex((l) => /^artifacts:/.test(l));
  if (at < 0) return [];
  const inline = lines[at].replace(/^artifacts:\s*/, "").trim();
  const clean = (s) => s.trim().replace(/^['"]|['"]$/g, "");
  if (inline.startsWith("[")) return inline.replace(/^\[|\]$/g, "").split(",").map(clean).filter(Boolean);
  const out = [];
  for (const line of lines.slice(at + 1)) {
    const m = line.match(/^\s+-\s+(.+)$/);
    if (!m) break;
    out.push(clean(m[1]));
  }
  return out;
}

/** Work orders of a worktree: `{id (lowercase), rel, artifacts[]}` for every `docs/frds/<frd>/work-orders/*.md`. */
export async function scanWorkOrders(root, fs = fsp) {
  const found = [];
  const frdsDir = path.join(root, "docs", "frds");
  let frds;
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code === "ENOENT") return found; throw error; }
  for (const frd of frds.sort()) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names;
    try { names = await fs.readdir(dir); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const block = (await fs.readFile(path.join(dir, name), "utf8")).match(FM_BLOCK)?.[1] ?? "";
      const id = (block.match(/^id:[ \t]*(.+?)[ \t]*$/m)?.[1] ?? name.replace(/\.md$/, "")).replace(/^['"]|['"]$/g, "").toLowerCase();
      found.push({ id, rel: `docs/frds/${frd}/work-orders/${name}`, artifacts: readArtifacts(block) });
    }
  }
  return found;
}

// D30 literal-prefix rule, conservative: a finding file belongs to a WO when it sits under one of its artifact globs.
function underArtifact(file, glob) {
  const wild = glob.search(/[*?[{]/);
  if (wild < 0) return file === glob || file.startsWith(glob.endsWith("/") ? glob : `${glob}/`);
  return file.startsWith(glob.slice(0, wild));
}

/**
 * Which work orders a `reopen` verdict reopens: the reviewed WOs whose artifacts contain a finding's file; when no
 * finding can be placed (or no artifacts parse), every WO of the reviewed units (the reviewer cannot be second-guessed).
 * @param {object[]} reviewed reviewed units
 * @param {object[]} findings report findings
 * @param {Array<{id: string, artifacts: string[]}>} workOrders from scanWorkOrders
 * @returns {string[]} lowercase WO ids, in unit order
 */
export function pickReopenWos(reviewed, findings, workOrders) {
  const all = unique(reviewed.flatMap((u) => u.wos.map((w) => w.toLowerCase())));
  const byId = new Map(workOrders.map((w) => [w.id, w]));
  const hit = all.filter((id) => findings.some((f) => (byId.get(id)?.artifacts ?? []).some((g) => underArtifact(f.file, g))));
  return hit.length > 0 ? hit : all;
}

// ---------------------------------------------------------------------------------------------
// Hand-back, bug card
// ---------------------------------------------------------------------------------------------

/**
 * Hand the reviewed units back through the one real hand-back (failure.mjs `handBack`: `handback/<unit>.md`, the pending
 * `decisions.md` entry, WO `BLOCKED` + a commit, the unit and every non-terminal dependent `blocked`, R4). `handBack`
 * works on the ctx's state, but review phase 2 keeps its own working copy (`next`) and writes it once at the end, so the
 * ctx handed to `handBack` is a view over that copy: it reads `next`, applies the plan's unit changes to it in place
 * (the review unit's own state is review's to set) and collects the plan's events into `events`.
 * @param {{ctx: object, next: object, events: object[], review: object, units: object[], reason: string, reasonCode: string, findings: object[], cause: string, effects: {handed_back: string[]}, deps: object}} c
 *   `deps.handback` replaces `failure.handBack` (same `(ctx, input, deps)` shape)
 */
async function handBackReviewed(c) {
  const { ctx, next, events, review, units, reason, reasonCode, cause, findings, effects, deps } = c;
  const handBack = deps.handback ?? failureHandBack;
  const view = {
    ...ctx,
    readState: async () => next,
    writeState: async (plan) => {
      for (const u of plan.units) if (u.id !== review.id) Object.assign(findUnit(next, u.id), u);
      next.handbacks_in_a_row = plan.handbacks_in_a_row;
    },
    appendEvent: async (event) => { if (!(event.type === "unit_state" && event.data?.unit === review.id)) events.push(event); },
  };
  const tail = findings.map((f) => `[${f.severity}] ${f.file}${f.line === null ? "" : `:${f.line}`}: ${f.summary}`).join("\n");
  for (const u of units) {
    await handBack(view, { unitId: u.id, cause, reasonCode, reason, failure: { command: null, tail } }, deps);
    effects.handed_back.push(u.id);
  }
}

// The card check demands a quoted citation in every Dentro item; the finding summary is the quote.
const quote = (text) => String(text).replace(/["\r\n]+/g, " ").trim();
const slugify = (s) => String(s ?? "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

async function fileBugCard(project, entry, review, report, deps) {
  const grave = report.findings.filter((f) => BLOCKING_SEVERITIES.includes(f.severity) || report.verdict === "blocked" || report.verdict === "reopen");
  const slug = `review-${slugify(entry.frd ?? entry.unit)}-${entry.id}`;
  const create = deps.createCard ?? createCard;
  try {
    await create(project, {
      slug, type: "bug", class: "standard", frd: entry.frd ?? undefined, affected_frds: entry.frd ? [entry.frd] : [], origin: "deferred-review",
      title: `Hallazgo grave en la revisión diferida de ${entry.frd ?? entry.unit}`,
      dentro: grave.slice(0, 10).map((f) => `Corregir "${quote(f.summary)}" en ${f.file}${f.line === null ? "" : `:${f.line}`}`),
      fuera: [], dudas: [],
    }, deps);
  } catch (error) {
    if (!/already exists/.test(error?.message ?? "")) throw error;
  }
  return slug;
}

// ---------------------------------------------------------------------------------------------
// review-record
// ---------------------------------------------------------------------------------------------

async function extraProbesUsed(paths, frd, deps) {
  const { events } = await readJournal(paths.journalFile, { fs: deps.fs });
  return events
    .filter((e) => e.type === "review_recorded" && frdKey(e.data?.frd) === frdKey(frd))
    .reduce((sum, e) => sum + Math.max(0, (e.data.probes_committed?.length ?? 0) - Object.values(e.data.findings ?? {}).reduce((a, b) => a + b, 0)), 0);
}

/** Probes to keep: failed-first only, finding-referenced first, capped at one per finding plus the FRD's remaining extras. */
function selectProbes(report, extraUsed) {
  const referenced = new Set(report.findings.map((f) => f.probe).filter(Boolean));
  const candidates = report.probes.filter((p) => p.failed_first).map((p) => p.path);
  const ordered = [...candidates.filter((p) => referenced.has(p)), ...candidates.filter((p) => !referenced.has(p))];
  const cap = report.findings.length + Math.max(0, PROBE_EXTRA_PER_FRD - extraUsed);
  const skipped = report.probes.filter((p) => !p.failed_first).map((p) => ({ path: p.path, reason: "not_failed_first" }));
  return { kept: ordered.slice(0, cap), skipped: [...skipped, ...ordered.slice(cap).map((p) => ({ path: p, reason: "budget" }))] };
}

async function hashFile(fs, abs) {
  let data;
  try { data = await fs.readFile(abs); } catch { throw err("INVALID_INPUT", `probe file is missing: ${abs}`); }
  return sha256Hex(data);
}

/**
 * Record a reviewer's verdict (CLI `review-record`).
 * @param {{project: string, epoch: number|string, unit: string, token: string, file?: string, report?: object, deferredId?: string}} input
 *   `file` is the review.json path; `report` (already parsed) replaces it; `deferredId` names the ledger entry a
 *   `deferred-review` unit serves (default: matched from the unit id, then by FRD)
 * @param {{fs?: object, exec?: Function, env?: object, clock?: Function, buildState?: object, tiers?: object,
 *   availability?: {claude?: string, codex?: string}, handback?: Function, createCard?: Function, admissionFs?: object}} [deps]
 *   `handback(ctx, {units, reason, review_unit, findings, workOrders, root, transition})` -> `{paths}` replaces the minimal
 *   built-in hand-back; `availability` is the quota picture at dispatch, tried before the inferred ones
 * @returns {Promise<{ok: true, cmd: "review-record", verdict: string, deferred_review_id: string|null, probes_committed: string[],
 *   reviewer: object, degraded: string|null, reviewed_units: string[], patch_unit: string|null, handed_back: string[],
 *   bug_card: string|null, doubt_file: string|null, probes_skipped: object[], last_safe_point: object}>}
 * @throws INVALID_INPUT (exit 6: bad report, token, probe), INVALID_STATE (5), FENCE / QUIESCED (3), USAGE (2)
 */
export async function reviewRecord(input, deps = {}) {
  const { project, epoch, unit: unitId, token } = input ?? {};
  if (typeof project !== "string" || !project || !Number.isInteger(Number(epoch)) || typeof unitId !== "string" || !unitId) throw err("USAGE", "review-record needs project, epoch and unit");
  const fs = deps.fs ?? fsp;
  const exec = deps.exec ?? defaultExec;

  const phase1 = async (ctx) => {
    const state = await ctx.readState();
    const unit = state && findUnit(state, unitId);
    if (!unit) throw err("INVALID_STATE", `unknown unit ${unitId}`);
    if (!REVIEW_RECORD_KINDS.includes(unit.kind)) throw err("INVALID_STATE", `review-record takes review, deferred-review and audit units, not ${unit.kind}`);
    if (!RECORDABLE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unitId} is ${unit.state}, not awaiting a review`);
    const check = verifyToken(unitId, token, { file: ctx.paths.admissionFile, fs: deps.admissionFs });
    if (!check.ok) throw err("INVALID_INPUT", `unit token rejected (${check.reason})`);
    const report = await validateReviewReport(await loadReport(input, fs), { unit: unitId, token }, deps);
    const w = unit.worker;
    if (w && (w.runtime !== report.reviewer.runtime || w.model !== report.reviewer.model)) throw err("INVALID_INPUT", "report reviewer differs from the dispatch cell");
    if (unit.kind === "review") {
      const authors = authorsOf(reviewedUnits(state, unit));
      const rv = w ?? report.reviewer;
      if (authors.some((a) => a.runtime === rv.runtime && a.model === rv.model)) {
        const d = inferDegradation({
          authors, kind: state.size === "touch" ? "touch" : "frd", zone: unit.zone,
          reviewer: { runtime: rv.runtime, model: rv.model, effort: rv.effort ?? report.reviewer.effort },
          hint: normalizeHint(deps.availability), shapes: state.coordinator === "drive" ? ["drive", undefined] : [undefined],
        }, deps);
        if (d.degraded !== "same_model") throw err("INVALID_INPUT", "an author never reviews its own unit outside the N7 exception");
      }
    }
    return { report };
  };

  const work = async ({ report }, ctx) => {
    const state = await ctx.readState();
    const review = findUnit(state, unitId);
    const root = state.integration.worktree;
    const branch = await git(exec, root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch !== state.integration.branch) throw err("INVALID_STATE", `integration worktree is on ${branch}, not ${state.integration.branch}`);
    const tip = await git(exec, root, ["rev-parse", "HEAD"]);
    const probeRoot = review.worktree ?? ctx.paths.unitWorktree(review.id, review.attempt);
    const hashes = {};
    for (const p of report.probes.filter((x) => x.failed_first)) hashes[p.path] = await hashFile(fs, resolveInside(probeRoot, p.path));
    return { tip, probeRoot, hashes };
  };

  const phase2 = async (found, { report }, ctx) => {
    const state = await ctx.readState();
    const review = findUnit(state, unitId);
    if (!review || !RECORDABLE_STATES.includes(review.state)) throw err("INVALID_STATE", `unit ${unitId} is no longer awaiting a review`);
    const root = state.integration.worktree;
    const at = nowIso(deps);
    const reviewed = reviewedUnits(state, review);
    const authors = review.kind === "audit" ? [] : authorsOf(reviewed);
    const dispatch = review.worker;
    const reviewer = { runtime: dispatch?.runtime ?? report.reviewer.runtime, model: dispatch?.model ?? report.reviewer.model, effort: dispatch?.effort ?? report.reviewer.effort };

    // 1. Probes: budget, then commit on the integration branch with the review unit's trailer.
    const { kept, skipped } = selectProbes(report, await extraProbesUsed(ctx.paths, review.frd, deps));
    const probeHashes = {};
    for (const rel of kept) {
      const sourceAbs = resolveInside(found.probeRoot, rel);
      const targetAbs = resolveInside(root, rel);
      const hash = await hashFile(fs, sourceAbs);
      if (hash !== found.hashes[rel]) throw err("INVALID_INPUT", `probe changed while the review was recorded (hash mismatch): ${rel}`);
      if (review.probe_hashes?.[rel] && review.probe_hashes[rel] !== hash) throw err("INVALID_INPUT", `probe ${rel} was already recorded with another hash`);
      const existing = await fs.readFile(targetAbs).then((b) => sha256Hex(b), () => null);
      if (existing !== null && existing !== hash) throw err("INVALID_INPUT", `probe ${rel} would overwrite an existing file on ${state.integration.branch}`);
      if (existing === null) {
        await fs.mkdir(path.dirname(targetAbs), { recursive: true });
        await fs.copyFile(sourceAbs, targetAbs);
      }
      probeHashes[rel] = hash;
    }
    const probeFiles = Object.keys(probeHashes);
    if (probeFiles.length > 0) {
      await git(exec, root, ["add", "--", ...probeFiles]);
      await commitStaged(exec, root, `test(${review.frd ?? "review"}): failed-first probes from review ${review.id}`, [`Unit: ${review.id}`]);
    }

    // 2. Degradation and the deferred ledger.
    const events = [];
    const next = structuredClone(state);
    const nextReview = findUnit(next, review.id);
    let degradation = { matched: true, degraded: null, deferred: null, primary: null, row: null };
    if (review.kind === "review") {
      degradation = inferDegradation({
        authors, kind: state.size === "touch" ? "touch" : "frd", zone: review.zone, reviewer, hint: normalizeHint(deps.availability),
        shapes: state.coordinator === "drive" ? ["drive", undefined] : [undefined],
      }, deps);
    }
    let deferredId = null;
    let bugCard = null;
    let resultEntry = null;
    if (review.kind === "review" && degradation.degraded && degradation.deferred && authors.length > 0) {
      const { entry } = await enqueueDeferred(project, {
        unit: review.id, kind: "review", frd: review.frd, sha_range: `${state.integration.base_sha}..${found.tip}`, author: asSchemaCell(strongestAuthor(authors)),
        reviewer_used: asSchemaCell(reviewer), degraded: degradation.degraded, needed: degradation.deferred.needed, created_at: at,
      }, deps);
      deferredId = entry.id;
      events.push({ type: "deferred_review_queued", data: { id: entry.id, unit: review.id, frd: review.frd, needed: entry.needed, degraded: entry.degraded, reviewer_used: entry.reviewer_used } });
    }
    if (review.kind === "deferred-review" && report.verdict !== "doubt") {
      const entry = entryForUnit(await readDeferred(project, deps), review, input.deferredId ?? null);
      if (entry) {
        deferredId = entry.id;
        const grave = report.verdict === "reopen" || report.verdict === "blocked" || report.findings.some((f) => BLOCKING_SEVERITIES.includes(f.severity));
        if (grave) bugCard = await fileBugCard(project, entry, review, report, deps);
        resultEntry = await completeDeferred(project, entry.id, { result: { verdict: report.verdict, findings: countFindings(report.findings), review_unit: review.id, reviewer: asSchemaCell(reviewer), recorded_at: at, bug_card: bugCard } }, deps);
        events.push({ type: "deferred_review_done", data: { id: entry.id, unit: review.id, verdict: report.verdict, findings: countFindings(report.findings), bug_card: bugCard } });
      }
    }

    // 3. Verdict effects. A deferred re-review judges code already handled: it never changes the reviewed units.
    const effects = { patch_unit: null, handed_back: [], doubt_file: null };
    const touchesUnits = review.kind !== "deferred-review";
    const setState = (u, to) => {
      const target = findUnit(next, u.id);
      events.push({ type: "unit_state", data: { unit: u.id, from: target.state, to } });
      target.state = to;
    };
    const transition = deps.buildState?.transitionWorkOrderAt ?? (await import("../build-state.mjs")).transitionWorkOrderAt;
    if (report.verdict === "pass" && touchesUnits) {
      for (const u of reviewed.filter((x) => ["integrated", "reviewing"].includes(x.state))) setState(u, "verified");
    } else if (report.verdict === "reopen" && touchesUnits) {
      await applyReopen({ state, next, review, reviewed, report, root, fs, transition, events, effects, setState, deps, ctx, kept: probeFiles });
    } else if (report.verdict === "blocked" && touchesUnits) {
      const targets = reviewed.filter((x) => REVIEWED_FROM.includes(x.state));
      const reason = report.findings.map((f) => f.summary).join("; ").slice(0, 300);
      await handBackReviewed({ ctx, next, events, review, units: targets, reason, reasonCode: "review_blocked", cause: "owner", findings: report.findings, effects, deps });
      next.handbacks_in_a_row = 0;
      await stageTrackedChanges(exec, root);
      await commitStaged(exec, root, `chore(engine): hand back ${targets.map((u) => u.id).join(", ")} after review ${review.id}`, [`Unit: ${review.id}`, ...unique(targets.flatMap((u) => u.wos)).map((w) => `WO: ${w}`)]);
    } else if (report.verdict === "doubt") {
      effects.doubt_file = ctx.paths.unitDoubtFile(review.id);
      await atomicWriteJson(effects.doubt_file, report.doubt, { fs });
    }

    // 4. Review unit, events, state.
    nextReview.review = { verdict: report.verdict, reviewer: asSchemaCell(reviewer), degraded: degradation.degraded, deferred_id: deferredId };
    nextReview.probe_hashes = { ...(review.probe_hashes ?? {}), ...probeHashes };
    nextReview.token_hash = null;
    const finalState = report.verdict === "doubt" ? "reported" : "verified";
    events.push({ type: "unit_state", data: { unit: review.id, from: review.state, to: finalState } });
    nextReview.state = finalState;
    const tip = await git(exec, root, ["rev-parse", "HEAD"]);
    const reviewerCompany = reviewer.runtime;
    events.unshift({
      type: "review_recorded",
      data: {
        unit: review.id, frd: review.frd, kind: review.kind, verdict: report.verdict, reviewer: asSchemaCell(reviewer), authors: authors.map(asSchemaCell),
        cross: authors.length > 0 && authors.every((a) => a.runtime !== reviewerCompany), degraded: degradation.degraded, findings: countFindings(report.findings),
        pair_id: deferredId, deferred_id: deferredId, probe_hashes: nextReview.probe_hashes, probes_committed: probeFiles, reviewed: reviewed.map((u) => u.id),
        ...(degradation.matched ? {} : { off_matrix: true }),
      },
    });
    next.last_safe_point = { sha: tip, kind: "review-record", at };
    events.push({ type: "safe_point", data: { kind: "review-record", sha: tip } });
    for (const event of events) await ctx.appendEvent(event);
    await ctx.writeState(next);
    releaseToken(unitId, { file: ctx.paths.admissionFile, fs: deps.admissionFs });
    return {
      ok: true, cmd: "review-record", verdict: report.verdict, deferred_review_id: deferredId, probes_committed: probeFiles, reviewer: asSchemaCell(reviewer),
      degraded: degradation.degraded, reviewed_units: reviewed.map((u) => u.id), patch_unit: effects.patch_unit, handed_back: effects.handed_back,
      bug_card: bugCard, doubt_file: effects.doubt_file, probes_skipped: skipped, last_safe_point: next.last_safe_point, ...(resultEntry ? { deferred_result: resultEntry.result } : {}),
    };
  };

  return fencedTwoPhase({ project, epoch, actor: deps.actor ?? "cli", deps }, phase1, work, phase2);
}

/**
 * `reopen`: queue (or re-queue, ids carry no attempt suffix) the patch unit `u-patch-<first wo>` with
 * attempt = max attempt of the units it fixes + 1, move the reopened WOs IN_REVIEW -> PLANNED -> IN_PROGRESS on the
 * integration branch (bumping `reopen_count`), commit, and set the fixed units `patching`. When the 3-execution
 * budget is spent the units are handed back instead. Mutates `next`, `events` and `effects`.
 */
async function applyReopen(c) {
  const { next, review, reviewed, report, root, fs, transition, events, effects, setState, deps, ctx } = c;
  const exec = deps.exec ?? defaultExec;
  const workOrders = await scanWorkOrders(root, fs);
  const wanted = pickReopenWos(reviewed, report.findings, workOrders);
  const fixed = reviewed.filter((u) => u.wos.some((w) => wanted.includes(w.toLowerCase())) && REVIEWED_FROM.includes(u.state));
  if (fixed.length === 0) throw err("INVALID_STATE", `review ${review.id} reopens nothing: no reviewed unit owns a reopenable work order`);
  const attempt = Math.max(...fixed.map((u) => u.attempt)) + 1;
  if (attempt > 3) {
    const reason = "presupuesto de 3 ejecuciones agotado; la revisión sigue encontrando fallos";
    await handBackReviewed({ ctx, next, events, review, units: fixed, reason, reasonCode: "budget_exhausted", cause: "code", findings: report.findings, effects, deps });
    next.handbacks_in_a_row = 0;
  } else {
    const wos = wanted.filter((id) => fixed.some((u) => u.wos.some((w) => w.toLowerCase() === id)));
    for (const id of wos) {
      const found = workOrders.find((w) => w.id === id);
      if (!found) throw err("INVALID_STATE", `work order ${id} has no file in the integration worktree`);
      await transition(root, { file: found.rel, to: "PLANNED", reason: `review ${review.id}` });
      await transition(root, { file: found.rel, to: "IN_PROGRESS" });
    }
    const patchId = `u-patch-${wos[0]}`;
    const patch = newUnit({
      id: patchId, kind: "patch", wos: fixed.flatMap((u) => u.wos).filter((w) => wos.includes(w.toLowerCase())), frd: review.frd ?? fixed[0].frd,
      zone: review.zone, risk_rules: [...(review.risk_rules ?? [])], attempt,
    });
    const at = next.units.findIndex((u) => u.id === patchId);
    if (at >= 0) next.units[at] = patch; else next.units.push(patch);
    events.push({ type: "unit_queued", data: patch });
    events.push({ type: "patch", data: { unit: patchId, source_review: review.id, wos: patch.wos, attempt, findings: report.findings, probes: c.kept } });
    for (const u of fixed) setState(u, "patching");
    effects.patch_unit = patchId;
  }
  await stageTrackedChanges(exec, root);
  const touched = unique(fixed.flatMap((u) => u.wos));
  await commitStaged(exec, root, `chore(engine): ${effects.patch_unit ? "reopen" : "hand back"} ${touched.join(", ")} after review ${review.id}`, [`Unit: ${review.id}`, ...touched.map((w) => `WO: ${w}`)]);
}
