// report.mjs: ingest a worker's report for one unit (PLAN 3.9 `report`, RESOLUTIONS D28/D7/D16/D21, PLAN 3.16 A2/A13).
//
// The report is trusted for nothing. Under the two-phase rule (D5): phase 1 verifies the fence and the UNIT token and
// reads the report file; the work (outside the mutex) re-derives the changes of the unit worktree, checks them against
// the write allowlist and the hashed-test set, re-runs G1, and makes the engine's own pathspec-limited commit on the
// UNIT branch (never the integration branch, never `main`); phase 2 writes the state, journals and releases the token.
// A rejected or failed report is never an error to the caller: the offender pays, i.e. the unit is re-queued at
// attempt+1 (or handed back) by the D21 policy in `failure.mjs`.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { releaseToken, verifyToken } from "./admission.mjs";
import { frontmatterList, parseYamlSubset, setCardDocsSha, splitFrontmatter } from "./card.mjs";
import { applyUnitFailure, openUnitDoubt } from "./failure.mjs";
import { loadSchema, sha256Hex, validate } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";
import { bootstrapOwnedUnchanged } from "../../scripts/worktree-sweep.mjs";
import { fencedTwoPhase, findUnit, patchUnit } from "./state.mjs";
import { emitEvent } from "./telemetry.mjs";
import {
  artifactsOf, frontmatterBlock, git, isAllowedPath, isTestSurface, isWorkOrderPath, productPrefix, productRoot, readUnitWorkOrders, runnerOf, unitBase,
} from "./units.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** Unit kinds `report` ingests; review-type kinds go to `review-record`, consults to `doubt answer`. */
export const REPORT_KINDS = Object.freeze(["docs", "tests", "build", "patch"]);

const G1_TIMEOUT_MS = 20 * 60 * 1000;
const TAIL_LINES = 40;
const LIVE_STATES = Object.freeze(["admitted", "running"]);
const COMMIT_TYPE = Object.freeze({ build: "feat", patch: "fix", tests: "test", docs: "docs" });
const SNAPSHOT_RE = /(^|\/)[^/]*-snapshots\//;

// Output signatures that tell an assertion failure (RED as intended) from a broken test (import, syntax, tooling).
const BROKEN_RE = /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Failed to resolve import|Failed to load url|does not provide an export named|SyntaxError|ReferenceError|TSError|error TS\d+|ERR_UNKNOWN_FILE_EXTENSION|ERR_REQUIRE_ESM|No test files found|Transform failed|is not a function/;
const ASSERTION_RE = /AssertionError|expect\(received\)|expect\([^)\n]*\)\.(?:not\.)?to[A-Z]\w*|Expected( value)?:|Received:|AssertionFailedError/;

const oneLine = (text, max = 300) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const lastLines = (text, n = TAIL_LINES) => String(text ?? "").replace(/\s+$/, "").split("\n").slice(-n).join("\n");

/**
 * Failing test ids found in a test runner's output (node:test spec and TAP, vitest, jest). Duration suffixes are
 * stripped so a re-run of the same failure yields the same ids (the D21 evidence hash covers them).
 * @param {string} output combined stdout and stderr
 * @returns {string[]} sorted unique ids
 */
export function failingTests(output) {
  const ids = new Set();
  const add = (raw) => {
    const id = raw.replace(/\s+\(\d[\d.]*m?s\)\s*$/, "").replace(/\s+#\s.*$/, "").trim();
    if (id && !/^failing tests:?$/i.test(id)) ids.add(id);
  };
  for (const line of String(output).split("\n")) {
    const spec = /^\s*[✖✗×]\s+(.+)$/.exec(line);
    if (spec) { add(spec[1]); continue; }
    const tap = /^\s*not ok \d+ - (.+)$/.exec(line);
    if (tap) { add(tap[1]); continue; }
    const fail = /^\s*FAIL\s+(.+)$/.exec(line);
    if (fail) add(fail[1]);
  }
  return [...ids].sort();
}

/**
 * Classify the output of a RED run of new tests (D16): `assertion` (the intended RED), `broken` (import, syntax or
 * tooling error) or `unknown` (a failure with no assertion signature).
 * @param {string} output
 * @returns {"assertion"|"broken"|"unknown"}
 */
export function classifyRed(output) {
  if (BROKEN_RE.test(output)) return "broken";
  return ASSERTION_RE.test(output) ? "assertion" : "unknown";
}

// ---------------------------------------------------------------------------------------------------------------
// Worktree inspection
// ---------------------------------------------------------------------------------------------------------------

/** Parse `git status --porcelain=v1 -z`: `[{path, status: "A"|"M"|"D"}]` with repo-relative posix paths. */
export function parseStatus(out) {
  const parts = String(out).split("\0");
  const changes = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    const file = entry.slice(3);
    if (/[RC]/.test(xy)) {
      const from = parts[i + 1];
      i += 1;
      changes.push({ path: file, status: "A" });
      if (xy.includes("R") && from) changes.push({ path: from, status: "D" });
    } else changes.push({ path: file, status: xy.includes("D") ? "D" : xy === "??" ? "A" : "M" });
  }
  return changes;
}

const normalizeRel = (file) => {
  const posix = String(file).replace(/\\/g, "/");
  if (!posix || posix.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(posix)) return null;
  return path.posix.normalize(posix).replace(/^\.\//, "");
};

async function readFileText(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

/** The violations of the write allowlist, the hashed set and the work-order rules for a set of changes (A2, D28). */
/**
 * BL-0315: with a card scope the planner only plans the work orders whose `source_change` names the card (or that the
 * run scope lists), so a new WO a docs unit creates without it is never built: the run would land the docs and finish.
 */
export function newWoSourceChangeProblem(card, data) {
  if (!card) return null;
  const want = String(card).toLowerCase();
  const listed = frontmatterList(data?.source_change).map((s) => String(s).toLowerCase());
  return listed.includes(want) ? null : `a new work order of a card run must list the card in source_change: [${card}] (otherwise the planner never schedules it)`;
}

async function checkChanges({ unit, artifacts, changes, hashed, root, base, card = null, deps }) {
  const fs = deps.fs ?? fsp;
  const problems = [];
  for (const { rel, status } of changes) {
    if (SNAPSHOT_RE.test(rel)) { problems.push({ path: rel, why: "blessed snapshot baselines are never written by workers" }); continue; }
    if (hashed.has(rel)) { problems.push({ path: rel, why: "hashed test or probe file (the run protects it)" }); continue; }
    if (!isAllowedPath(unit.kind, artifacts, rel)) { problems.push({ path: rel, why: `outside the ${unit.kind} write allowlist` }); continue; }
    if (!isWorkOrderPath(rel)) continue;
    const before = await git(deps, root, ["show", `${base}:./${rel}`], { allowFail: true });
    if (before.code === 0) {
      const after = status === "D" ? null : await readFileText(fs, path.join(root, rel));
      if (after === null || frontmatterBlock(before.stdout) !== frontmatterBlock(after)) problems.push({ path: rel, why: "the frontmatter of an existing work order must never change" });
    } else if (status !== "D") {
      const text = await readFileText(fs, path.join(root, rel));
      const data = parseYamlSubset(splitFrontmatter(text ?? "")?.fm ?? "").data;
      if (data.implementation_status !== "PLANNED") problems.push({ path: rel, why: "a new work order must have implementation_status: PLANNED" });
      const missing = newWoSourceChangeProblem(card, data);
      if (missing) problems.push({ path: rel, why: missing });
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// G1
// ---------------------------------------------------------------------------------------------------------------

/**
 * G1 (D7): `bash .pandacorp/verify.sh --light [--tests=<files>]` in the unit worktree, no e2e.
 * @returns {Promise<{exit: number, tail: string, output: string, command: string, timed_out: boolean}>}
 * @throws FAILCLOSED when the project has no `.pandacorp/verify.sh` (a missing oracle is a RED gate, never a skip)
 */
async function runG1(root, testFiles, deps) {
  const fs = deps.fs ?? fsp;
  if ((await readFileText(fs, path.join(root, ".pandacorp", "verify.sh"))) === null) throw err("FAILCLOSED", `G1 oracle missing: ${path.join(root, ".pandacorp", "verify.sh")}`);
  const args = [".pandacorp/verify.sh", "--light", ...(testFiles.length ? [`--tests=${testFiles.join(",")}`] : [])];
  const res = await runnerOf(deps)("bash", args, { cwd: root, env: deps.env, timeout: deps.g1TimeoutMs ?? G1_TIMEOUT_MS });
  const output = `${res.stdout}\n${res.stderr}`;
  return { exit: res.timedOut ? 124 : res.code, tail: lastLines(output), output, command: `bash ${args.join(" ")}`, timed_out: Boolean(res.timedOut) };
}

const g1Public = (g1) => (g1 ? { exit: g1.exit, tail: g1.tail } : undefined);

/** Tests unit (D16): RED by assertion on the new test files, green on everything else. */
async function checkTestsUnit(root, testFiles, deps) {
  if (!testFiles.length) return { ok: false, why: "a tests unit must add or change test files", g1: null };
  const red = await runG1(root, testFiles, deps);
  if (red.exit === 0) return { ok: false, why: "the new tests pass: tests-first means RED first", g1: red };
  if (red.timed_out) return { ok: false, why: "G1 timed out on the new tests", g1: red };
  const kind = classifyRed(red.output);
  if (kind === "broken") return { ok: false, why: "the new tests fail on an import, syntax or tooling error, not by assertion", g1: red };
  if (kind === "unknown") return { ok: false, why: "the new tests fail without an assertion failure", g1: red };
  const rest = await runG1(root, [], deps);
  if (rest.exit !== 0) return { ok: false, why: "the light gates are red on everything else", g1: rest };
  return { ok: true, g1: red };
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluation (outside the mutex)
// ---------------------------------------------------------------------------------------------------------------

const rejected = (reasons, extra = {}) => ({ kind: "rejected", reasons, evidence: { tests: [], command: null, files: [], ...(extra.evidence ?? {}) }, g1: extra.g1 ?? null, source: extra.source ?? "report_rejected" });

function commitMessage({ unit, report, card }) {
  const scope = /^frd-\d+-([a-z0-9-]+)$/.exec(unit.frd ?? "")?.[1] ?? "build";
  const label = oneLine(report.summary, 72) || unit.id;
  const trailers = [`Unit: ${unit.id}`, ...unit.wos.map((wo) => `WO: ${wo}`), ...(unit.kind === "docs" && card ? [`Change-Docs: ${card}`] : [])];
  return { subject: `${COMMIT_TYPE[unit.kind]}(${scope}): ${label}`, trailers: trailers.join("\n") };
}

/**
 * Idempotent re-ingest: a retry after a crash between the engine's own unit commit and phase 2 finds exactly one commit
 * on the unit branch carrying this unit's `Unit:` trailer, touching exactly the files the report lists, with a clean
 * worktree. That commit was only made after the checks and G1 passed, so phase 2 is completed from it instead of
 * rejecting the (now empty) worktree. Anything else (several commits, another unit's trailer, other files, a dirty
 * worktree) is not an engine commit and stays a rejection.
 * @returns {Promise<{kind: "committed", commit: string, g1: null, test_hashes: object|null, resumed: true}|null>}
 */
async function resumeCommitted({ intent, deps, ahead, dirty }) {
  const { unit, report, root, prefix } = intent;
  if (ahead !== 1 || dirty) return null;
  const trailers = await git(deps, root, ["log", "-1", "--format=%(trailers:key=Unit,valueonly)", "HEAD"]);
  if (trailers.stdout.trim() !== unit.id) return null;
  const shown = await git(deps, root, ["show", "--name-only", "--format=", "HEAD"]);
  const committed = shown.stdout.split("\n").filter((f) => f && f.startsWith(prefix)).map((f) => f.slice(prefix.length)).sort();
  const reported = report.files.map(normalizeRel).sort();
  if (JSON.stringify(committed) !== JSON.stringify(reported) || shown.stdout.split("\n").some((f) => f && !f.startsWith(prefix))) return null;
  const fs = deps.fs ?? fsp;
  const testHashes = {};
  if (unit.kind === "tests") for (const rel of committed.filter(isTestSurface)) testHashes[rel] = sha256Hex(await fs.readFile(path.join(root, rel)));
  const commit = (await git(deps, root, ["rev-parse", "HEAD"])).stdout.trim();
  return { kind: "committed", commit, g1: null, test_hashes: unit.kind === "tests" ? testHashes : null, resumed: true };
}

async function evaluateDone({ intent, deps }) {
  const { unit, report, root, prefix, worktree } = intent;
  const fs = deps.fs ?? fsp;
  const base = await unitBase(root, intent.integrationBranch, deps);
  const ahead = await git(deps, root, ["rev-list", "--count", `${base}..HEAD`]);
  const status = await git(deps, worktree, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (Number(ahead.stdout.trim()) > 0) {
    const resumed = await resumeCommitted({ intent, deps, ahead: Number(ahead.stdout.trim()), dirty: parseStatus(status.stdout).length > 0 });
    return resumed ?? rejected(["the worker committed on the unit branch; only the engine commits"]);
  }
  const changes = [];
  const outside = [];
  // BL-0318: bootstrap-generated wiring (.claude/launch.json, e2e/server-env.json, .env.local), unchanged since the
  // bootstrap wrote it, is not the worker's change even when its skip-worktree bit was lost (it is never committed).
  const bootstrapOwned = (deps.bootstrapOwnedUnchanged ?? bootstrapOwnedUnchanged)(worktree);
  for (const c of parseStatus(status.stdout)) {
    if (c.status === "M" && bootstrapOwned.has(c.path)) continue;
    if (prefix && !c.path.startsWith(prefix)) outside.push(c.path);
    else changes.push({ rel: c.path.slice(prefix.length), status: c.status });
  }
  const reasons = outside.map((p) => `${p}: outside the product root`);
  const reported = new Set();
  for (const f of report.files) {
    const rel = normalizeRel(f);
    if (rel === null) reasons.push(`${f}: not a repository-relative path`); else reported.add(rel);
  }
  const changed = new Set(changes.map((c) => c.rel));
  for (const rel of changed) if (!reported.has(rel)) reasons.push(`${rel}: changed in the worktree but missing from report.files`);
  for (const rel of reported) if (!changed.has(rel)) reasons.push(`${rel}: listed in report.files but not changed in the worktree`);
  if (!changes.length && !reasons.length) reasons.push("nothing to commit: the worktree has no changes");

  const workOrders = unit.kind === "build" || unit.kind === "patch" ? await readUnitWorkOrders(root, unit.wos, { ...deps, ref: base }) : [];
  const problems = await checkChanges({ unit, artifacts: artifactsOf(workOrders), changes, hashed: intent.hashed, root, base, card: intent.card, deps });
  for (const p of problems) reasons.push(`${p.path}: ${p.why}`);
  const evidenceFiles = [...new Set([...problems.map((p) => p.path), ...(reasons.length ? changed : [])])];
  if (reasons.length) return rejected(reasons, { evidence: { files: evidenceFiles } });

  const live = changes.filter((c) => c.status !== "D").map((c) => c.rel);
  const testFiles = live.filter(isTestSurface);
  let g1;
  if (unit.kind === "tests") {
    const verdict = await checkTestsUnit(root, testFiles, deps);
    g1 = verdict.g1;
    if (!verdict.ok) return rejected([verdict.why], { g1, source: "g1_red", evidence: { tests: g1 ? failingTests(g1.output) : [], command: g1?.command ?? null, files: [...changed] } });
  } else {
    g1 = await runG1(root, testFiles, deps);
    if (g1.exit !== 0) return rejected([`G1 red (exit ${g1.exit})`], { g1, source: "g1_red", evidence: { tests: failingTests(g1.output), command: g1.command, files: [...changed] } });
  }

  const testHashes = {};
  if (unit.kind === "tests") for (const rel of testFiles) testHashes[rel] = sha256Hex(await fs.readFile(path.join(root, rel)));

  const files = [...changed].sort().map((rel) => `${prefix}${rel}`);
  const { subject, trailers } = commitMessage({ unit, report, card: intent.card });
  await git(deps, worktree, ["--literal-pathspecs", "add", "-A", "--", ...files]);
  await git(deps, worktree, ["--literal-pathspecs", "-c", "commit.gpgsign=false", "commit", "--quiet", "--no-verify", "-m", subject, "-m", trailers, "--", ...files]);
  const commit = (await git(deps, worktree, ["rev-parse", "HEAD"])).stdout.trim();
  return { kind: "committed", commit, g1, test_hashes: unit.kind === "tests" ? testHashes : null };
}

// ---------------------------------------------------------------------------------------------------------------
// Diff gate (CLI 3.9 `gate`, D28): S8 or deploy reasons on the committed diff need the owner's OK
// ---------------------------------------------------------------------------------------------------------------

const DEPLOY_RE = /\b(vercel|wrangler|fly|netlify)\s+(deploy|publish)\b/;
const GATE_FAILCLOSED_DETAIL = "el clasificador no pudo revisar el diff";

/**
 * After G1 and the unit commit: classify `<unit base>..<commit>` (`risk.computeRisk`, `deps.computeRisk` overrides it) and
 * turn an S8 hit into a `waiting_gate` verdict (`external` for a deploy command, else `delete`). A classifier that cannot
 * run fails closed toward the human (`delete`), never commits through. The commit stays on the unit branch.
 * @returns {Promise<object>} the `committed` verdict unchanged, or `{kind: "waiting_gate", gate: {kind, detail, source: "diff"}, commit}`
 */
async function diffGate({ intent, verdict, deps }) {
  const { unit, root } = intent;
  const base = await unitBase(root, intent.integrationBranch, deps);
  const compute = deps.computeRisk ?? (await import("./risk.mjs")).computeRisk;
  const risk = await compute({ root, range: `${base}..${verdict.commit}` }, { ...(deps.riskDeps ?? {}), ...(deps.exec && !deps.riskDeps ? { exec: deps.exec } : {}) });
  const gated = (kind, detail) => ({ kind: "waiting_gate", gate: { kind, detail: oneLine(detail, 300), source: "diff" }, commit: verdict.commit });
  if (risk.failclosed) return gated("delete", GATE_FAILCLOSED_DETAIL);
  const hits = (risk.signals?.classify ?? []).filter((h) => h.signal === "S8");
  if (!hits.length) return verdict;
  const detail = hits.map((h) => h.detail).join("; ") || `${unit.id}: operación irreversible en el diff`;
  return gated(hits.some((h) => DEPLOY_RE.test(h.detail)) ? "external" : "delete", detail);
}

async function evaluate({ intent, deps }) {
  const { unit, report, problems } = intent;
  if (problems.length) return rejected(problems);
  if (report.unit !== unit.id) return rejected([`report.unit ${report.unit} is not the reported unit ${unit.id}`]);
  if (report.token !== intent.token) return rejected(["report.token differs from the token of the command"]);
  if (report.gate) return { kind: "waiting_gate", gate: report.gate };
  if (report.status === "doubt") {
    return report.doubt ? { kind: "doubt" } : rejected(["status doubt without a doubt object"]);
  }
  if (report.status === "blocked") return { kind: "blocked" };
  if (report.status === "failed") return { kind: "failed" };
  const verdict = await evaluateDone({ intent, deps });
  return verdict.kind === "committed" && !intent.gateApproved ? diffGate({ intent, verdict, deps }) : verdict;
}

// ---------------------------------------------------------------------------------------------------------------
// Phase 1
// ---------------------------------------------------------------------------------------------------------------

async function readReportFile(fs, file) {
  let raw;
  try { raw = await fs.readFile(file, "utf8"); } catch (e) { return { report: null, problems: [`report file unreadable: ${e.code ?? e.message}`] }; }
  let report;
  try { report = JSON.parse(raw); } catch (e) { return { report: null, problems: [`report file is not JSON: ${oneLine(e.message, 120)}`] }; }
  const result = validate(await loadSchema("report", { fs }), report);
  if (!result.ok) return { report: null, problems: result.errors.slice(0, 5).map((e) => `report schema: ${e.path || "/"} ${e.message}`) };
  return { report, problems: [] };
}

async function phase1({ ctx, input, deps }) {
  const fs = deps.fs ?? fsp;
  const state = await ctx.readState();
  if (!state) throw err("INVALID_STATE", "no build state: nothing to report on", { hint: "rebuild-state" });
  const unit = findUnit(state, input.unit);
  if (!unit) throw err("INVALID_STATE", `unknown unit ${input.unit}`);
  if (!REPORT_KINDS.includes(unit.kind)) throw err("INVALID_INPUT", `unit ${unit.id} is a ${unit.kind} unit: ${unit.kind === "doubt-consult" ? "doubt answer" : "review-record"} files its result`);
  if (!LIVE_STATES.includes(unit.state)) throw err("INVALID_STATE", `unit ${unit.id} is ${unit.state}: it accepts no report`);
  if (typeof input.token !== "string" || !input.token) throw err("INVALID_INPUT", "report needs the unit token (--token)");
  const verified = verifyToken(unit.id, input.token, { file: ctx.paths.admissionFile });
  if (!verified.ok || (unit.token_hash && unit.token_hash !== verified.token_hash)) throw err("INVALID_INPUT", `the unit token was rejected for ${unit.id}`);
  if (!unit.worktree) throw err("INVALID_STATE", `unit ${unit.id} has no worktree`);

  const hashed = new Set();
  for (const u of state.units) for (const f of [...Object.keys(u.test_hashes ?? {}), ...Object.keys(u.probe_hashes ?? {})]) hashed.add(f);
  const prefix = await productPrefix(input.project, deps);
  const { report, problems } = await readReportFile(fs, path.resolve(input.project, input.file));
  return {
    unit, report, problems, hashed, prefix, token: input.token, worktree: unit.worktree, root: productRoot(unit.worktree, prefix),
    integrationBranch: state.integration.branch, card: state.scope?.card ?? null, from: unit.state,
    gateApproved: state.answers?.[`g-${unit.id}`] === true,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Phase 2
// ---------------------------------------------------------------------------------------------------------------

const FAIL_SOURCE = Object.freeze({ failed: "report_failed", blocked: "report_failed" });

async function applyFailure({ ctx, intent, verdict, deps, base }) {
  const { unit, report } = intent;
  const source = verdict.source ?? FAIL_SOURCE[verdict.kind] ?? "report_rejected";
  const evidence = verdict.kind === "rejected" ? verdict.evidence : { tests: [], command: null, files: report?.files ?? [] };
  const reasons = verdict.kind === "rejected" ? verdict.reasons : [oneLine(report?.summary, 200) || verdict.kind];
  const diagnosis = report?.diagnosis ?? null;
  const res = await applyUnitFailure(ctx, {
    unitId: unit.id, attempt: unit.attempt, source, diagnosis, evidence, reasons, outcome: verdict.kind,
    failure: { command: evidence.command ?? verdict.g1?.command ?? null, tail: verdict.g1?.tail ?? "" },
    override: verdict.kind === "blocked" ? "worker_blocked" : null,
    receivedEvent: { type: "report_received", data: { unit: unit.id, outcome: verdict.kind, commit: null } },
  }, deps);
  if (!res.applied) throw err("INVALID_STATE", `unit ${unit.id} changed while its report was checked`, { hint: "rebuild-state" });
  return {
    ...base, outcome: verdict.kind, reasons, action: res.action, next_attempt: res.next_attempt, ...(verdict.g1 ? { g1: g1Public(verdict.g1) } : {}),
    ...(res.action === "doubt" || res.action === "dispute" ? { doubt: report?.doubt ?? null } : {}), ...(res.handback ? { handback: res.handback } : {}),
  };
}

async function applyVerdict({ ctx, intent, verdict, deps }) {
  const { unit } = intent;
  const state = await ctx.readState();
  const cur = findUnit(state, unit.id);
  if (!cur || !LIVE_STATES.includes(cur.state)) throw err("INVALID_STATE", `unit ${unit.id} changed while its report was checked`, { hint: "rebuild-state" });
  const base = { ok: true, cmd: "report", unit: unit.id, attempt: unit.attempt };
  const stateEvent = (to) => ({ type: "unit_state", data: { unit: unit.id, from: intent.from, to } });
  const warnings = [];
  let result;
  let legacy = [];

  if (verdict.kind === "committed") {
    const hashes = verdict.test_hashes ?? undefined;
    await ctx.writeState(patchUnit(state, unit.id, { state: "committed", token_hash: null, ...(hashes ? { test_hashes: hashes } : {}) }));
    await ctx.appendEvent({ type: "report_received", data: { unit: unit.id, outcome: "committed", commit: verdict.commit, ...(hashes ? { test_hashes: hashes } : {}) } });
    await ctx.appendEvent({ type: "wo_committed", data: { unit: unit.id, wos: unit.wos, frd: unit.frd, commit: verdict.commit } });
    await ctx.appendEvent(stateEvent("committed"));
    if (unit.kind === "docs" && intent.card) {
      try { await setCardDocsSha(ctx.project, intent.card, verdict.commit, deps); } catch (e) { warnings.push(`docs_sha not written to card ${intent.card}: ${oneLine(e.message, 160)}`); }
    }
    legacy = unit.wos.map((wo) => ({ name: "wo_commit", data: { frd: unit.frd, wo, unit: unit.id, state: "committed" } }));
    result = { ...base, outcome: "committed", commit: verdict.commit, ...(verdict.g1 ? { g1: { ...g1Public(verdict.g1), ...(unit.kind === "tests" ? { expected_red: true } : {}) } } : {}), ...(verdict.resumed ? { resumed: true } : {}), next_attempt: null, ...(hashes ? { test_hashes: hashes } : {}) };
  } else if (verdict.kind === "doubt") {
    await ctx.writeState(patchUnit(state, unit.id, { state: "reported", token_hash: null }));
    await ctx.appendEvent({ type: "report_received", data: { unit: unit.id, outcome: "doubt", commit: null } });
    await ctx.appendEvent(stateEvent("reported"));
    result = { ...base, outcome: "doubt", doubt: intent.report.doubt, next_attempt: null };
  } else if (verdict.kind === "waiting_gate") {
    const { kind, detail } = verdict.gate;
    // A diff gate keeps the unit commit on the unit branch (never reset); the resumed report completes phase 2 from it.
    await ctx.writeState(patchUnit(state, unit.id, { state: "waiting_gate", waiting_gate: kind, token_hash: null }));
    await ctx.appendEvent({ type: "report_received", data: { unit: unit.id, outcome: "waiting_gate", commit: null } });
    await ctx.appendEvent({ type: "waiting_gate", data: { unit: unit.id, kind, detail, question: `g-${unit.id}` } });
    await ctx.appendEvent(stateEvent("waiting_gate"));
    legacy = [{ name: "WaitingGate", data: { unit: unit.id, kind, detail, question: `g-${unit.id}` } }];
    result = { ...base, outcome: "waiting_gate", gate: verdict.gate, ...(verdict.commit ? { commit: verdict.commit } : {}), question: `g-${unit.id}`, next_attempt: null };
  } else {
    result = await applyFailure({ ctx, intent, verdict, deps, base });
  }
  releaseToken(unit.id, { file: ctx.paths.admissionFile });
  return { ...result, ...(warnings.length ? { warnings } : {}), _emit: { runtime: ctx.lease.runtime, runId: ctx.runId, events: legacy } };
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------------

/**
 * The `report` command: ingest the report file a worker wrote for one unit (fenced, two-phase, G1).
 *
 * Outcomes: `committed` (own pathspec-limited commit on the unit branch, trailers `Unit:`/`WO:`, never `Change:`),
 * `rejected` (checks or G1 failed), `failed` / `blocked` (the worker said so), `doubt` (unit `reported`, no attempt
 * consumed), `waiting_gate` (a non-null `gate`). A rejected, failed or blocked report is routed through the D21 policy:
 * the same unit is re-queued at attempt+1 (`next_attempt`; attempt 3 automatically when attempt 2 carries a diagnosis
 * and NEW evidence), or handed back (`handback`, `next_attempt: null`) which blocks the unit and its dependents.
 *
 * `input.openDoubt: true` (what `next` passes for a worker that cannot run `doubt open` itself, i.e. every Codex worker under drive) also
 * OPENS the doubt after the report settled: see {@link openDoubtOfResult}. Without it the unit stays `reported` and the caller runs `doubt open`.
 *
 * @param {{project: string, epoch: number, unit: string, token?: string, file: string, actor?: "cli"|"drive", openDoubt?: boolean}} input
 * @param {{fs?: object, env?: object, exec?: Function, buildState?: object, homedir?: string, clock?: Function,
 *   g1TimeoutMs?: number}} [deps]
 * @returns {Promise<{ok: true, cmd: "report", unit: string, attempt: number, outcome: string, commit?: string,
 *   g1?: {exit: number, tail: string}, test_hashes?: object, next_attempt: number|null, reasons?: string[],
 *   handback?: object, doubt?: object, doubt_opened?: object, gate?: object, warnings?: string[]}>}
 * @throws FENCE/QUIESCED (exit 3); INVALID_INPUT when the token is missing or wrong, or the unit kind is not reportable;
 *   INVALID_STATE for an unknown unit or one that accepts no report; FAILCLOSED when the G1 oracle is missing
 */
export async function ingestReport(input, deps = {}) {
  const { project, epoch } = input ?? {};
  if (typeof project !== "string" || !project) throw err("USAGE", "report: project is required");
  if (!Number.isInteger(Number(epoch))) throw err("USAGE", "report: epoch is required");
  if (typeof input.unit !== "string" || !input.unit) throw err("USAGE", "report: unit is required");
  if (typeof input.file !== "string" || !input.file) throw err("USAGE", "report: file is required");
  buildPaths(project, deps).unitDir(input.unit);

  const out = await fencedTwoPhase(
    { project, epoch: Number(epoch), actor: input.actor ?? "cli", deps },
    (ctx) => phase1({ ctx, input, deps }),
    (intent) => evaluate({ intent, deps }),
    (verdict, intent, ctx) => applyVerdict({ ctx, intent, verdict, deps }),
  );
  const { _emit: emit, ...result } = out;
  for (const event of emit.events) {
    const sent = await emitEvent(project, { runtime: emit.runtime, runId: emit.runId, name: event.name, data: event.data }, deps);
    if (!sent.ok) result.warnings = [...(result.warnings ?? []), `event ${event.name} not emitted: ${sent.error}`];
  }
  if (input.openDoubt === true) return openDoubtOfResult({ project, epoch: Number(epoch), input, result }, deps);
  return result;
}

/**
 * Close the gap between a `doubt` outcome and an opened doubt (B2). A `doubt` report, or a failed/rejected report whose policy
 * action is `doubt`/`dispute`, leaves the unit `reported` with no doubt record; a worker that cannot run `doubt open` itself (a Codex
 * worker, i.e. everything under drive) needs the engine to do it. Runs after the report's own phase 2, outside its mutex section.
 * Result gains `doubt_opened` (the `doubt open` output: `doubt_id`, `step`, `consult`, `parked`, `notice_es`), or, when the doubt cannot be
 * opened, `action: "handback"` + `handback` (the unit and its dependents end `blocked`; a unit is never left `reported`).
 */
async function openDoubtOfResult({ project, epoch, input, result }, deps) {
  const viaDoubt = result.outcome === "doubt";
  const viaPolicy = result.action === "doubt" || result.action === "dispute";
  if (!viaDoubt && !viaPolicy) return result;
  const diagnosis = viaPolicy ? await diagnosisOf(input.file, deps) : null;
  const opened = await openUnitDoubt({ project, epoch, unit: input.unit, doubt: result.doubt ?? null, diagnosis, actor: input.actor }, deps);
  return opened.opened ? { ...result, doubt_opened: opened } : { ...result, action: "handback", next_attempt: null, handback: opened.handback };
}

async function diagnosisOf(file, deps) {
  try {
    const diagnosis = JSON.parse(await (deps.fs ?? fsp).readFile(file, "utf8"))?.diagnosis;
    return diagnosis && typeof diagnosis === "object" ? diagnosis : null;
  } catch { return null; }
}

/** Alias of {@link ingestReport} under the name the CLI dispatcher and the tests use. */
export const report = ingestReport;

/** `next` calls its sibling as `report.ingest({project, epoch, actor, unit, token, file, via})`. */
export const ingest = ingestReport;
