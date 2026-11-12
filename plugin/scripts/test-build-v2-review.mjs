#!/usr/bin/env node
// test-build-v2-review.mjs: T-C04, the official test of plugin/runtime/build/{review,deferred}.mjs.
// Written from the contracts only (PLAN 5.2 row C04, 3.16 A8/A13/A19, RESOLUTIONS D11/D23, CLI doc 3.10 review-record, 6 state,
// 7 journal, BUILD-10 in factory/standards/build-engine.md, schemas review-report / deferred-reviews / state / journal-event).
// Run: node plugin/scripts/test-build-v2-review.mjs
//
// ASSUMED INTERFACE (the docs fix the CLI shape but no export names; the orchestrator reconciles test and module):
//   review.mjs   recordReview({project, epoch, unit, token, file}, deps?) -> Promise<{ok, cmd:"review-record", verdict,
//                  deferred_review_id: string|null, probes_committed: string[]}>   (the `review-record` command body;
//                  alias names accepted by the loader: reviewRecord, recordReviewVerdict). Refusals are thrown errors:
//                  exit 6 (`error.exit === 6` or a code matching INVALID/TOKEN/REVIEW/SCHEMA/PROBE), a stale epoch is `FENCE`.
//   deps         {env, clock, reviewCell, routing:{reviewCell}, availability}. `reviewCell(input)` is the routing.mjs signature
//                  `reviewCell({authors[], kind, zone, availability}) -> {primary, used, degraded, deferred, parked}` (CLI doc 8.3);
//                  the fake is offered under both deps.reviewCell and deps.routing.reviewCell. `availability` is offered as a
//                  callable that also carries {claude, codex} (an async () => ({claude, codex}) with the two keys on it), so
//                  either reading works. `clock()` returns a Date/ms.
//   Reviewed units = the non-review units of the review unit's FRD that are in state `integrated`/`reviewing`; their authors are
//                  their `worker` cell {runtime, model, effort} (the dispatch cell). Review kind passed to routing: `frd` (size feature).
//   Probe files are read from the review unit's `worktree` (uncommitted, written by the worker) and committed by the CLI onto
//                  `lane/<run_id>` (the integration worktree) with the trailer `Unit: <review unit>`; `probe_hashes` (sha256 of the
//                  file) is stored on the review unit. A declared failed_first probe whose file is missing is refused.
//   Probe budget: findings.length + 3 probes per review; over budget is either refused or clipped (the test accepts both,
//                  but never more than the budget committed).
//   Verdict effects: pass -> reviewed units `verified`; reopen -> patch unit `u-patch-<first wo lowercase>` queued with
//                  attempt = max attempt + 1, reviewed units `patching`, WO IN_REVIEW -> PLANNED -> IN_PROGRESS (reopen_count 1);
//                  blocked -> handback file `build/handback/<reviewed unit>.md` carrying the finding summary, WO BLOCKED,
//                  reviewed units `blocked` or `parked`; doubt -> nothing verified, no patch unit, no attempt consumed.
//                  A parked review (routing `parked:"no_reviewer"`) never verifies anything: the call throws, or returns
//                  parked:"no_reviewer", or marks the unit `parked:"no_reviewer"`.
//   deferred.mjs readDeferred(project, deps?) -> entries[] ([] for a missing file, throws on a corrupt one);
//                queueDeferred(project, entry, deps?) -> the stored entry (id and created_at filled, status "pending"; needs a live
//                  lease: "written only inside a run"); pendingDeferred(project, availability, deps?) -> pending entries whose
//                  `needed` company is `ok` in `availability` {claude, codex}; completeDeferred(project, id, result, deps?) ->
//                  the entry now `done` with `result`. Alias names accepted by the loader are listed in NAMES below.
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };

// ---- loading: a missing module or export becomes a clear failure, never an obscure crash --------------------------
const loaded = {};
const load = async (file) => {
  if (!(file in loaded)) { try { loaded[file] = await import(pathToFileURL(path.join(BUILD, file)).href); } catch (e) { loaded[file] = { __error: e }; } }
  return loaded[file];
};
const NAMES = {
  recordReview: ["recordReview", "reviewRecord", "recordReviewVerdict"],
  readDeferred: ["readDeferred", "loadDeferred", "listDeferred"],
  queueDeferred: ["queueDeferred", "enqueueDeferred", "appendDeferred", "addDeferred"],
  pendingDeferred: ["pendingDeferred", "servableDeferred", "pendingFor"],
  completeDeferred: ["completeDeferred", "markDeferredDone", "finishDeferred"],
};
const need = async (file, key) => {
  const mod = await load(file);
  if (mod.__error) throw Object.assign(new Error(`plugin/runtime/build/${file} cannot be imported: ${mod.__error.message}`), { loader: true });
  for (const name of NAMES[key]) if (typeof mod[name] === "function") return key === "queueDeferred" ? async (...a) => (await mod[name](...a)).entry : mod[name];
  throw Object.assign(new Error(`plugin/runtime/build/${file} exports none of ${NAMES[key].join("|")} (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`), { loader: true });
};
const sib = async (file) => { const m = await load(file); if (m.__error) throw new Error(`settled module ${file} cannot be imported: ${m.__error.message}`); return m; };
const fixturesMod = async () => import(pathToFileURL(FIXTURES).href);
const buildStateMod = async () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);

// A refusal is an exit-6 style rejection, never a crash of the code under test or a fence error.
const refused = async (fn, what) => {
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a refusal (exit 6), but the call succeeded`);
  if (err.loader) throw new Error(`${what}: ${err.message}`);
  if (err instanceof TypeError || err instanceof ReferenceError) throw new Error(`${what}: the code under test crashed instead of refusing: ${err.message}`);
  const code = String(err.code || "");
  const isSix = err.exit === 6 || err.exitCode === 6 || /INVALID|TOKEN|REVIEW|SCHEMA|PROBE|REFUS|BAD/i.test(code);
  if (!isSix) throw new Error(`${what}: expected exit 6 / an INVALID-style code, got code=${code || "(none)"} exit=${err.exit}: ${err.message}`);
  return err;
};

// For "refused OR handled" outcomes: a thrown error only counts when it is a real refusal of the module, not a loader failure or a crash.
const realError = (err, what) => { if (err.loader) throw new Error(`${what}: ${err.message}`); if (err instanceof TypeError || err instanceof ReferenceError) throw new Error(`${what}: crash instead of a refusal: ${err.message}`); };

const RUN = "run-c04";
const NOW = "2026-11-11T12:00:00.000Z";
const FRD = "frd-01-alpha";
const BUILD_UNIT = "u-build-wo-01-001";
const BUILD_UNIT_2 = "u-build-wo-01-002";
const REVIEW_UNIT = "u-review-frd-01-alpha";
const WO_FILE = `docs/frds/${FRD}/work-orders/wo-01-001.md`;

const CELL = {
  sonnetHigh: { runtime: "claude", model: "sonnet", effort: "high" },
  sonnetMed: { runtime: "claude", model: "sonnet", effort: "medium" },
  opusHigh: { runtime: "claude", model: "opus", effort: "high" },
  opusXhigh: { runtime: "claude", model: "opus", effort: "xhigh" },
  solHigh: { runtime: "codex", model: "sol", effort: "high" },
  solMed: { runtime: "codex", model: "sol", effort: "medium" },
  astraHigh: { runtime: "codex", model: "astra", effort: "high" },
};
const worker = (cell) => ({ ...cell, via: "agent", pid: null, worker_id: null });

// Scripted routing answers (CLI doc 8.3 shape).
const ROUTE = {
  cross: (primary = CELL.solHigh) => ({ primary, used: primary, degraded: null, deferred: null, parked: null }),
  quota: { primary: CELL.solHigh, used: CELL.opusHigh, degraded: "quota_90", deferred: { needed: "codex", reviewer: CELL.solHigh }, parked: null },
  sameModel: { primary: CELL.solHigh, used: CELL.opusXhigh, degraded: "same_model", deferred: { needed: "codex", reviewer: CELL.solHigh }, parked: null },
  unreachable: { primary: CELL.solHigh, used: CELL.opusHigh, degraded: "unreachable", deferred: { needed: "codex", reviewer: CELL.solHigh }, parked: null },
  park: { primary: CELL.solHigh, used: null, degraded: null, deferred: null, parked: "no_reviewer" },
};

// ---- builders ----------------------------------------------------------------------------------------------------
const baseUnit = (over = {}) => ({
  id: BUILD_UNIT, kind: "build", wos: ["WO-01-001"], frd: FRD, chain: "c-wo-01-001", zone: "none", risk_rules: [],
  state: "integrated", attempt: 2, token_hash: null, worker: worker(CELL.sonnetHigh), worktree: null, branch: null, depends_on: [],
  pending_answer: null, parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const baseState = (over = {}) => ({
  schema: 2, engine: "v2", run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature",
  status: "active", status_reason: null, tranche: null,
  scope: { card: null, frds: [FRD], wos: ["WO-01-001"], out_of_scope: [] },
  integration: { branch: "placeholder-overridden-by-withRun", worktree: "/nonexistent", base_sha: "a".repeat(40) },
  last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {}, ...over,
});

const report = (over = {}) => ({
  schema: 1, unit: REVIEW_UNIT, token: "TOKEN", reviewer: CELL.solHigh, verdict: "pass", findings: [], probes: [],
  traceability: [{ contract: "AC-01-001.1", contract_class: "acceptance-criterion", status: "pass", tests: ["src/alpha/_tests/list.test.ts"] }],
  doubt: null, ...over,
});
const finding = (id, over = {}) => ({ id, severity: "high", lens: "correctness", file: "src/alpha/list.ts", line: 3, summary: `finding ${id} summary`, probe: null, ...over });

// ---- run harness: a real fixture repo, a real lease, an integration worktree on lane/<run>, a signed unit token -------
const withRun = async (opts, fn) => {
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c04-"));
  const { createFixture, git } = await fixturesMod();
  const fx = await createFixture("basic", { dir });
  const savedEnv = { ...process.env };
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" });
  try {
    const env = fx.env();
    const { buildPaths } = await sib("paths.mjs");
    const stateMod = await sib("state.mjs");
    const journalMod = await sib("journal.mjs");
    const admission = await sib("admission.mjs");
    const bs = await buildStateMod();
    const lease = await bs.acquire(fx.root, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
    const p = buildPaths(fx.root, { env });
    // integration worktree with WO-01-001 IN_REVIEW (as after integration)
    fx.git("worktree", "add", "-q", "-b", p.integrationBranch(RUN), p.integrationWorktree);
    const wo = path.join(p.integrationWorktree, WO_FILE);
    await writeFile(wo, (await readFile(wo, "utf8")).replace("implementation_status: PLANNED", "implementation_status: IN_REVIEW"));
    git(p.integrationWorktree, ["add", "-A"]); git(p.integrationWorktree, ["commit", "-q", "-m", "chore: wo in review"]);
    const reviewWt = p.unitWorktree(REVIEW_UNIT);
    fx.git("worktree", "add", "-q", "--detach", reviewWt, p.integrationBranch(RUN));
    const issued = admission.issueToken(REVIEW_UNIT, "B", { file: p.admissionFile });
    const reviewKind = opts.reviewKind || "review";
    const units = [
      baseUnit({ worker: worker(opts.author || CELL.sonnetHigh), zone: opts.zone || "none" }),
      ...(opts.mixed ? [baseUnit({ id: BUILD_UNIT_2, wos: ["WO-01-002"], chain: "c-wo-01-002", worker: worker(CELL.solMed), zone: opts.zone || "none" })] : []),
      baseUnit({ id: REVIEW_UNIT, kind: reviewKind, wos: [], chain: null, state: "running", attempt: 1, token_hash: issued.token_hash, worker: worker(opts.reviewer || CELL.solHigh), worktree: reviewWt, zone: opts.zone || "none" }),
    ];
    await stateMod.writeState(fx.root, baseState({ epoch: lease.epoch, units, integration: { branch: p.integrationBranch(RUN), worktree: p.integrationWorktree, base_sha: fx.sha } }));
    const calls = [];
    const makeDeps = (route, extra = {}) => {
      const reviewCell = (input) => { calls.push(structuredClone(input)); return typeof route === "function" ? route(input) : route; };
      const avail = Object.assign(async () => ({ claude: "ok", codex: "ok" }), { claude: "ok", codex: "ok" });
      return { env, clock: () => new Date(NOW), reviewCell, routing: { reviewCell }, availability: avail, ...extra };
    };
    const ctx = {
      fx, env, p, lease, calls, token: issued.token, epoch: lease.epoch, reviewWt, git, makeDeps,
      readState: () => stateMod.readState(fx.root, { env }),
      events: async () => (await journalMod.readJournal(p.journalFile)).events,
      ledger: async () => ((await exists(p.deferredReviewsFile)) ? JSON.parse(await readFile(p.deferredReviewsFile, "utf8")) : []),
      unit: async (id) => (await stateMod.readState(fx.root, { env })).units.find((u) => u.id === id),
      woText: () => readFile(wo, "utf8"),
      writeReport: async (over = {}, token = issued.token) => { const r = report({ token, ...over }); await mkdir(path.dirname(p.reviewFile(REVIEW_UNIT)), { recursive: true }); await writeFile(p.reviewFile(REVIEW_UNIT), `${JSON.stringify(r, null, 2)}\n`); return r; },
      // call review-record: write the report, then run the command body
      record: async (over = {}, route = ROUTE.cross(), opts = {}) => {
        const { epoch = lease.epoch, depsExtra = {}, unit = REVIEW_UNIT } = opts;
        const token = "token" in opts ? opts.token : issued.token;
        const recordReview = await need("review.mjs", "recordReview");
        await ctx.writeReport(over, token);
        return recordReview({ project: fx.root, epoch, unit, token, file: p.reviewFile(REVIEW_UNIT) }, makeDeps(route, depsExtra));
      },
      writeProbe: async (rel, text = "test('probe', () => { throw new Error('red'); });\n") => { const f = path.join(reviewWt, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text); return text; },
    };
    return await fn(ctx);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true });
  }
};
// state + journal untouched by a refused call
const snapshot = async (c) => JSON.stringify({ state: await c.readState(), events: (await c.events()).length, ledger: await c.ledger() });

// =====================================================================================================================
// Verdicts
// =====================================================================================================================
await test("verdict pass: reviewed units become verified, nothing deferred, no probes, output shape of review-record", async () => withRun({}, async (c) => {
  const out = await c.record({ verdict: "pass" }, ROUTE.cross());
  eq(out.verdict, "pass", "verdict");
  eq(out.deferred_review_id, null, "deferred_review_id");
  eq(out.probes_committed, [], "probes_committed");
  eq((await c.unit(BUILD_UNIT)).state, "verified", "reviewed unit state");
  eq((await c.unit(REVIEW_UNIT)).state, "verified", "a review-type unit ends verified (A13 terminal)");
  eq((await c.unit(REVIEW_UNIT)).review, { verdict: "pass", reviewer: CELL.solHigh, degraded: null, deferred_id: null }, "review summary stored on the review unit");
  eq(await c.ledger(), [], "a clean cross-company review queues nothing");
}));

await test("verdict reopen: patch unit u-patch-<first wo> queued at attempt max+1, reviewed units patching, WO IN_REVIEW -> PLANNED -> IN_PROGRESS with reopen_count 1, committed on the integration branch", async () => withRun({}, async (c) => {
  const out = await c.record({ verdict: "reopen", findings: [finding("F1", { summary: "list ignores the status filter" })] }, ROUTE.cross());
  eq(out.verdict, "reopen", "verdict");
  const st = await c.readState();
  const patch = st.units.find((u) => u.id === "u-patch-wo-01-001");
  ok(patch, `a patch unit u-patch-wo-01-001 must exist; units: ${st.units.map((u) => u.id).join(", ")}`);
  eq(patch.kind, "patch", "kind"); eq(patch.state, "queued", "state"); eq(patch.attempt, 3, "attempt = max attempt of the reviewed units (2) + 1");
  eq(patch.wos, ["WO-01-001"], "wos"); eq(patch.frd, FRD, "frd");
  eq((await c.unit(BUILD_UNIT)).state, "patching", "reviewed unit state");
  const wo = await c.woText();
  ok(/implementation_status:\s*IN_PROGRESS/.test(wo), `WO must end IN_PROGRESS after the reopen path, got: ${(wo.match(/implementation_status:.*/) || ["(none)"])[0]}`);
  ok(/reopen_count:\s*1/.test(wo), "reopen_count must be bumped to 1");
  eq(c.git(c.p.integrationWorktree, ["status", "--porcelain"]), "", "WO transition is committed on lane/<run_id>, the worktree is clean");
}));

await test("verdict reopen with several reviewed units: the patch attempt is the MAX attempt of the units it fixes plus one", async () => withRun({ mixed: true, reviewer: CELL.astraHigh }, async (c) => {
  const stateMod = await sib("state.mjs");
  const st = await c.readState();
  st.units.find((u) => u.id === BUILD_UNIT_2).attempt = 1;
  await stateMod.writeState(c.fx.root, st, { env: c.env });
  await c.record({ verdict: "reopen", findings: [finding("F1")], reviewer: CELL.astraHigh }, ROUTE.cross(CELL.astraHigh));
  const patches = (await c.readState()).units.filter((u) => u.kind === "patch");
  ok(patches.length >= 1, "a patch unit must be queued");
  ok(patches.every((u) => u.attempt === 3), `every patch unit must carry attempt 3 (max 2 + 1), got ${patches.map((u) => u.attempt).join(",")}`);
}));

await test("verdict blocked: the reviewed units are handed back with the finding as reason (handback file, WO BLOCKED), nothing verified, no patch unit", async () => withRun({}, async (c) => {
  const out = await c.record({ verdict: "blocked", findings: [finding("F1", { severity: "critical", summary: "touches Fuera: rewrites billing" , lens: "scope" })] }, ROUTE.cross());
  eq(out.verdict, "blocked", "verdict");
  const hb = c.p.handbackFile(BUILD_UNIT);
  ok(await exists(hb), `handback file for the reviewed unit must exist at ${hb}`);
  ok((await readFile(hb, "utf8")).includes("touches Fuera: rewrites billing"), "the handback carries the finding summary as its reason");
  ok(/implementation_status:\s*BLOCKED/.test(await c.woText()), "the WO of the handed-back unit goes BLOCKED");
  const st = await c.readState();
  ok(["blocked", "parked"].includes(st.units.find((u) => u.id === BUILD_UNIT).state), "reviewed unit is blocked or parked, never verified");
  ok(!st.units.some((u) => u.kind === "patch"), "blocked opens no patch unit");
}));

await test("verdict doubt: nothing verified, no patch unit, no attempt consumed; the verdict is recorded", async () => withRun({}, async (c) => {
  const doubt = { question: "Should the list be paginated?", options: [{ id: "a", text: "yes" }, { id: "b", text: "no" }], preferred: "b", why: "FRD silent" };
  const out = await c.record({ verdict: "doubt", doubt }, ROUTE.cross());
  eq(out.verdict, "doubt", "verdict");
  const st = await c.readState();
  const reviewed = st.units.find((u) => u.id === BUILD_UNIT);
  ok(reviewed.state !== "verified", "a doubt verifies nothing");
  eq(reviewed.attempt, 2, "a doubt consumes no attempt");
  ok(!st.units.some((u) => u.kind === "patch"), "no patch unit on a doubt");
  eq(st.units.find((u) => u.id === REVIEW_UNIT).review.verdict, "doubt", "verdict stored on the review unit");
}));

// =====================================================================================================================
// Report validation, token, fence
// =====================================================================================================================
const INVALID = {
  "missing traceability": (r) => { delete r.traceability; return r; },
  "unknown top-level key": (r) => ({ ...r, extra: 1 }),
  "verdict outside the enum": (r) => ({ ...r, verdict: "maybe" }),
  "severity outside the enum": (r) => ({ ...r, findings: [finding("F1", { severity: "urgent" })] }),
  "lens outside the enum": (r) => ({ ...r, findings: [finding("F1", { lens: "style" })] }),
  "probe without failed_first": (r) => ({ ...r, probes: [{ path: "src/a/_tests/p.test.ts" }] }),
  "reviewer model outside the catalog": (r) => ({ ...r, reviewer: { runtime: "codex", model: "gpt", effort: "high" } }),
  "reviewer effort max": (r) => ({ ...r, reviewer: { runtime: "claude", model: "opus", effort: "max" } }),
  "doubt missing": (r) => { delete r.doubt; return r; },
};
for (const [label, mutate] of Object.entries(INVALID)) {
  await test(`report validation: ${label} is refused (exit 6) and nothing changes`, async () => withRun({}, async (c) => {
    const before = await snapshot(c);
    const recordReview = await need("review.mjs", "recordReview");
    const r = mutate(report({ token: c.token }));
    await mkdir(path.dirname(c.p.reviewFile(REVIEW_UNIT)), { recursive: true });
    await writeFile(c.p.reviewFile(REVIEW_UNIT), JSON.stringify(r));
    await refused(() => recordReview({ project: c.fx.root, epoch: c.epoch, unit: REVIEW_UNIT, token: c.token, file: c.p.reviewFile(REVIEW_UNIT) }, c.makeDeps(ROUTE.cross())), label);
    eq(await snapshot(c), before, "state, journal and ledger are untouched");
  }));
}

await test("report validation: a file that is not JSON is refused", async () => withRun({}, async (c) => {
  const recordReview = await need("review.mjs", "recordReview");
  await mkdir(path.dirname(c.p.reviewFile(REVIEW_UNIT)), { recursive: true });
  await writeFile(c.p.reviewFile(REVIEW_UNIT), "{ not json");
  await refused(() => recordReview({ project: c.fx.root, epoch: c.epoch, unit: REVIEW_UNIT, token: c.token, file: c.p.reviewFile(REVIEW_UNIT) }, c.makeDeps(ROUTE.cross())), "garbage file");
}));

await test("unit token required: a missing, wrong or foreign token is refused (exit 6) and the right token still works afterwards", async () => withRun({}, async (c) => {
  const before = await snapshot(c);
  await refused(() => c.record({}, ROUTE.cross(), { token: "" }), "empty token");
  await refused(() => c.record({}, ROUTE.cross(), { token: undefined }), "no token");
  await refused(() => c.record({}, ROUTE.cross(), { token: "f".repeat(64) }), "unknown token");
  eq(await snapshot(c), before, "refusals change nothing");
  const out = await c.record({}, ROUTE.cross());
  eq(out.verdict, "pass", "the real token is still accepted after the refusals");
}));

await test("unit token: the report's own `token` field must equal the token argument", async () => withRun({}, async (c) => {
  const recordReview = await need("review.mjs", "recordReview");
  await c.writeReport({ token: "0".repeat(64) });
  await refused(() => recordReview({ project: c.fx.root, epoch: c.epoch, unit: REVIEW_UNIT, token: c.token, file: c.p.reviewFile(REVIEW_UNIT) }, c.makeDeps(ROUTE.cross())), "report.token differs from --token");
}));

await test("unit token: the token is released after a successful record (a replay is refused)", async () => withRun({}, async (c) => {
  await c.record({}, ROUTE.cross());
  const adm = JSON.parse(await readFile(c.p.admissionFile, "utf8"));
  ok(!Object.values(adm.tokens).some((t) => t.unit === REVIEW_UNIT), "no admission token remains for the review unit");
  await refused(() => c.record({}, ROUTE.cross()), "replayed token");
}));

await test("the report's `unit` must equal the unit argument", async () => withRun({}, async (c) => {
  await refused(() => c.record({ unit: "u-review-frd-99-zzz" }, ROUTE.cross()), "report.unit differs from --unit");
}));

await test("only review, deferred-review and audit units can be recorded: a build unit and an unknown unit are refused", async () => withRun({}, async (c) => {
  const recordReview = await need("review.mjs", "recordReview");
  await c.writeReport({ unit: BUILD_UNIT });
  await refused(() => recordReview({ project: c.fx.root, epoch: c.epoch, unit: BUILD_UNIT, token: c.token, file: c.p.reviewFile(REVIEW_UNIT) }, c.makeDeps(ROUTE.cross())), "build unit");
  await c.writeReport({ unit: "u-review-nope" });
  await refused(() => recordReview({ project: c.fx.root, epoch: c.epoch, unit: "u-review-nope", token: c.token, file: c.p.reviewFile(REVIEW_UNIT) }, c.makeDeps(ROUTE.cross())), "unknown unit");
}));

await test("fenced: a stale epoch is rejected with FENCE and nothing is written", async () => withRun({}, async (c) => {
  const before = await snapshot(c);
  let err = null; try { await c.record({}, ROUTE.cross(), { epoch: c.epoch + 1 }); } catch (e) { err = e; }
  ok(err, "a wrong epoch must be rejected"); if (err.loader) throw err;
  eq(err.code, "FENCE", `error code (message: ${err.message})`);
  eq(await snapshot(c), before, "nothing written");
}));

// =====================================================================================================================
// Journal
// =====================================================================================================================
await test("journal: review_recorded carries the verdict, unit, frd, reviewer, authors, cross and findings by severity", async () => withRun({}, async (c) => {
  await c.record({ verdict: "reopen", findings: [finding("F1", { severity: "high" }), finding("F2", { severity: "low" }), finding("F3", { severity: "low" })] }, ROUTE.cross());
  const e = (await c.events()).filter((x) => x.type === "review_recorded");
  eq(e.length, 1, "exactly one review_recorded event");
  const d = e[0].data;
  eq(d.verdict, "reopen", "data.verdict"); eq(d.unit, REVIEW_UNIT, "data.unit"); eq(d.frd, FRD, "data.frd");
  eq(d.reviewer, CELL.solHigh, "data.reviewer"); eq(d.authors, [CELL.sonnetHigh], "data.authors (the dispatch cells)");
  eq(d.cross, true, "claude author reviewed by codex is cross-company"); eq(d.degraded, null, "data.degraded");
  eq(d.findings, { critical: 0, high: 1, medium: 0, low: 2 }, "findings by severity");
}));

await test("journal: a pass verdict is journaled too, and a refused report journals nothing", async () => withRun({}, async (c) => {
  await c.record({ verdict: "pass" }, ROUTE.cross());
  eq((await c.events()).filter((x) => x.type === "review_recorded").map((x) => x.data.verdict), ["pass"], "pass journaled");
}));

// =====================================================================================================================
// Routing injection and author-never-reviews-itself
// =====================================================================================================================
await test("routing: the reviewer cell is asked from routing with the authors (dispatch cells), the unit zone, the kind and the availability", async () => withRun({ zone: "r1", mixed: true, reviewer: CELL.astraHigh }, async (c) => {
  await c.record({ reviewer: CELL.astraHigh }, ROUTE.cross(CELL.astraHigh));
  ok(c.calls.length >= 1, "reviewCell must be called through the injected routing");
  const call = c.calls[0];
  const key = (x) => `${x.runtime}/${x.model}`;
  eq([...new Set(call.authors.map(key))].sort(), ["claude/sonnet", "codex/sol"], "authors = the dispatch cells of the reviewed units (mixed-author diff)");
  eq(call.zone, "r1", "zone of the review unit"); eq(call.kind, "frd", "FRD review kind");
  ok(call.availability && "claude" in call.availability && "codex" in call.availability, "availability {claude, codex} is passed to routing");
}));

await test("routing: the recorded review uses the routed cell: a clean cross-company review is cross=true, degraded=null", async () => withRun({}, async (c) => {
  const out = await c.record({}, ROUTE.cross());
  eq(out.deferred_review_id, null, "no deferred id");
  eq((await c.unit(REVIEW_UNIT)).review.degraded, null, "degraded null");
}));

await test("an author never reviews its own unit: a report whose reviewer equals an author of the diff is refused unless routing allowed the N7 same-model exception", async () => withRun({}, async (c) => {
  const before = await snapshot(c);
  // sonnet authored the diff; routing says codex sol, but the report claims claude sonnet reviewed it
  await refused(() => c.record({ reviewer: CELL.sonnetHigh }, ROUTE.cross()), "author reports itself as the reviewer");
  eq(await snapshot(c), before, "nothing recorded");
}));

await test("N7 exception: opus-authored diff reviewed by opus (routing degraded same_model) is accepted, cross=false, and queued for re-review by codex", async () => withRun({ author: CELL.opusHigh, reviewer: CELL.opusXhigh }, async (c) => {
  const out = await c.record({ reviewer: CELL.opusXhigh }, ROUTE.sameModel);
  eq(out.verdict, "pass", "accepted");
  ok(out.deferred_review_id, "a same-model review is queued for re-review");
  const d = (await c.events()).find((x) => x.type === "review_recorded").data;
  eq(d.cross, false, "not cross-company"); eq(d.degraded, "same_model", "degraded label");
}));

// =====================================================================================================================
// Degraded reviews -> deferred-reviews.json
// =====================================================================================================================
const DEGRADED = [
  ["same_model (N7)", { author: CELL.opusHigh }, ROUTE.sameModel, CELL.opusXhigh, "same_model"],
  ["quota_90", {}, ROUTE.quota, CELL.opusHigh, "quota_90"],
  ["unreachable", {}, ROUTE.unreachable, CELL.opusHigh, "unreachable"],
];
for (const [label, runOpts, route, reviewer, degraded] of DEGRADED) {
  await test(`degraded review (${label}): queued in deferred-reviews.json for re-review by the primary company; journaled; unit review.deferred_id set`, async () => withRun({ ...runOpts, reviewer }, async (c) => {
    const out = await c.record({ reviewer }, route);
    ok(out.deferred_review_id, "review-record returns the deferred_review_id");
    const led = await c.ledger();
    eq(led.length, 1, "one pending entry");
    const e = led[0];
    eq(e.id, out.deferred_review_id, "entry id = returned id"); eq(e.unit, REVIEW_UNIT, "entry.unit"); eq(e.kind, "review", "entry.kind");
    eq(e.frd, FRD, "entry.frd"); ok(typeof e.sha_range === "string" && e.sha_range.length > 0, "entry.sha_range is a non-empty string");
    ok([CELL.sonnetHigh, CELL.opusHigh].some((a) => JSON.stringify(a) === JSON.stringify(e.author)), `entry.author is the author cell, got ${JSON.stringify(e.author)}`);
    eq(e.reviewer_used, reviewer, "entry.reviewer_used = who really reviewed"); eq(e.degraded, degraded, "entry.degraded");
    eq(e.needed, "codex", "entry.needed = the company of the primary cell"); eq(e.status, "pending", "entry.status");
    ok(Number.isFinite(Date.parse(e.created_at)), "entry.created_at is a timestamp");
    const { validate } = await sib("fsx.mjs");
    const schema = JSON.parse(await readFile(path.join(BUILD, "schemas", "deferred-reviews.schema.json"), "utf8"));
    ok(validate(schema, led).ok, "the ledger validates against deferred-reviews.schema.json");
    const events = await c.events();
    ok(events.some((x) => x.type === "deferred_review_queued"), "deferred_review_queued is journaled");
    eq(events.find((x) => x.type === "review_recorded").data.degraded, degraded, "review_recorded.data.degraded");
    eq((await c.unit(REVIEW_UNIT)).review.deferred_id, e.id, "unit.review.deferred_id");
    eq((await c.unit(REVIEW_UNIT)).review.degraded, degraded, "unit.review.degraded");
    eq((await c.unit(BUILD_UNIT)).state, "verified", "a degraded pass still verifies (landing with pending reviews is the owner's informed choice)");
  }));
}

await test("audit unit recorded by claude opus high queues nothing and verifies (BUILD-9: a degraded audit is queued by the engine, never by review-record)", async () => withRun({ reviewKind: "audit", author: CELL.opusHigh, reviewer: CELL.opusHigh }, async (c) => {
  await c.record({ reviewer: CELL.opusHigh }, ROUTE.cross(CELL.opusHigh));
  eq(await c.ledger(), [], "review-record never queues an audit");
  eq((await c.unit(BUILD_UNIT)).state, "verified", "the audited work is verified");
}));

await test("deferred accumulates across reviews: a second degraded review appends, never overwrites", async () => withRun({ reviewer: CELL.opusHigh }, async (c) => {
  const stateMod = await sib("state.mjs");
  const first = await c.record({ reviewer: CELL.opusHigh }, ROUTE.quota);
  // re-arm a second review unit for the same run
  const admission = await sib("admission.mjs");
  const issued = admission.issueToken("u-review-frd-01-beta", "B", { file: c.p.admissionFile });
  const st = await c.readState();
  st.units.push(baseUnit({ id: "u-review-frd-01-beta", kind: "review", wos: [], chain: null, state: "running", attempt: 1, token_hash: issued.token_hash, worker: worker(CELL.opusHigh), worktree: c.reviewWt, frd: FRD }));
  await stateMod.writeState(c.fx.root, st, { env: c.env });
  const recordReview = await need("review.mjs", "recordReview");
  const file = c.p.reviewFile("u-review-frd-01-beta"); await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report({ unit: "u-review-frd-01-beta", token: issued.token, reviewer: CELL.opusHigh })));
  const second = await recordReview({ project: c.fx.root, epoch: c.epoch, unit: "u-review-frd-01-beta", token: issued.token, file }, c.makeDeps(ROUTE.quota));
  const led = await c.ledger();
  eq(led.length, 2, "two entries"); ok(first.deferred_review_id !== second.deferred_review_id, "distinct ids");
}));

await test("a pass reviewed by the primary cell does not touch the ledger file", async () => withRun({}, async (c) => {
  await c.record({}, ROUTE.cross());
  eq(await c.ledger(), [], "no entries");
}));

await test("a parked review (no_reviewer) never marks work verified", async () => withRun({ author: CELL.opusHigh, reviewer: CELL.opusXhigh }, async (c) => {
  let out = null; let err = null;
  try { out = await c.record({ reviewer: CELL.opusXhigh }, ROUTE.park); } catch (e) { err = e; }
  const st = await c.readState();
  ok(!st.units.some((u) => u.state === "verified"), `no unit may be verified after a parked review; states: ${st.units.map((u) => `${u.id}=${u.state}`).join(", ")}`);
  if (err) realError(err, "parked review");
  ok(err !== null || out?.parked === "no_reviewer" || st.units.some((u) => u.parked === "no_reviewer"),
    "the park must surface: a refusal, parked:\"no_reviewer\" in the output, or a unit parked no_reviewer");
  eq(await c.ledger(), [], "a parked review is not a degraded review: nothing queued in the ledger");
}));

// =====================================================================================================================
// Probes (D23, A19)
// =====================================================================================================================
const PROBE = "src/alpha/_tests/probe-a.test.ts";
await test("probe committed only when it failed first: trailer Unit:, sha256 stored as probe_hashes, listed in probes_committed", async () => withRun({}, async (c) => {
  const body = await c.writeProbe(PROBE);
  const out = await c.record({ verdict: "reopen", findings: [finding("F1", { probe: PROBE })], probes: [{ path: PROBE, failed_first: true }] }, ROUTE.cross());
  eq(out.probes_committed, [PROBE], "probes_committed");
  const rev = await c.unit(REVIEW_UNIT);
  eq(rev.probe_hashes[PROBE], sha256(body), "probe_hashes = sha256 of the file (A19: the CLI hashes, the report carries no hash)");
  const probeSha = c.fx.git("log", "-1", "--format=%H", c.p.integrationBranch(RUN), "--", PROBE);
  const msg = c.fx.git("log", "-1", "--format=%B", probeSha);
  ok(new RegExp(`^Unit: ${REVIEW_UNIT}$`, "m").test(msg), `the probe commit carries the trailer "Unit: ${REVIEW_UNIT}", got: ${msg}`);
  ok(c.fx.git("show", "--name-only", "--format=", probeSha).split("\n").includes(PROBE), "the probe file is in the commit on lane/<run_id>");
  eq(await readFile(path.join(c.p.integrationWorktree, PROBE), "utf8"), body, "content on the integration branch");
}));

await test("a probe that did NOT fail first is not committed and not hashed", async () => withRun({}, async (c) => {
  await c.writeProbe(PROBE);
  const out = await c.record({ verdict: "pass", findings: [], probes: [{ path: PROBE, failed_first: false }] }, ROUTE.cross());
  eq(out.probes_committed, [], "probes_committed");
  eq((await c.unit(REVIEW_UNIT)).probe_hashes, {}, "probe_hashes empty");
  ok(!(await exists(path.join(c.p.integrationWorktree, PROBE))), "not in the integration worktree");
}));

await test("mixed probes: only the failed_first ones are committed", async () => withRun({}, async (c) => {
  await c.writeProbe(PROBE); await c.writeProbe("src/alpha/_tests/probe-b.test.ts");
  const out = await c.record({ verdict: "reopen", findings: [finding("F1"), finding("F2")], probes: [{ path: PROBE, failed_first: true }, { path: "src/alpha/_tests/probe-b.test.ts", failed_first: false }] }, ROUTE.cross());
  eq(out.probes_committed, [PROBE], "only the failed-first probe");
  eq(Object.keys((await c.unit(REVIEW_UNIT)).probe_hashes), [PROBE], "probe_hashes keys");
}));

await test("probe budget: one per finding plus at most 3 more per FRD (1 finding -> up to 4 probes accepted)", async () => withRun({}, async (c) => {
  const probes = [];
  for (let i = 1; i <= 4; i++) { const f = `src/alpha/_tests/p${i}.test.ts`; await c.writeProbe(f); probes.push({ path: f, failed_first: true }); }
  const out = await c.record({ verdict: "reopen", findings: [finding("F1")], probes }, ROUTE.cross());
  eq(out.probes_committed.length, 4, "1 finding + 3 extras = 4 probes");
}));

await test("probe budget: 1 finding with 5 probes is over budget (refused, or clipped to 4; never 5 committed)", async () => withRun({}, async (c) => {
  const probes = [];
  for (let i = 1; i <= 5; i++) { const f = `src/alpha/_tests/p${i}.test.ts`; await c.writeProbe(f); probes.push({ path: f, failed_first: true }); }
  let out = null; let err = null;
  try { out = await c.record({ verdict: "reopen", findings: [finding("F1")], probes }, ROUTE.cross()); } catch (e) { err = e; }
  if (err) { realError(err, "5 probes"); eq((await c.unit(REVIEW_UNIT)).probe_hashes, {}, "a refusal commits nothing"); }
  else ok(out.probes_committed.length <= 4, `committed ${out.probes_committed.length} probes, budget is 4`);
}));

await test("probe budget: with no finding at most 3 probes", async () => withRun({}, async (c) => {
  const probes = [];
  for (let i = 1; i <= 4; i++) { const f = `src/alpha/_tests/p${i}.test.ts`; await c.writeProbe(f); probes.push({ path: f, failed_first: true }); }
  let out = null; let err = null;
  try { out = await c.record({ verdict: "pass", findings: [], probes }, ROUTE.cross()); } catch (e) { err = e; }
  if (err) realError(err, "4 probes, 0 findings");
  else ok(out.probes_committed.length <= 3, `committed ${out.probes_committed.length} probes with 0 findings, budget is 3`);
}));

await test("a probe declared failed_first whose file does not exist is refused (exit 6)", async () => withRun({}, async (c) => {
  const before = await snapshot(c);
  await refused(() => c.record({ verdict: "reopen", findings: [finding("F1")], probes: [{ path: "src/alpha/_tests/ghost.test.ts", failed_first: true }] }, ROUTE.cross()), "missing probe file");
  eq(await snapshot(c), before, "nothing recorded");
}));

await test("a probe outside the test globs (production file) is never committed", async () => withRun({}, async (c) => {
  await c.writeProbe("src/alpha/list.ts", "export const value = 999;\n");
  let out = null; let err = null;
  try { out = await c.record({ verdict: "reopen", findings: [finding("F1")], probes: [{ path: "src/alpha/list.ts", failed_first: true }] }, ROUTE.cross()); } catch (e) { err = e; }
  if (err) realError(err, "production file as probe");
  else eq(out.probes_committed, [], "a production file is not a probe");
  ok(!/999/.test(c.fx.git("show", `${c.p.integrationBranch(RUN)}:src/alpha/list.ts`)), "the production file on lane/<run_id> is untouched");
}));

await test("probe path traversal is refused", async () => withRun({}, async (c) => {
  await refused(() => c.record({ verdict: "reopen", findings: [finding("F1")], probes: [{ path: "../../escape.test.ts", failed_first: true }] }, ROUTE.cross()), "path traversal");
}));

// =====================================================================================================================
// deferred.mjs ledger lifecycle
// =====================================================================================================================
const ENTRY = (over = {}) => ({ unit: REVIEW_UNIT, kind: "review", frd: FRD, sha_range: "aaaaaaa..bbbbbbb", author: CELL.opusHigh, reviewer_used: CELL.opusXhigh, degraded: "same_model", needed: "codex", ...over });

await test("deferred: readDeferred of a missing ledger is an empty list", async () => withRun({}, async (c) => {
  const readDeferred = await need("deferred.mjs", "readDeferred");
  eq(await readDeferred(c.fx.root, { env: c.env }), [], "missing file");
}));

await test("deferred: queueDeferred stores a pending entry with an id and a timestamp, valid against the schema", async () => withRun({}, async (c) => {
  const queueDeferred = await need("deferred.mjs", "queueDeferred"); const readDeferred = await need("deferred.mjs", "readDeferred");
  const e = await queueDeferred(c.fx.root, ENTRY(), { env: c.env, clock: () => new Date(NOW) });
  ok(typeof e.id === "string" && e.id.length > 0, "id"); eq(e.status, "pending", "status");
  eq(e.created_at, NOW, "created_at from the injected clock");
  eq((await readDeferred(c.fx.root, { env: c.env })).map((x) => x.id), [e.id], "persisted");
  const file = JSON.parse(await readFile(c.p.deferredReviewsFile, "utf8"));
  ok(Array.isArray(file), "the file is the schema's top-level array");
}));

await test("deferred: ids are unique across entries", async () => withRun({}, async (c) => {
  const queueDeferred = await need("deferred.mjs", "queueDeferred");
  const a = await queueDeferred(c.fx.root, ENTRY(), { env: c.env }); const b = await queueDeferred(c.fx.root, ENTRY({ kind: "audit" }), { env: c.env });
  ok(a.id !== b.id, "distinct ids");
}));

await test("deferred: an invalid entry (needed outside claude|codex) is refused and the ledger is unchanged", async () => withRun({}, async (c) => {
  const queueDeferred = await need("deferred.mjs", "queueDeferred");
  await queueDeferred(c.fx.root, ENTRY(), { env: c.env });
  const before = await readFile(c.p.deferredReviewsFile, "utf8");
  let err = null; try { await queueDeferred(c.fx.root, ENTRY({ needed: "gemini" }), { env: c.env }); } catch (e) { err = e; }
  ok(err, "an invalid entry must be refused"); realError(err, "invalid entry");
  eq(await readFile(c.p.deferredReviewsFile, "utf8"), before, "file unchanged");
}));

await test("deferred: written only inside a run (no live lease -> refused, no file created)", async () => {
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c04-nolease-"));
  const { createFixture } = await fixturesMod(); const fx = await createFixture("basic", { dir });
  try {
    const queueDeferred = await need("deferred.mjs", "queueDeferred");
    let err = null; try { await queueDeferred(fx.root, ENTRY(), { env: fx.env() }); } catch (e) { err = e; }
    ok(err, "queueing without a run must be refused"); realError(err, "queue without a run");
    const { buildPaths } = await sib("paths.mjs");
    ok(!(await exists(buildPaths(fx.root, { env: fx.env() }).deferredReviewsFile)), "no ledger file may be created outside a run");
  } finally { await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true }); }
});

await test("deferred: a corrupt ledger fails loud (never a silent empty list)", async () => withRun({}, async (c) => {
  const readDeferred = await need("deferred.mjs", "readDeferred");
  await mkdir(path.dirname(c.p.deferredReviewsFile), { recursive: true });
  await writeFile(c.p.deferredReviewsFile, "{ garbage");
  let err = null; let out = null; try { out = await readDeferred(c.fx.root, { env: c.env }); } catch (e) { err = e; }
  ok(err, `a corrupt ledger must throw, got ${JSON.stringify(out)}`); realError(err, "corrupt ledger");
  await writeFile(c.p.deferredReviewsFile, JSON.stringify({ not: "an array" }));
  err = null; out = null; try { out = await readDeferred(c.fx.root, { env: c.env }); } catch (e) { err = e; }
  ok(err, `a wrongly shaped ledger must throw, got ${JSON.stringify(out)}`); realError(err, "wrong ledger shape");
}));

await test("deferred: re-run only when the other company is available (pending entries filtered by `needed`)", async () => withRun({}, async (c) => {
  const queueDeferred = await need("deferred.mjs", "queueDeferred"); const pendingDeferred = await need("deferred.mjs", "pendingDeferred");
  const forCodex = await queueDeferred(c.fx.root, ENTRY({ needed: "codex" }), { env: c.env });
  const forClaude = await queueDeferred(c.fx.root, ENTRY({ unit: "u-review-frd-02-beta", needed: "claude", author: CELL.solHigh, reviewer_used: CELL.astraHigh, degraded: "quota_90" }), { env: c.env });
  const { companyServes } = await sib("deferred.mjs");
  const ids = async (avail) => (await pendingDeferred(c.fx.root, {}, { env: c.env })).filter((x) => companyServes(avail[x.needed])).map((x) => x.id).sort();
  eq(await ids({ claude: "ok", codex: "quota" }), [forClaude.id], "codex out of quota: only the claude-needed entry is servable");
  eq(await ids({ claude: "quota", codex: "ok" }), [forCodex.id], "claude out of quota: only the codex-needed entry");
  eq(await ids({ claude: "unreachable", codex: "unreachable" }), [], "nobody reachable: nothing servable");
  eq(await ids({ claude: "ok", codex: "ok" }), [forCodex.id, forClaude.id].sort(), "both ok: both servable");
}));

await test("deferred: completeDeferred marks the entry done with its result and it stops being pending", async () => withRun({}, async (c) => {
  const queueDeferred = await need("deferred.mjs", "queueDeferred"); const pendingDeferred = await need("deferred.mjs", "pendingDeferred");
  const completeDeferred = await need("deferred.mjs", "completeDeferred"); const readDeferred = await need("deferred.mjs", "readDeferred");
  const e = await queueDeferred(c.fx.root, ENTRY(), { env: c.env });
  await completeDeferred(c.fx.root, e.id, { result: { verdict: "pass", findings: 0 } }, { env: c.env });
  const [stored] = await readDeferred(c.fx.root, { env: c.env });
  eq(stored.status, "done", "status"); eq(stored.result.verdict, "pass", "result stored");
  eq(await pendingDeferred(c.fx.root, {}, { env: c.env }), [], "no longer pending");
  let err = null; try { await completeDeferred(c.fx.root, "d-unknown", {}, { env: c.env }); } catch (x) { err = x; }
  ok(err, "completing an unknown id must throw"); realError(err, "unknown id");
}));

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
