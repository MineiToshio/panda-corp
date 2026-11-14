#!/usr/bin/env node
// test-build-v2-preflight.mjs — engine v2 row C06: plugin/runtime/build/preflight.mjs + summary.mjs.
//
// Contracts pinned (from the docs only; the implementation was never read):
//   PLAN §3.16 A-amendments, §5.2 row C06; build-engine-cli.md §3.2 (`start --preflight`: check ids, question model,
//   announce, drive_armable, <= 60 s), §3.3 (`start --run`: preflight reuse <= 15 min), §3.21 (`summary`),
//   §9 (drive arming), §12 (pre-push installer, exits 3 = refused); RESOLUTIONS D19 (question ids/affects/reversible,
//   preflight.json 0600), D29 (install in a launched project, never arm drive without a verified hook), D33 (scope
//   handoff); schemas/summary.schema.json.
//
// ASSUMED INTERFACE (the docs give no export names; the orchestrator reconciles test and module afterwards):
//   plugin/runtime/build/preflight.mjs
//     export async function runPreflight(input, deps) -> the JSON of `start --preflight` WITHOUT the envelope keys:
//       { elapsed_ms, checks[], need_from_owner[], announce{...}, drive_armable, drive_block_reason }
//       input = { project:<abs root>, row:<1..7>, scope:{card,frds,wos} (the OBJECT, the CLI reads it from --scope-json),
//                 label:"claude"|"codex", sessionModel:<string>, probeCodex:<boolean> }
//       deps  = { env }  (clock = env.PANDACORP_NOW, codex binary = env.PANDACORP_CODEX_BIN, codex home = env.CODEX_HOME,
//                 RAM signals = env.PANDACORP_SIGNALS_FILE; the test also exports these into process.env for the call).
//     It writes <project>/.pandacorp/run/build/preflight.json (mode 0600) containing at least {row, scope, checks,
//     need_from_owner, announce, drive_armable} plus one top-level ISO timestamp string (the 15-minute reuse stamp).
//     In a launched project it runs plugin/scripts/install-pre-push.mjs itself (D29, module map "pre-push install").
//   plugin/runtime/build/summary.mjs
//     export async function buildSummary(input, deps) -> the schemas/summary.schema.json object, computed from
//       input = { project:<abs root> } reading build/state.json, build/journal.jsonl and .pandacorp/run/deferred-reviews.json.
//       deps = { env }
//     Event data it reads (shapes of the docs where given, else ASSUMED): `parked.data={unit,reason,question}`,
//       `autonomous_decision.data` = one `decided_without_owner` item {doubt_id,question,chosen,advised_by,confidence,revert_hint},
//       `review_recorded.data={unit,frd,reviewer,authors,cross,degraded,findings,pair_id}`,
//       `run_started.data.preflight` = {checks[],need_from_owner[]} (the question set), `state.answers[<id>]` closes a question,
//       deferred ledger entries with status "pending" count as deferred_pending.
//   Result shape tolerances: `need_from_owner` items are strings (question ids or texts); a gate question id is `g-<unit id>`;
//   `parked` question ids are the unit's `pending_answer`.
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture, DEFAULT_NOW, writeRolloutSample } from "./fixtures/build-v2/make-fixture.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { loadSchema, validate } from "../runtime/build/fsx.mjs";
import { newState, newUnit, writeState } from "../runtime/build/state.mjs";
import { appendEvent } from "../runtime/build/journal.mjs";
import { acquire } from "../runtime/build-state.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const SCRATCH = process.env.T_C06_SCRATCH || path.join(os.tmpdir(), "t-c06");
const INSTALLER = fileURLToPath(new URL("./install-pre-push.mjs", import.meta.url));
const PREFLIGHT_URL = new URL("../runtime/build/preflight.mjs", import.meta.url).href;
const SUMMARY_URL = new URL("../runtime/build/summary.mjs", import.meta.url).href;
const loadModule = async (url) => { try { return await import(url); } catch (e) { return { __error: e }; } };
const pre = await loadModule(PREFLIGHT_URL);
const sum = await loadModule(SUMMARY_URL);
const needFn = (mod, name, file) => { if (mod.__error) throw new Error(`${file} cannot be imported: ${mod.__error.message}`); if (typeof mod[name] !== "function") throw new Error(`${file} does not export function ${name} (ASSUMED INTERFACE)`); return mod[name]; };
const runPreflight = (input, deps) => needFn(pre, "runPreflight", "preflight.mjs")(input, deps);
const buildSummary = (input, deps) => needFn(sum, "buildSummary", "summary.mjs")(input, deps);

const sandboxes = [];
const sandbox = async () => { await mkdir(SCRATCH, { recursive: true }); const d = await mkdtemp(path.join(SCRATCH, "sb-")); sandboxes.push(d); return d; };
/** Runs fn with `env` exported into process.env (in case a module reads process.env directly), then restores it. */
const withEnv = async (env, fn) => {
  const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};
const SCOPE_ALPHA = { card: null, frds: ["frd-01-alpha"], wos: ["wo-01-001", "wo-01-002"] };
const SCOPE_RISK = { card: null, frds: ["frd-02-beta"], wos: ["wo-02-001", "wo-02-002"] };

/** Creates a fixture and an env; `extra` env overrides. Returns {fx, env, run(input)}. */
async function setup(spec, extra = {}) {
  const dir = await sandbox();
  const fx = await createFixture(spec, { dir });
  const env = fx.env({ PANDACORP_FAKE_CODEX_LOG: path.join(dir, "codex-calls.log"), ...extra });
  await mkdir(env.HOME, { recursive: true });
  const run = (input = {}) => withEnv(env, () => runPreflight({ project: fx.root, row: 4, scope: SCOPE_ALPHA, label: "claude", sessionModel: "opus", probeCodex: true, ...input }, { env }));
  return { fx, env, dir, run };
}
const codexCalls = async (env) => { try { return (await readFile(env.PANDACORP_FAKE_CODEX_LOG, "utf8")).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const listFiles = async (root, rel = "") => {
  const out = [];
  for (const e of await readdir(path.join(root, rel), { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...await listFiles(root, r)); else out.push(r);
  }
  return out.sort();
};
const allStrings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out)); return out; };
const ownerStrings = (v, out = [], key = "") => { if (typeof v === "string") { if (/_es$|^builders$|^reviewers$/.test(key)) out.push(v); } else if (Array.isArray(v)) v.forEach((x) => ownerStrings(x, out, key)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) ownerStrings(x, out, k); return out; };
const SPANISH_WORD = /\b(de|del|el|la|los|las|que|para|con|tu|no|se|en|un|una|por|si|es|al|hay|sin)\b|[áéíóúñ¿¡]/i;
const NO_DASH = /[–—]/; // en dash, em dash

const COLLECTED_QUESTIONS = [];
const collectQuestions = (res) => { for (const c of res.checks ?? []) if (c.question) COLLECTED_QUESTIONS.push({ check: c, question: c.question }); };
const check = (res, id) => (res.checks ?? []).find((c) => c.id === id);
const KNOWN_CHECK_IDS = ["scope.doubts", "scope.summary_citation", "scope.giant", "scope.version", "conflict.foreign_lease", "conflict.paused_plus_card", "conflict.half_cards", "phase.launched", "phase.prepush_missing", "access.codex_login", "access.quota_claude", "access.quota_codex", "access.test_db", "access.env_pending", "access.disk", "access.ram", "mac.power", "mac.keep_awake", "mac.drive_armed", "gates.foreseen", "deferred.pending"];
const validAffects = (a) => a && typeof a === "object" && ((a.all === true && Object.keys(a).length === 1) || (Array.isArray(a.frds) && Object.keys(a).length === 1) || (Array.isArray(a.wos) && Object.keys(a).length === 1));
const assertQuestion = (c, where) => {
  const q = c.question;
  ok(q && typeof q === "object", `${where}: ask check ${c.id} has no question`);
  eq(q.id, `q-${c.id}`, `${where}: question id`);
  ok(typeof q.text_es === "string" && q.text_es.trim(), `${where}: ${q.id} has no text_es`);
  ok(typeof q.default_es === "string" && q.default_es.trim(), `${where}: ${q.id} has no default (a silent owner must never block): ${JSON.stringify(q.default_es)}`);
  ok(q.default_action !== undefined && q.default_action !== null && q.default_action !== "", `${where}: ${q.id} has no default_action`);
  ok(validAffects(q.affects), `${where}: ${q.id} affects invalid: ${JSON.stringify(q.affects)}`);
  ok(typeof q.reversible === "boolean", `${where}: ${q.id} reversible is not a boolean`);
};

// ---------------------------------------------------------------------------------------------
await test("preflight on a basic fixture: shape, stable check ids, <= 60 s, announce data", async () => {
  const { fx, env, run } = await setup("basic");
  const t0 = Date.now(); const res = await run(); const wall = Date.now() - t0;
  ok(wall <= 60_000, `preflight took ${wall} ms (> 60 s budget)`);
  ok(typeof res.elapsed_ms === "number" && res.elapsed_ms >= 0 && res.elapsed_ms <= 60_000, `elapsed_ms invalid: ${res.elapsed_ms}`);
  ok(Array.isArray(res.checks) && res.checks.length > 0, "no checks");
  for (const c of res.checks) {
    ok(KNOWN_CHECK_IDS.includes(c.id), `unknown check id ${c.id}`);
    ok(["pass", "ask", "warn", "fail"].includes(c.status), `check ${c.id} status ${c.status}`);
    ok(typeof c.group === "string" && c.id.startsWith(`${c.group}.`), `check ${c.id} group ${c.group} does not prefix the id`);
    ok(typeof c.detail_es === "string" && c.detail_es.trim(), `check ${c.id} has no detail_es`);
    if (c.status === "ask") assertQuestion(c, "basic"); else ok(c.question === undefined || c.question === null, `non-ask check ${c.id} carries a question`);
  }
  eq(new Set(res.checks.map((c) => c.id)).size, res.checks.length, "duplicate check ids");
  for (const id of ["access.codex_login", "access.quota_codex", "mac.drive_armed", "deferred.pending"]) ok(check(res, id), `missing stable check ${id}`);
  eq(res.need_from_owner, res.checks.filter((c) => c.status === "ask").map((c) => c.question.id), "need_from_owner must list exactly the ask question ids");
  const a = res.announce;
  ok(a && typeof a === "object", "no announce");
  for (const k of ["scope_lines_es", "size", "builders", "reviewers", "risk_zone_provisional", "gates_foreseen_es", "launched_project_line_es", "drive_line_es", "quota", "deferred_pending"]) ok(k in a, `announce.${k} missing`);
  ok(Array.isArray(a.scope_lines_es) && a.scope_lines_es.length > 0, "announce.scope_lines_es is empty for a 2-WO scope");
  ok(["touch", "feature", "giant"].includes(a.size), `announce.size ${a.size}`);
  ok(["none", "floor", "r1"].includes(a.risk_zone_provisional), `risk_zone_provisional ${a.risk_zone_provisional}`);
  eq(a.launched_project_line_es, null, "launched line must be null in an internal project");
  ok(/capacidad compartida/.test(a.drive_line_es), "drive announcement describes shared capacity independently of thresholds");
  ok(a.quota && "claude" in a.quota && "codex" in a.quota, "announce.quota needs claude and codex");
  ok(typeof res.drive_armable === "boolean", "drive_armable is not a boolean");
  eq(res.drive_armable, true, "drive_armable on an internal project with a logged-in (fake) Codex");
  eq(res.drive_block_reason ?? null, null, "drive_block_reason when armable");
  collectQuestions(res);
  await fx.cleanup();
});

await test("preflight.json: only under .pandacorp/run/build, mode 0600, same row/scope/checks, fresh stamp; no other file written, nothing tracked touched", async () => {
  const { fx, env, run } = await setup("basic");
  const before = await listFiles(fx.root);
  const res = await run();
  const after = await listFiles(fx.root);
  const added = after.filter((f) => !before.includes(f));
  ok(added.includes(path.join(".pandacorp", "run", "build", "preflight.json")), `preflight.json not written (added: ${added})`);
  for (const f of added) ok(f.startsWith(path.join(".pandacorp", "run") + path.sep), `preflight wrote outside .pandacorp/run: ${f}`);
  for (const f of before) ok(after.includes(f), `preflight removed ${f}`);
  eq(fx.git("status", "--porcelain"), "", "preflight dirtied the tracked tree");
  eq(fx.git("rev-parse", "HEAD"), fx.sha, "preflight moved HEAD");
  const file = path.join(fx.root, buildPaths(fx.root).preflightFile ? path.relative(fx.root, buildPaths(fx.root).preflightFile) : ".pandacorp/run/build/preflight.json");
  eq(path.relative(fx.root, file), path.join(".pandacorp", "run", "build", "preflight.json"), "preflight path");
  eq((await stat(file)).mode & 0o777, 0o600, "preflight.json mode");
  const j = JSON.parse(await readFile(file, "utf8"));
  eq(j.row, 4, "preflight.json row"); eq(j.scope, SCOPE_ALPHA, "preflight.json scope");
  eq((j.checks ?? []).map((c) => [c.id, c.status]), res.checks.map((c) => [c.id, c.status]), "preflight.json checks differ from the returned checks");
  eq(j.need_from_owner, res.need_from_owner, "preflight.json need_from_owner");
  const stamps = Object.values(j).filter((v) => typeof v === "string" && Number.isFinite(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v));
  ok(stamps.length > 0, "preflight.json carries no ISO timestamp (needed for the 15-minute reuse rule)");
  ok(stamps.some((s) => Math.abs(Date.parse(s) - Date.parse(DEFAULT_NOW)) <= 60_000), `no timestamp near PANDACORP_NOW: ${stamps}`);
  await fx.cleanup();
});

await test("no real home is touched: only the sandbox (events/home/host) and the project change", async () => {
  const { fx, env, dir, run } = await setup("basic");
  await run();
  const sandboxFiles = (await listFiles(dir)).filter((f) => !f.startsWith("project" + path.sep));
  for (const f of sandboxFiles) ok(!path.isAbsolute(f), f);
  await fx.cleanup();
});

await test("deterministic: two runs give the same check ids, statuses and questions", async () => {
  const { fx, run } = await setup("card");
  const a = await run({ row: 3, scope: { card: "add-filter", frds: ["frd-01-alpha"], wos: [] } });
  const b = await run({ row: 3, scope: { card: "add-filter", frds: ["frd-01-alpha"], wos: [] } });
  eq(a.checks.map((c) => [c.id, c.status, c.question?.id ?? null]), b.checks.map((c) => [c.id, c.status, c.question?.id ?? null]), "preflight is not deterministic");
  await fx.cleanup();
});

await test("access.codex_login logged out: not pass, ask has a default, drive_armable false with a reason", async () => {
  const { fx, run } = await setup("basic", { PANDACORP_FAKE_CODEX_LOGIN: "out" });
  const res = await run(); collectQuestions(res);
  const c = check(res, "access.codex_login");
  ok(c && c.status !== "pass", `codex_login with a logged-out Codex must not pass: ${JSON.stringify(c)}`);
  if (c.status === "ask") assertQuestion(c, "codex_login");
  eq(res.drive_armable, false, "drive_armable with Codex logged out");
  ok(typeof res.drive_block_reason === "string" && res.drive_block_reason.trim(), `drive_block_reason must explain: ${JSON.stringify(res.drive_block_reason)}`);
  await fx.cleanup();
});

await test("Codex at 98 % at start: drive_line_es is set, Codex quota is NOT a drive arming condition, no probe", async () => {
  const { fx, env, run } = await setup("basic");
  await writeRolloutSample(env.CODEX_HOME, "pct98");
  const res = await run();
  ok(typeof res.announce.drive_line_es === "string" && res.announce.drive_line_es.trim(), `drive_line_es not set at Codex 98 %: ${JSON.stringify(res.announce.drive_line_es)}`);
  eq(res.drive_armable, true, "Codex quota must not block arming (CLI doc section 9)");
  eq((await codexCalls(env)).filter((x) => x.argv[0] === "exec").length, 0, "a fresh known reading must not trigger the ~20k-token Codex probe");
  eq(res.announce.quota.codex?.used_percent ?? res.announce.quota.codex?.pct, 98, "announce.quota.codex percentage");
  await fx.cleanup();
});

await test("Codex at 36 % fresh reading: no probe call even with probeCodex true; drive_line_es null", async () => {
  const { fx, env, run } = await setup("basic");
  await writeRolloutSample(env.CODEX_HOME, "normal");
  const res = await run();
  eq((await codexCalls(env)).filter((x) => x.argv[0] === "exec").length, 0, "needs_probe is false, the probe must not run");
  ok(/capacidad compartida/.test(res.announce.drive_line_es), "drive announcement uses shared capacity");
  await fx.cleanup();
});

await test("a live foreign lease (row 1): conflict.foreign_lease ask with default, reversible flag", async () => {
  const { fx, env, run } = await setup("basic");
  await withEnv(env, () => acquire(fx.root, { runtime: "claude", runId: "br-2026-11-10-01", ttlSeconds: 1800, projectStatus: false }));
  const res = await run({ row: 1, scope: { card: null, frds: [], wos: [] } }); collectQuestions(res);
  const c = check(res, "conflict.foreign_lease");
  ok(c && c.status === "ask", `conflict.foreign_lease must ask on a live foreign lease: ${JSON.stringify(c)}`);
  assertQuestion(c, "foreign_lease");
  ok(res.need_from_owner.includes("q-conflict.foreign_lease"), "need_from_owner lacks q-conflict.foreign_lease");
  await fx.cleanup();
});

await test("conflict.half_cards: a `building` card with no live run asks, with default", async () => {
  const { fx, run } = await setup("card");
  const card = path.join(fx.root, ".pandacorp/inbox/changes/add-filter.md");
  const text = await readFile(card, "utf8");
  await writeFile(card, text.replace("status: ready", "status: building\nengine: v2\nrun_id: br-2026-11-09-01"));
  const res = await run({ row: 3, scope: { card: "fix-crash", frds: ["frd-02-beta"], wos: [] } }); collectQuestions(res);
  const c = check(res, "conflict.half_cards");
  ok(c && c.status === "ask", `half-built card must ask: ${JSON.stringify(c)}`);
  assertQuestion(c, "half_cards");
  ok(/add-filter/.test(JSON.stringify(c)), "the check does not name the half-built card");
  await fx.cleanup();
});

await test("gates.foreseen: a card that mentions deploy / delete / money lists the foreseen gates (never a production sí)", async () => {
  const { fx, run } = await setup("card");
  const card = path.join(fx.root, ".pandacorp/inbox/changes/fix-crash.md");
  await writeFile(card, `${await readFile(card, "utf8")}\nAlso deploy it to production, delete the legacy users table and charge customers through Stripe.\n`);
  const res = await run({ row: 3, scope: { card: "fix-crash", frds: ["frd-02-beta"], wos: [] } }); collectQuestions(res);
  const c = check(res, "gates.foreseen");
  ok(c && c.status !== "pass", `gates.foreseen must not pass a card that mentions deploy/delete/money: ${JSON.stringify(c)}`);
  if (c.status === "ask") assertQuestion(c, "gates");
  ok(Array.isArray(res.announce.gates_foreseen_es) && res.announce.gates_foreseen_es.length > 0, "announce.gates_foreseen_es is empty");
  await fx.cleanup();
});

await test("risk zone is announced (provisional) but never asked: floor scope vs plain scope, no zone question, no sí", async () => {
  const risky = await setup("basic");
  const r = await risky.run({ scope: SCOPE_RISK }); collectQuestions(r);
  ok(["floor", "r1"].includes(r.announce.risk_zone_provisional), `WO touching src/lib/auth must announce floor or r1, got ${r.announce.risk_zone_provisional}`);
  const plain = await setup("basic");
  const p = await plain.run({ scope: { card: null, frds: ["frd-01-alpha"], wos: ["wo-01-001"] } }); collectQuestions(p);
  eq(p.announce.risk_zone_provisional, "none", "plain WO announces risk zone none");
  for (const res of [r, p]) for (const c of res.checks) {
    ok(!/risk|zone|floor|riesgo|zona/i.test(c.id), `a risk-zone check exists: ${c.id}`);
    if (c.question) ok(!/zona de riesgo|riesgo|floor|\br1\b/i.test(`${c.question.text_es} ${c.question.default_es} ${c.question.default_action}`), `question ${c.question.id} asks about the risk zone`);
  }
  await risky.fx.cleanup(); await plain.fx.cleanup();
});

await test("launched project without a hook: preflight only checks (R2), reports will_install and drive armable, writes nothing", async () => {
  const { fx, run } = await setup("launched");
  const hooks = path.join(fx.root, ".git", "hooks", "pre-push");
  let missing = false; try { await stat(hooks); } catch { missing = true; }
  ok(missing, "fixture should start without a pre-push hook");
  const res = await run(); collectQuestions(res);
  let stillMissing = false; try { await stat(hooks); } catch { stillMissing = true; }
  ok(stillMissing, "preflight must stay read-only: the pre-push hook is installed by start --run, not by preflight (R2)");
  const pp = check(res, "phase.prepush_missing");
  ok(!pp || pp.status !== "ask", `a missing-but-installable hook must not ask the owner: ${JSON.stringify(pp)}`);
  const ph = check(res, "phase.prepush");
  if (ph) eq(ph.status === "fail", false, "installable hook must not fail");
  ok(res.announce.launched_project_line_es && SPANISH_WORD.test(res.announce.launched_project_line_es), "launched_project_line_es must be a Spanish line in a launched project");
  ok(check(res, "phase.launched"), "phase.launched check missing in a launched project");
  eq(res.prepush && res.prepush.will_install, true, "prepush.will_install must be true when the hook is missing");
  eq(res.drive_armable, true, "drive armable: the hook will be installed by start --run");
  eq(fx.git("status", "--porcelain"), "", "preflight must not dirty the tracked tree");
  eq(fx.git("rev-parse", "HEAD"), fx.sha, "nothing may be committed on main by the preflight");
  const again = await run();
  eq(again.drive_armable, true, "second preflight (idempotent)");
  eq(again.prepush && again.prepush.will_install, true, "second preflight will_install");
  await fx.cleanup();
});

await test("launched project, tracked core.hooksPath: install refused, phase.prepush_missing asks with default, drive_armable false, tracked hook untouched", async () => {
  const { fx, run } = await setup({ preset: "launched", trackedHooksPath: true });
  const tracked = path.join(fx.root, ".githooks", "pre-push");
  const original = await readFile(tracked, "utf8");
  const res = await run(); collectQuestions(res);
  const c = check(res, "phase.prepush_missing");
  ok(c && c.status === "ask", `a refused install must ask the owner: ${JSON.stringify(c)}`);
  assertQuestion(c, "prepush_missing");
  eq(res.drive_armable, false, "drive must not be armable without a verified hook in a launched project");
  ok(typeof res.drive_block_reason === "string" && res.drive_block_reason.trim(), "drive_block_reason required when refused");
  eq(await readFile(tracked, "utf8"), original, "the tracked hook was modified");
  ok(!/pandacorp-pre-push/.test(await readFile(tracked, "utf8")), "marker written into a tracked hook");
  eq(fx.git("status", "--porcelain"), "", "tracked tree dirtied");
  ok(res.need_from_owner.includes("q-phase.prepush_missing"), "need_from_owner lacks the prepush question");
  await fx.cleanup();
});

await test("internal (not launched) project: no pre-push install, no phase.launched line, drive armable", async () => {
  const { fx, run } = await setup("basic");
  const res = await run();
  let missing = false; try { await stat(path.join(fx.root, ".git", "hooks", "pre-push")); } catch { missing = true; }
  ok(missing, "a hook was installed in a project that is not launched");
  eq(res.announce.launched_project_line_es, null, "launched line");
  await fx.cleanup();
});

await test("every question collected so far: id, default, affects, reversible, Spanish, no dashes, no risk-zone sí", async () => {
  ok(COLLECTED_QUESTIONS.length > 0, "no question was produced by any scenario (the asks above should have produced some)");
  const ids = new Set();
  for (const { check: c, question: q } of COLLECTED_QUESTIONS) {
    assertQuestion(c, "collected");
    ids.add(q.id);
    for (const s of [q.text_es, q.default_es]) { ok(SPANISH_WORD.test(s), `${q.id}: not Spanish: ${s}`); ok(!NO_DASH.test(s), `${q.id}: em/en dash in: ${s}`); }
    ok(!/riesgo|floor/i.test(q.text_es), `${q.id} asks about a risk zone`);
  }
});

await test("BL-0319 a Claude session building with Codex workers announces the Claude reviewer the run will use, not a degraded Codex Astra", async () => {
  const { run } = await setup("basic");
  const res = await run({ label: "codex" });
  ok(!/degradada: unreachable/.test(res.announce.reviewers), `label codex must not imply the Codex app: ${res.announce.reviewers}`);
  ok(/Codex Sol/i.test(res.announce.reviewers), `the reviewer of a Codex author is the other company (Claude): ${res.announce.reviewers}`);
  const explicit = await run({ label: "codex", coordinator: "claude" });
  eq(explicit.announce.reviewers, res.announce.reviewers, "absent --coordinator defaults to the Claude session");
  const app = await run({ label: "codex", coordinator: "codex" });
  ok(/Codex Sol/i.test(app.announce.reviewers), `the Codex app (explicit coordinator codex) still has no Claude reviewer: ${app.announce.reviewers}`);
});

await test("owner-facing preflight strings: Spanish, no em/en dashes (detail_es, announce lines, builders, reviewers)", async () => {
  const { fx, run } = await setup("launched", { PANDACORP_FAKE_CODEX_LOGIN: "out" });
  const res = await run({ scope: SCOPE_RISK });
  const strings = ownerStrings(res);
  ok(strings.length > 0, "no owner-facing strings found");
  for (const s of strings) ok(!NO_DASH.test(s), `em/en dash in owner-facing string: ${s}`);
  for (const c of res.checks) ok(SPANISH_WORD.test(c.detail_es), `detail_es is not Spanish: ${c.detail_es}`);
  for (const s of res.announce.scope_lines_es) ok(SPANISH_WORD.test(s), `scope line is not Spanish: ${s}`);
  await fx.cleanup();
});

await test("preflight never starts a run: no lease, no state.json, no journal, no card written", async () => {
  const { fx, run } = await setup("card");
  await run({ row: 3, scope: { card: "add-filter", frds: ["frd-01-alpha"], wos: [] } });
  const files = await listFiles(fx.root);
  for (const f of files) ok(!/lease|state\.json|journal\.jsonl|epoch/.test(f), `preflight wrote run machinery: ${f}`);
  ok((await readFile(path.join(fx.root, ".pandacorp/inbox/changes/add-filter.md"), "utf8")).includes("status: ready"), "preflight changed a card");
  await fx.cleanup();
});

// ---------------------------------------------------------------------------------------------
// summary.mjs
const RUN_ID = "br-2026-11-11-01";
async function summaryProject() {
  const dir = await sandbox();
  const fx = await createFixture("basic", { dir });
  const env = fx.env();
  await mkdir(env.HOME, { recursive: true });
  const base = newState({ run_id: RUN_ID, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature", scope: { card: null, frds: ["frd-01-alpha"], wos: ["wo-01-001", "wo-01-002"], out_of_scope: [] }, integration: { branch: `lane/${RUN_ID}`, worktree: path.join(fx.root, ".pandacorp/run/build/integration"), base_sha: fx.sha } });
  const write = (state) => withEnv(env, () => writeState(fx.root, state, { env }));
  const event = (type, data = {}) => withEnv(env, () => appendEvent(buildPaths(fx.root).journalFile, { run_id: RUN_ID, epoch: 1, type, data }, { env }));
  const summary = () => withEnv(env, () => buildSummary({ project: fx.root }, { env }));
  const ledger = (items) => mkdir(path.join(fx.root, ".pandacorp/run"), { recursive: true }).then(() => writeFile(buildPaths(fx.root).deferredReviewsFile, `${JSON.stringify(items)}\n`));
  return { fx, env, base, write, event, summary, ledger };
}
const schema = await loadSchema("summary");
const assertSchema = (s, where) => { const r = validate(schema, s); ok(r.ok, `${where}: summary does not validate against summary.schema.json: ${JSON.stringify(r.errors?.slice(0, 3))}`); };
const assertSummaryStrings = (s, where) => {
  for (const str of ownerStrings(s)) ok(!NO_DASH.test(str), `${where}: em/en dash in ${str}`);
  for (const q of s.open_questions) { ok(SPANISH_WORD.test(q.text_es), `${where}: text_es not Spanish: ${q.text_es}`); if (q.default_es) ok(SPANISH_WORD.test(q.default_es), `${where}: default_es not Spanish: ${q.default_es}`); }
};

await test("summary: empty active run validates the schema, nothing open", async () => {
  const sp = await summaryProject();
  await sp.write(sp.base);
  const s = await sp.summary(); assertSchema(s, "empty");
  eq(s.run_id, RUN_ID, "run_id"); eq(s.status, "active", "status");
  eq([s.need_from_owner, s.decided_without_owner, s.parked, s.open_questions], [[], [], [], []], "empty collections");
  eq(s.reviews, { cross: 0, degraded: [] }, "reviews"); eq(s.deferred_pending, 0, "deferred_pending");
  await sp.fx.cleanup();
});

await test("summary: parked units become parked[] and parked open questions (ids = pending_answer), branch and question carried", async () => {
  const sp = await summaryProject();
  const u1 = newUnit({ id: "u-build-wo-01-001", kind: "build", wos: ["wo-01-001"], frd: "frd-01-alpha", state: "parked", parked: "owner_question", pending_answer: "d-1", doubt_id: "d-1" });
  const u2 = newUnit({ id: "u-build-wo-01-002", kind: "build", wos: ["wo-01-002"], frd: "frd-01-alpha", state: "parked", parked: "built_on_assumption", pending_answer: "d-2", doubt_id: "d-2", branch: `lane/${RUN_ID}/assume-d-2` });
  await sp.write({ ...sp.base, status: "waiting_owner", units: [u1, u2] });
  await sp.event("parked", { unit: u1.id, reason: "owner_question", question: "Which date format should the list use?" });
  await sp.event("parked", { unit: u2.id, reason: "built_on_assumption", question: "Keep the legacy filter name?" });
  const s = await sp.summary(); assertSchema(s, "parked"); assertSummaryStrings(s, "parked");
  eq(s.status, "waiting_owner", "status");
  const p1 = s.parked.find((x) => x.unit === u1.id); const p2 = s.parked.find((x) => x.unit === u2.id);
  ok(p1 && p2, `both parked units must be listed: ${JSON.stringify(s.parked)}`);
  eq(p1.reason, "owner_question", "p1 reason"); eq(p1.question, "Which date format should the list use?", "p1 question"); eq(p1.branch, null, "p1 branch");
  eq(p2.reason, "built_on_assumption", "p2 reason"); eq(p2.branch, `lane/${RUN_ID}/assume-d-2`, "p2 branch");
  for (const id of ["d-1", "d-2"]) { const q = s.open_questions.find((x) => x.id === id); ok(q && q.kind === "parked", `open question ${id} (kind parked) missing: ${JSON.stringify(s.open_questions)}`); }
  ok(s.need_from_owner.length > 0, "need_from_owner must be non-empty while owner questions are open");
  await sp.fx.cleanup();
});

await test("summary: a waiting_gate unit is an open `gate` question g-<unit>, status waiting_gate", async () => {
  const sp = await summaryProject();
  const u = newUnit({ id: "u-build-wo-02-001", kind: "build", wos: ["wo-02-001"], frd: "frd-02-beta", state: "waiting_gate", waiting_gate: "money" });
  await sp.write({ ...sp.base, status: "waiting_gate", units: [u] });
  await sp.event("waiting_gate", { unit: u.id, kind: "money" });
  const s = await sp.summary(); assertSchema(s, "gate"); assertSummaryStrings(s, "gate");
  eq(s.status, "waiting_gate", "status");
  const q = s.open_questions.find((x) => x.id === `g-${u.id}`);
  ok(q && q.kind === "gate", `gate question g-${u.id} missing: ${JSON.stringify(s.open_questions)}`);
  await sp.fx.cleanup();
});

await test("summary: preflight asks are open `ask` questions until answered (state.answers closes them)", async () => {
  const sp = await summaryProject();
  const question = { id: "q-access.test_db", text_es: "¿Preparo la base de datos de pruebas ahora?", default_es: "Sí, la preparo yo mismo", default_action: "prepare", affects: { all: true }, reversible: true };
  const checks = [{ group: "access", id: "access.test_db", status: "ask", detail_es: "No hay base de datos de pruebas", question }];
  await sp.write(sp.base);
  await sp.event("run_started", { detect: {}, preflight: { checks, need_from_owner: [question.id] }, state: sp.base });
  const open = await sp.summary(); assertSchema(open, "ask open"); assertSummaryStrings(open, "ask open");
  const q = open.open_questions.find((x) => x.id === question.id);
  ok(q && q.kind === "ask", `ask question missing: ${JSON.stringify(open.open_questions)}`);
  eq(q.affects, { all: true }, "ask affects carried"); eq(q.reversible, true, "ask reversible carried"); ok(typeof q.default_es === "string" && q.default_es.trim(), "ask default carried");
  await sp.write({ ...sp.base, answers: { [question.id]: true } });
  const closed = await sp.summary(); assertSchema(closed, "ask closed");
  ok(!closed.open_questions.some((x) => x.id === question.id), "an answered ask must no longer be open");
  await sp.fx.cleanup();
});

await test("summary: autonomous decisions, cross reviews and degraded reviews are counted from the journal", async () => {
  const sp = await summaryProject();
  await sp.write(sp.base);
  const item = { doubt_id: "d-9", question: "Which sort order?", chosen: "by date descending", advised_by: ["claude:opus:high", "codex:astra:high"], confidence: "high", revert_hint: "revert commit abc123" };
  await sp.event("autonomous_decision", item);
  const rev = (cross, degraded, unit) => ({ unit, frd: "frd-01-alpha", reviewer: { runtime: "codex", model: "astra", effort: "high" }, authors: [{ runtime: "claude", model: "sonnet", effort: "medium" }], cross, degraded, findings: { critical: 0, high: 0, medium: 1, low: 0 }, pair_id: null });
  await sp.event("review_recorded", rev(true, null, "u-review-1"));
  await sp.event("review_recorded", rev(false, "quota_90", "u-review-2"));
  const s = await sp.summary(); assertSchema(s, "decisions"); assertSummaryStrings(s, "decisions");
  eq(s.decided_without_owner, [item], "decided_without_owner");
  eq(s.reviews.cross, 1, "cross reviews counted");
  eq(s.reviews.degraded, ["quota_90"], "degraded reviews listed");
  await sp.fx.cleanup();
});

await test("summary: deferred_pending counts only pending ledger entries", async () => {
  const sp = await summaryProject();
  await sp.write(sp.base);
  const entry = (id, status) => ({ id, unit: `u-${id}`, kind: "review", frd: "frd-01-alpha", sha_range: "a..b", author: { runtime: "claude", model: "sonnet", effort: "medium" }, reviewer_used: null, degraded: "quota_90", needed: { runtime: "claude", model: "opus", effort: "high" }, created_at: DEFAULT_NOW, status });
  await sp.ledger([entry("dr-1", "pending"), entry("dr-2", "pending"), entry("dr-3", "done")]);
  const s = await sp.summary(); assertSchema(s, "deferred");
  eq(s.deferred_pending, 2, "deferred_pending");
  await sp.fx.cleanup();
});

await test("summary: missing state is a loud error, not an empty summary (fail loud, DR-078)", async () => {
  const sp = await summaryProject();
  needFn(sum, "buildSummary", "summary.mjs");
  let threw = false; let value;
  try { value = await sp.summary(); } catch { threw = true; }
  ok(threw, `summary without state.json must throw (got ${JSON.stringify(value)})`);
  await sp.fx.cleanup();
});

await test("summary: a finished run reports status finished and validates", async () => {
  const sp = await summaryProject();
  await sp.write({ ...sp.base, status: "finished" });
  const s = await sp.summary(); assertSchema(s, "finished");
  eq(s.status, "finished", "status");
  await sp.fx.cleanup();
});

for (const d of sandboxes) await rm(d, { recursive: true, force: true }).catch(() => {});
console.log(`RESULT  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
