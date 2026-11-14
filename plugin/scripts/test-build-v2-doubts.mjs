#!/usr/bin/env node
// test-build-v2-doubts.mjs: T-C10 (part 1), the official test of plugin/runtime/build/{doubts,park}.mjs.
// Written from the contracts only (PLAN 5.2 row C10, 3.16 A7, RESOLUTIONS D19/D20, CLI doc 3.12, standard BUILD-12, schemas
// doubt / doubt-answer / journal-event). Run: node plugin/scripts/test-build-v2-doubts.mjs
//
// ASSUMED INTERFACE (the docs fix the CLI shape, not the export names; the orchestrator reconciles test and module):
//   doubts.mjs  openDoubt({project, epoch, unit, file}, deps?)           -> Promise<{ok, cmd:"doubt", doubt_id, step, consult?, decision?}>
//               answerDoubt({project, epoch, id, file, token?}, deps?)   -> same output shape
//               (aliases tried: doubtOpen / doubtAnswer). `id` is also passed as `doubt_id` and `doubt`.
//               Refusals are thrown errors: `error.exit === 6` or a code matching INVALID/TOKEN/SCHEMA/DOUBT. A stale epoch is code FENCE.
//   deps        {env, clock, availability}. Real routing.mjs is used (consultCell origin: claude -> codex sol high via cli;
//               codex -> claude opus high via agent; drive/codex-app -> codex astra high; consult 2 -> claude opus xhigh).
//   Origin of a doubt: state.coordinator "claude-session" + the doubting unit's worker.runtime (author's company); "drive" for the drive coordinator.
//   Files: doubt.json at paths.unitDoubtFile(unit); sources answer at paths.doubtSourcesFile(id); consult answer at
//               paths.unitAnswerFile(<consult unit id from the output>). The call takes the path in `file`.
//   Irreversibility veto: read from the doubting unit (zone "r1" and risk_rules ["R1"]), never from an LLM answer.
//   Park: unit state "parked" + parked "owner_question" + pending_answer = doubt id; dependents (depends_on closure) get state "parked".
//         Root rule: dependents > 50 % of the pending (non-terminal) units and a reversible unit -> parked "built_on_assumption",
//         doubt.assumption = {option: <preferred>, branch: paths.assumeBranch(run, doubt id)}. Exercised through the cap path
//         (state.doubts_consulted === 8, drive coordinator: the doubt parks at once) so no consult answer is needed.
//   Decided: unit re-queued at the SAME attempt, its brief (paths.briefFile) carries the decided option id; decision-log entry with the
//         text "Decidido sin el owner" committed on the integration branch; .pandacorp/inbox/decisions.md line written (in the integration
//         worktree when the file is tracked, in the project otherwise); journal autonomous_decision. state.doubts_consulted counts DOUBTS
//         that used at least one consult (not calls).
//   A consult served via:"agent" needs the unit token: the test registers the consult unit in state (kind doubt-consult, state running,
//         token_hash from admission.issueToken) when the module has not already created it.
//   park.mjs (pure, signatures from the C10 report EXPORTS addendum): dependentsOf, pendingUnits, rootBlock, parkOrAssume, parkUnits, assumeUnits, releaseParked,
//         assumptionUnits, createAssumeBranch, PARK_REASONS, ROOT_BLOCK_RATIO; root ratio = pending transitive dependents / all pending, isRoot = ratio > 0.5.
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };

const loaded = {};
const load = async (file) => {
  if (!(file in loaded)) { try { loaded[file] = await import(pathToFileURL(path.join(BUILD, file)).href); } catch (e) { loaded[file] = { __error: e }; } }
  return loaded[file];
};
const NAMES = { openDoubt: ["openDoubt", "doubtOpen"], answerDoubt: ["answerDoubt", "doubtAnswer"] };
const need = async (key) => {
  const mod = await load("doubts.mjs");
  if (mod.__error) throw Object.assign(new Error(`plugin/runtime/build/doubts.mjs cannot be imported: ${mod.__error.message}`), { loader: true });
  for (const name of NAMES[key]) if (typeof mod[name] === "function") return mod[name];
  throw Object.assign(new Error(`plugin/runtime/build/doubts.mjs exports none of ${NAMES[key].join("|")} (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`), { loader: true });
};
const sib = async (file) => { const m = await load(file); if (m.__error) throw new Error(`settled module ${file} cannot be imported: ${m.__error.message}`); return m; };
const fixturesMod = async () => import(pathToFileURL(FIXTURES).href);
const buildStateMod = async () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);

const refused = async (fn, what) => {
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a refusal (exit 6), but the call succeeded`);
  if (err.loader) throw new Error(`${what}: ${err.message}`);
  if (err instanceof TypeError || err instanceof ReferenceError) throw new Error(`${what}: crash instead of a refusal: ${err.message}`);
  const isSix = err.exit === 6 || err.exitCode === 6 || /INVALID|TOKEN|SCHEMA|DOUBT|REFUS|BAD/i.test(String(err.code || ""));
  if (!isSix) throw new Error(`${what}: expected exit 6 / an INVALID-style code, got code=${err.code || "(none)"} exit=${err.exit}: ${err.message}`);
  return err;
};

const RUN = "run-c10d";
const NOW = "2026-11-11T12:00:00.000Z";
const FRD = "frd-01-alpha";
const U1 = "u-build-wo-01-001";
const CELL = { sonnetHigh: { runtime: "claude", model: "sonnet", effort: "high" }, codexMed: { runtime: "codex", model: "sol", effort: "medium" },
  solHigh: { runtime: "codex", model: "sol", effort: "high" }, opusHigh: { runtime: "claude", model: "opus", effort: "high" },
  opusXhigh: { runtime: "claude", model: "opus", effort: "xhigh" }, astraHigh: { runtime: "codex", model: "astra", effort: "high" } };
const worker = (cell) => ({ ...cell, via: "agent", pid: null, worker_id: null });
const DOUBT = { question: "Paginate the alpha list?", options: [{ id: "opt-yes", text: "yes, 20 per page" }, { id: "opt-no", text: "no, one page" }], preferred: "opt-no", why: "the FRD is silent" };

const mkUnit = (id, over = {}) => ({
  id, kind: "build", wos: [], frd: FRD, chain: null, zone: "none", risk_rules: [], state: "queued", attempt: 1, token_hash: null,
  worker: worker(CELL.sonnetHigh), worktree: null, branch: null, depends_on: [], pending_answer: null, parked: null, waiting_gate: null,
  evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const doubtingUnit = (over = {}) => mkUnit(U1, { wos: ["WO-01-001"], chain: "c-wo-01-001", state: "reported", ...over });
const baseState = (over = {}) => ({
  schema: 2, engine: "v2", run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature", status: "active", status_reason: null,
  tranche: null, scope: { card: null, frds: [FRD], wos: ["WO-01-001"], out_of_scope: [] },
  integration: { branch: `lane/${RUN}/integration`, worktree: "/nonexistent", base_sha: "a".repeat(40) },
  last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {}, ...over,
});
const consultAnswer = (decision, confidence, consulted, reversible = true, rationale = "reasoned") => ({ decision, rationale, consulted, confidence, reversible });

const withRun = async (opts, fn) => {
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c10d-"));
  const { createFixture, git } = await fixturesMod();
  const fx = await createFixture(opts.preset || "basic", { dir });
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
    const branch = p.integrationBranch(RUN);
    fx.git("worktree", "add", "-q", "-b", branch, p.integrationWorktree);
    // two independent queued units keep a lone doubting unit well below the 50 % root rule, whatever way the module counts the root itself
    const units = opts.units || [doubtingUnit(), mkUnit("u-build-wo-02-001", { frd: "frd-02-beta" }), mkUnit("u-build-wo-02-002", { frd: "frd-02-beta" })];
    await stateMod.writeState(fx.root, baseState({ epoch: lease.epoch, coordinator: opts.coordinator || "claude-session", doubts_consulted: opts.doubtsConsulted || 0,
      units, integration: { branch, worktree: p.integrationWorktree, base_sha: fx.sha } }), { env });
    const avail = Object.assign(async () => ({ claude: "ok", codex: "ok" }), { claude: "ok", codex: "ok" });
    const deps = { env, clock: () => new Date(NOW), availability: avail };
    const ctx = {
      fx, env, p, lease, epoch: lease.epoch, deps, git, branch, admission, stateMod,
      readState: () => stateMod.readState(fx.root, { env }),
      unit: async (id) => (await stateMod.readState(fx.root, { env })).units.find((u) => u.id === id),
      events: async (type) => (await journalMod.readJournal(p.journalFile)).events.filter((e) => !type || e.type === type),
      doubtRec: async (id) => JSON.parse(await readFile(p.doubtFile(id), "utf8")),
      open: async (doubt = DOUBT, { unit = U1, epoch = lease.epoch } = {}) => {
        const openDoubt = await need("openDoubt");
        await mkdir(path.dirname(p.unitDoubtFile(unit)), { recursive: true });
        await writeFile(p.unitDoubtFile(unit), `${JSON.stringify(doubt, null, 2)}\n`);
        return openDoubt({ project: fx.root, epoch, unit, file: p.unitDoubtFile(unit) }, deps);
      },
      feed: async (id, file, content, { token, epoch = lease.epoch } = {}) => {
        const answerDoubt = await need("answerDoubt");
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
        const out = await answerDoubt({ project: fx.root, epoch, id, doubt_id: id, doubt: id, file, ...(token ? { token } : {}) }, deps);
        if (out !== undefined && out !== null) return out;
        // The documented output object is pinned by its own test; the ladder cases read the schema-fixed record so they stay informative.
        const rec = JSON.parse(await readFile(p.doubtFile(id), "utf8"));
        const pending = rec.consults.filter((x) => x.answer === null).pop();
        return { ok: true, cmd: "doubt", doubt_id: id, step: rec.step, decision: rec.decision, ...(pending ? { consult: pending } : {}), __synth: true };
      },
      // Answer a consult served via:"agent": registers the consult unit with a real admission token when the module has not, then files it.
      consultAgent: async (id, out, content) => {
        const issued = admission.issueToken(out.consult.unit, "B", { file: p.admissionFile });
        const st = await stateMod.readState(fx.root, { env });
        if (st.units.some((u) => u.id === out.consult.unit)) st.units = st.units.map((u) => (u.id === out.consult.unit ? { ...u, state: "running", token_hash: issued.token_hash } : u));
        else st.units.push(mkUnit(out.consult.unit, { kind: "doubt-consult", state: "running", frd: null, token_hash: issued.token_hash, worker: worker(CELL.opusXhigh) }));
        await stateMod.writeState(fx.root, st, { env });
        return ctx.consult(id, out, content, { token: issued.token });
      },
      sources: (id, content, o) => ctx.feed(id, p.doubtSourcesFile(id), content, o),
      consult: (id, out, content, o) => out.consult.via === "agent" && !o?.token ? ctx.consultAgent(id, out, content) : ctx.feed(id, p.unitAnswerFile(out.consult.unit), content, o),
      decisionLog: () => readFile(path.join(p.integrationWorktree, "docs", "decision-log.md"), "utf8"),
      decisionsFile: (where) => readFile(path.join(where === "main" ? fx.root : p.integrationWorktree, ".pandacorp", "inbox", "decisions.md"), "utf8").catch(() => ""),
    };
    return await fn(ctx);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true });
  }
};
const SRC_HIT = { decision: "opt-yes", rationale: "docs/frds/frd-01-alpha/frd.md:12 says 20 per page", consulted: null };
const SRC_MISS = { decision: null, rationale: "no source answers", consulted: null };

// =====================================================================================================================
// open
// =====================================================================================================================
await test("doubt open: record at step sources validates against doubt.schema, unit reported with doubt_id, journal doubt_opened", async () => withRun({}, async (c) => {
  const out = await c.open();
  ok(typeof out.doubt_id === "string" && out.doubt_id.length > 0, `doubt_id missing in ${JSON.stringify(out)}`);
  eq(out.step, "sources", "step"); ok(!out.consult, "no consult at the sources step"); ok(out.decision == null, "decision is null until decided");
  const { loadSchema, validate } = await sib("fsx.mjs");
  const rec = await c.doubtRec(out.doubt_id);
  const v = validate(await loadSchema("doubt"), rec); ok(v.ok, `stored record violates doubt.schema: ${JSON.stringify(v.errors?.slice(0, 3))}`);
  eq(rec.step, "sources", "record step"); eq(rec.unit, U1, "record unit"); eq(rec.question, DOUBT.question, "question"); eq(rec.preferred, "opt-no", "preferred");
  eq(rec.consults, [], "consults"); eq(rec.decision, null, "decision"); eq(rec.assumption, null, "assumption");
  const u = await c.unit(U1); eq(u.state, "reported", "unit state while the doubt is open"); eq(u.doubt_id, out.doubt_id, "unit.doubt_id");
  eq(u.attempt, 1, "no attempt consumed");
  ok((await c.events("doubt_opened")).length === 1, "journal must hold one doubt_opened");
}));

await test("doubt open: each doubt gets its own id", async () => withRun({ units: [doubtingUnit(), mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], state: "reported" })] }, async (c) => {
  const a = await c.open(DOUBT); const b = await c.open(DOUBT, { unit: "u-build-wo-01-002" });
  ok(a.doubt_id !== b.doubt_id, "two doubts must not share an id");
}));

await test("doubt open: invalid doubt file (missing options / unknown key / not JSON) is refused (exit 6) and creates no record", async () => withRun({}, async (c) => {
  const openDoubt = await need("openDoubt");
  const bad = [{ ...DOUBT, options: undefined }, { ...DOUBT, extra: 1 }, "{ not json"];
  for (const content of bad) {
    await mkdir(path.dirname(c.p.unitDoubtFile(U1)), { recursive: true });
    await writeFile(c.p.unitDoubtFile(U1), typeof content === "string" ? content : JSON.stringify(content));
    await refused(() => openDoubt({ project: c.fx.root, epoch: c.epoch, unit: U1, file: c.p.unitDoubtFile(U1) }, c.deps), "bad doubt.json");
  }
  eq((await c.unit(U1)).doubt_id, null, "the unit keeps no doubt_id");
  eq((await c.events("doubt_opened")).length, 0, "nothing journaled");
}));

await test("fence: a stale epoch is rejected with FENCE and nothing changes", async () => withRun({}, async (c) => {
  const openDoubt = await need("openDoubt");
  await mkdir(path.dirname(c.p.unitDoubtFile(U1)), { recursive: true }); await writeFile(c.p.unitDoubtFile(U1), JSON.stringify(DOUBT));
  let err = null; try { await openDoubt({ project: c.fx.root, epoch: c.epoch + 5, unit: U1, file: c.p.unitDoubtFile(U1) }, c.deps); } catch (e) { err = e; }
  ok(err, "a wrong epoch must throw");
  if (err.loader) throw new Error(err.message);
  ok(err.code === "FENCE" || err.exit === 3, `expected FENCE / exit 3, got code=${err.code} exit=${err.exit}: ${err.message}`);
  eq((await c.unit(U1)).doubt_id, null, "unit untouched");
}));

// =====================================================================================================================
// ladder: sources, consult 1, consult 2
// =====================================================================================================================
await test("sources hit: decided_by sources, unit re-queued at the SAME attempt with the decision in its brief, decision-log + decisions.md + journal", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open();
  const out = await c.sources(id, SRC_HIT);
  eq(out.step, "decided", "step"); eq(out.decision?.value, "opt-yes", "decision value"); eq(out.decision?.decided_by, "sources", "decided_by");
  const rec = await c.doubtRec(id); eq(rec.step, "decided", "record step"); eq(rec.decision.decided_by, "sources", "record decided_by");
  const u = await c.unit(U1); eq(u.state, "queued", "unit state after decided"); eq(u.attempt, 1, "same attempt");
  const brief = await readFile(c.p.briefFile(U1), "utf8").catch(() => null);
  if (brief !== null) ok(brief.includes("opt-yes"), "a brief present on disk must carry the decision (option id opt-yes)");
  const log = await c.decisionLog(); ok(log.includes("Decidido sin el owner"), "decision-log entry marked 'Decidido sin el owner' in the integration worktree");
  ok(log.includes(DOUBT.question), "the entry carries the question");
  eq(c.git(c.p.integrationWorktree, ["status", "--porcelain", "--", "docs/decision-log.md"]), "", "the decision-log entry is committed on the integration branch");
  ok(c.git(c.p.integrationWorktree, ["log", "-1", "--format=%s", "--", "docs/decision-log.md"]).length > 0 && c.git(c.p.integrationWorktree, ["rev-list", "--count", `${c.fx.sha}..${c.branch}`]) !== "0", "a commit exists on lane/<run>/integration");
  ok((await c.decisionsFile("main")).includes(id), "decisions.md (untracked: in the project) lists the doubt id");
  const ev = await c.events("autonomous_decision"); eq(ev.length, 1, "one autonomous_decision event");
}));

await test("doubt answer returns the documented output object {ok, cmd:'doubt', doubt_id, step, consult?, decision?}", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open();
  const answerDoubt = await need("answerDoubt");
  await mkdir(c.p.doubtsDir, { recursive: true }); await writeFile(c.p.doubtSourcesFile(id), JSON.stringify(SRC_MISS));
  const out = await answerDoubt({ project: c.fx.root, epoch: c.epoch, id, file: c.p.doubtSourcesFile(id) }, c.deps);
  ok(out && typeof out === "object", `answer must return the output object, got ${out === undefined ? "undefined" : typeof out}`);
  eq([out.ok, out.cmd, out.doubt_id, out.step], [true, "doubt", id, "consult1"], "output head");
  ok(out.consult && typeof out.consult.unit === "string", "consult announced in advance");
}));

await test("sources miss: moves to consult1; consult = codex sol high via cli for a Claude-authored doubt, brief written, rationale 'no source answers'", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open();
  const out = await c.sources(id, SRC_MISS);
  eq(out.step, "consult1", "step");
  eq(out.consult?.unit, `u-doubt-consult-${id}-c1`, "consult unit id"); eq([out.consult?.runtime, out.consult?.model, out.consult?.effort], ["claude", "opus", "high"], "design cell");
  eq(out.consult?.via, "agent", "via"); ok(out.consult?.brief_path && await exists(out.consult.brief_path), "brief file written at consult.brief_path");
  eq((await c.doubtRec(id)).step, "consult1", "record step");
  eq((await c.unit(U1)).state, "reported", "unit stays reported while consulting");
}));

await test("consult origin: a Codex-authored doubt consults claude opus high via agent", async () => withRun({ units: [doubtingUnit({ worker: worker(CELL.codexMed) })] }, async (c) => {
  const { doubt_id: id } = await c.open();
  const out = await c.sources(id, SRC_MISS);
  eq([out.consult?.runtime, out.consult?.model, out.consult?.effort, out.consult?.via], ["claude", "opus", "high", "agent"], "consult cell for codex origin");
}));

await test("under drive the sources step is skipped: doubt open returns consult1 (astra high) and the brief tells the consultant to check the sources first", async () => withRun({ coordinator: "drive" }, async (c) => {
  const out = await c.open();
  eq(out.step, "consult1", "step"); eq([out.consult?.runtime, out.consult?.model, out.consult?.effort], ["claude", "opus", "high"], "design cell under drive");
  const brief = await readFile(out.consult.brief_path, "utf8");
  ok(/source|fuente|decision-log|FRD/i.test(brief), "the consult brief must tell the consultant to check the sources first");
  ok(brief.includes(DOUBT.question), "the brief carries the question");
}));

await test("consult1 agrees with the preferred option at confidence medium: decided_by consult1, doubt counted once in state.doubts_consulted", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open(); const s = await c.sources(id, SRC_MISS);
  const out = await c.consult(id, s, consultAnswer("opt-no", "medium", CELL.solHigh));
  eq(out.step, "decided", "step"); eq(out.decision?.value, "opt-no", "value"); eq(out.decision?.decided_by, "consult1", "decided_by");
  const rec = await c.doubtRec(id); eq(rec.consults.length, 1, "one consult recorded"); eq(rec.consults[0].answer?.decision, "opt-no", "consults[].answer is the parsed object");
  eq((await c.unit(U1)).state, "queued", "unit resumes"); eq((await c.readState()).doubts_consulted, 1, "doubts_consulted");
  ok((await c.events("doubt_consulted")).length >= 1, "journal doubt_consulted");
}));

await test("consult1 agrees but confidence low: not decided, goes to consult2 (claude opus xhigh via agent)", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open(); const s = await c.sources(id, SRC_MISS);
  const out = await c.consult(id, s, consultAnswer("opt-no", "low", CELL.solHigh));
  eq(out.step, "consult2", "step"); eq([out.consult?.runtime, out.consult?.model, out.consult?.effort, out.consult?.via], ["claude", "opus", "high", "agent"], "consult 2: fresh context, stable risk floor");
  eq(out.consult?.unit, `u-doubt-consult-${id}-c2`, "unit id");
}));

await test("consult1 disagrees with preferred, consult2 sides with consult1 (2 of 3, confidence >= medium): decided_by consult2 with the majority option", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open(); const s = await c.sources(id, SRC_MISS);
  const s2 = await c.consult(id, s, consultAnswer("opt-yes", "high", CELL.solHigh)); eq(s2.step, "consult2", "disagreement escalates");
  const { issueToken } = c.admission;
  const issued = issueToken(s2.consult.unit, "B", { file: c.p.admissionFile });
  const st = await c.readState();
  if (!st.units.some((u) => u.id === s2.consult.unit)) { st.units.push(mkUnit(s2.consult.unit, { kind: "doubt-consult", state: "running", frd: null, token_hash: issued.token_hash, worker: worker(CELL.opusXhigh) })); }
  else st.units = st.units.map((u) => (u.id === s2.consult.unit ? { ...u, state: "running", token_hash: issued.token_hash } : u));
  await c.stateMod.writeState(c.fx.root, st, { env: c.env });
  await refused(() => c.consult(id, s2, consultAnswer("opt-yes", "high", CELL.opusXhigh), { token: "WRONG-TOKEN" }), "a via:agent consult with a wrong token");
  eq((await c.doubtRec(id)).step, "consult2", "a refused answer changes nothing");
  const out = await c.consult(id, s2, consultAnswer("opt-yes", "medium", CELL.opusXhigh), { token: issued.token });
  eq(out.step, "decided", "step"); eq(out.decision?.value, "opt-yes", "majority option"); eq(out.decision?.decided_by, "consult2", "decided_by");
  eq((await c.doubtRec(id)).consults.length, 2, "two consults recorded");
}));

await test("three-way split: reversible preferred option becomes a recorded autonomous assumption", async () => withRun({}, async (c) => {
  const d3 = { ...DOUBT, options: [...DOUBT.options, { id: "opt-maybe", text: "paginate on demand" }] };
  const { doubt_id: id } = await c.open(d3); const s = await c.sources(id, SRC_MISS);
  const s2 = await c.consult(id, s, consultAnswer("opt-yes", "high", CELL.solHigh));
  const out = await c.consultAgent(id, s2, consultAnswer("opt-maybe", "high", CELL.opusXhigh));
  eq(out.step, "decided", "step"); const u = await c.unit(U1);
  eq([u.state, u.parked, u.pending_answer], ["queued", null, null], "reversible choice keeps integration unblocked");
  ok((await c.doubtRec(id)).assumption.revert, "reversal recorded");
}));

await test("a consult that returned no JSON (decision null, low confidence, reversible false) counts and advances the ladder; two of them choose a reversible assumption", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open(); const s = await c.sources(id, SRC_MISS);
  const none = (cell) => ({ decision: null, rationale: "consultant returned no answer", consulted: cell, confidence: "low", reversible: false });
  const s2 = await c.consult(id, s, none(CELL.solHigh)); eq(s2.step, "consult2", "advances to consult2");
  eq((await c.doubtRec(id)).consults.filter((x) => x.answer !== null).length, 1, "the non-answer is recorded as an answered consult (counts toward the cap)");
  const out = await c.consultAgent(id, s2, none(CELL.opusXhigh));
  eq(out.step, "decided", "step"); eq((await c.unit(U1)).parked, null, "unit unblocked by reversible assumption");
}));

await test("consult answer validation: a consult answer without confidence/reversible violates doubt-answer.schema and is refused", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open(); const s = await c.sources(id, SRC_MISS);
  await refused(() => c.consult(id, s, { decision: "opt-no", rationale: "x", consulted: CELL.solHigh }), "incomplete consult answer");
  await refused(() => c.consult(id, s, consultAnswer("opt-nonexistent", "high", CELL.solHigh)), "decision that is not an option id");
  eq((await c.doubtRec(id)).step, "consult1", "record unchanged");
}));

await test("sources answer with a decision that is not an option id is refused", async () => withRun({}, async (c) => {
  const { doubt_id: id } = await c.open();
  await refused(() => c.sources(id, { decision: "opt-zzz", rationale: "x:1", consulted: null }), "unknown option");
  eq((await c.doubtRec(id)).step, "sources", "record unchanged");
}));

// =====================================================================================================================
// caps, veto, never-decide
// =====================================================================================================================
await test("cap of 8 consulted doubts per build: with 8 already consulted a new doubt parks at once (drive, so no sources step)", async () => withRun({ coordinator: "drive", doubtsConsulted: 8, units: [doubtingUnit(), mkUnit("u-build-wo-01-002", { state: "queued" })] }, async (c) => {
  const out = await c.open(); eq(out.step, "decided", "cap exhausted -> reversible assumption, exit 0"); ok(!out.consult, "no consult");
  eq((await c.unit(U1)).parked, null, "unit can integrate");
}));

await test("below the cap (7 consulted) the ladder still consults", async () => withRun({ coordinator: "drive", doubtsConsulted: 7 }, async (c) => {
  eq((await c.open()).step, "consult1", "step");
}));

await test("deterministic veto: a doubt on an irreversible unit (zone r1) never reaches decided, even on a sources hit", async () => withRun({ units: [doubtingUnit({ zone: "r1", risk_rules: ["R1"] })] }, async (c) => {
  let out = await c.open(); const id = out.doubt_id;
  if (out.step === "sources") out = await c.sources(id, SRC_HIT);
  eq(out.step, "parked", "step (parked at open or at the sources answer, never decided)"); ok(out.decision == null, "no decision");
  const u = await c.unit(U1); eq([u.state, u.parked], ["parked", "owner_question"], "parked owner_question (irreversible never builds on assumption)");
  eq((await c.events("autonomous_decision")).length, 0, "no autonomous_decision journaled");
  ok(!(await c.decisionLog()).includes("Decidido sin el owner"), "nothing written to the decision log");
}));

await test("deterministic veto: consult1 agreeing with high confidence on an irreversible unit still parks", async () => withRun({ units: [doubtingUnit({ zone: "r1", risk_rules: ["R1"] })] }, async (c) => {
  let out = await c.open(); const id = out.doubt_id;
  if (out.step === "sources") out = await c.sources(id, SRC_MISS);
  if (out.step === "consult1") out = await c.consult(id, out, consultAnswer("opt-no", "high", CELL.solHigh));
  eq(out.step, "parked", "step"); eq((await c.unit(U1)).parked, "owner_question", "unit parked");
}));

// =====================================================================================================================
// park, writers, propagation, root rule
// =====================================================================================================================
const PARK_UNITS = () => [
  doubtingUnit({ zone: "r1", risk_rules: ["R1"] }),
  mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], depends_on: [U1] }),
  mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta", depends_on: ["u-build-wo-01-002"] }),
  mkUnit("u-build-wo-02-002", { wos: ["WO-02-002"], frd: "frd-02-beta" }),
];
await test("park: the unit and its dependsOn closure park, independent units continue; question in decisions.md; journal parked data; pending_answer set", async () => withRun({ units: PARK_UNITS() }, async (c) => {
  let s2 = await c.open(); const id = s2.doubt_id;
  if (s2.step === "sources") s2 = await c.sources(id, SRC_MISS);
  if (s2.step === "consult1") s2 = await c.consult(id, s2, consultAnswer("opt-no", "high", CELL.solHigh));
  eq(s2.step, "parked", "step");
  const u = await c.unit(U1); eq([u.state, u.parked, u.pending_answer], ["parked", "owner_question", id], "root unit");
  for (const dep of ["u-build-wo-01-002", "u-build-wo-02-001"]) { const d = await c.unit(dep); ok(d.state === "parked" || d.parked, `dependent ${dep} must park, got state=${d.state} parked=${d.parked}`); }
  const free = await c.unit("u-build-wo-02-002"); eq([free.state, free.parked], ["queued", null], "an independent unit is untouched");
  const dec = await c.decisionsFile("main"); ok(dec.includes(id) && dec.includes(DOUBT.question), "decisions.md carries the doubt id and the question");
  const ev = (await c.events("parked")); ok(ev.length >= 1, "journal parked event");
  eq(ev[0].data.unit, U1, "parked.data.unit"); eq(ev[0].data.reason, "owner_question", "parked.data.reason"); eq(ev[0].data.question, id, "parked.data.question");
  eq((await c.doubtRec(id)).step, "parked", "record step");
}));

await test("decisions.md tracked (Mission Control shape): the entry is written in the integration worktree, the main checkout file is not touched", async () => withRun({ preset: "tracked-decisions", units: PARK_UNITS() }, async (c) => {
  let a = await c.open(); const id = a.doubt_id;
  if (a.step === "sources") a = await c.sources(id, SRC_MISS);
  if (a.step === "consult1") a = await c.consult(id, a, consultAnswer("opt-no", "high", CELL.solHigh));
  eq(a.step, "parked", "step");
  ok((await c.decisionsFile("wt")).includes(id), "the tracked decisions.md in the integration worktree lists the doubt");
  ok(!(await c.decisionsFile("main")).includes(id), "the main checkout's tracked file must stay untouched");
  eq(c.git(c.fx.root, ["status", "--porcelain", "--", ".pandacorp/inbox/decisions.md"]), "", "main checkout clean");
}));

const ROOT_UNITS = (n) => [doubtingUnit(), ...Array.from({ length: n }, (_, i) => mkUnit(`u-build-wo-01-1${i}`, { wos: [`WO-01-1${i}`], depends_on: [i === 0 ? U1 : `u-build-wo-01-1${i - 1}`] })), mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta" })];
await test("option B: large reversible roots proceed with reason and reversal", async () => {
  for (const count of [4]) await withRun({ coordinator: "drive", doubtsConsulted: 8, units: ROOT_UNITS(count) }, async (c) => {
    const out = await c.open(); eq(out.step, "decided", "reversible root decided");
    const rec = await c.doubtRec(out.doubt_id);
    eq(rec.assumption.option, "opt-no", "preferred option retained");
    ok(rec.assumption.rationale && rec.assumption.revert, "reason and reversal persisted");
    eq((await c.unit(U1)).parked, null, "integration unblocked");
  });
});

await test("option B: a small reversible root proceeds without parking independent siblings", async () => withRun({ coordinator: "drive", doubtsConsulted: 8, units: ROOT_UNITS(1) }, async (c) => {
  const out = await c.open(); eq(out.step, "decided", "small root decided");
  eq((await c.unit(U1)).parked, null, "small root can integrate");
  eq((await c.unit("u-build-wo-02-001")).state, "queued", "independent sibling remains available");
  ok((await c.doubtRec(out.doubt_id)).assumption.revert, "small root reversal recorded");
}));

await test("root rule: an irreversible root never builds on assumption even when it drags > 50 %", async () => withRun({ coordinator: "drive", doubtsConsulted: 8, units: ROOT_UNITS(4).map((u) => (u.id === U1 ? { ...u, zone: "r1", risk_rules: ["R1"] } : u)) }, async (c) => {
  const out = await c.open(); eq(out.step, "parked", "step");
  eq((await c.doubtRec(out.doubt_id)).assumption, null, "no assumption on an irreversible root");
  eq((await c.unit(U1)).parked, "owner_question", "owner_question");
}));

await test("a doubt-consult unit's own doubt file cannot be opened as a doubt for an unknown unit (refused, nothing written)", async () => withRun({}, async (c) => {
  const openDoubt = await need("openDoubt"); const f = c.p.unitDoubtFile(U1);
  await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, JSON.stringify(DOUBT));
  await refused(() => openDoubt({ project: c.fx.root, epoch: c.epoch, unit: "u-build-wo-99-999", file: f }, c.deps), "unknown unit");
  eq((await c.events("doubt_opened")).length, 0, "nothing journaled");
}));

await test("option B: lone reversible units proceed, with independent siblings and in a single-unit scope", async () => {
  for (const [label, units] of [["siblings", undefined], ["single-unit scope", [doubtingUnit()]]]) {
    await withRun({ coordinator: "drive", doubtsConsulted: 8, ...(units ? { units } : {}) }, async (c) => {
      const out = await c.open(); eq(out.step, "decided", `${label}: step`);
      eq((await c.unit(U1)).parked, null, `${label}: parked owner_question`);
      ok((await c.doubtRec(out.doubt_id)).assumption.revert, `${label}: reversal documented`);
    });
  }
});

// =====================================================================================================================
// park.mjs (pure functions; contract: C10 report EXPORTS addendum, standard BUILD-12 Park / Root block)
// =====================================================================================================================
const parkMod = async () => { const m = await load("park.mjs"); if (m.__error) throw new Error(`plugin/runtime/build/park.mjs cannot be imported: ${m.__error.message}`); return m; };
const pfn = async (name) => { const m = await parkMod(); if (typeof m[name] !== "function") throw new Error(`park.mjs exports no function ${name} (exports: ${Object.keys(m).join(", ")})`); return m[name]; };
const pst = (units) => baseState({ units });
const chain = () => pst([mkUnit("a", { state: "reported" }), mkUnit("b", { depends_on: ["a"] }), mkUnit("c", { depends_on: ["b"] }), mkUnit("d"), mkUnit("e")]);
const code = async (fn, want, what) => { let err = null; try { await fn(); } catch (e) { err = e; } if (!err) throw new Error(`${what}: expected ${want}`); if (err.code !== want) throw new Error(`${what}: expected ${want}, got ${err.code}: ${err.message}`); };

await test("park constants: PARK_REASONS and ROOT_BLOCK_RATIO", async () => {
  const m = await parkMod(); eq(m.PARK_REASONS, ["owner_question", "built_on_assumption"], "PARK_REASONS"); eq(m.ROOT_BLOCK_RATIO, 0.5, "ROOT_BLOCK_RATIO");
});
await test("dependentsOf: transitive dependents through depends_on, self excluded, none for a leaf", async () => {
  const dependentsOf = await pfn("dependentsOf"); const st = chain();
  eq([...dependentsOf(st, "a")].sort(), ["b", "c"], "a drags b and c"); eq(dependentsOf(st, "c"), [], "leaf"); eq(dependentsOf(st, "d"), [], "independent");
});
await test("pendingUnits: non-terminal units, doubt-consult excluded", async () => {
  const pendingUnits = await pfn("pendingUnits");
  const st = pst([mkUnit("a"), mkUnit("l", { state: "landed" }), mkUnit("x", { state: "blocked" }), mkUnit("rv", { kind: "review", state: "verified" }), mkUnit("k", { kind: "doubt-consult", state: "running" }), mkUnit("p", { state: "parked", parked: "owner_question" })]);
  eq(pendingUnits(st).map((u) => u.id).sort(), ["a", "p"], "pending ids");
});
await test("rootBlock: ratio = pending dependents / all pending (root counts in the denominator only); isRoot is ratio > 0.5, exactly 0.5 is not a root", async () => {
  const rootBlock = await pfn("rootBlock");
  const r = rootBlock(chain(), "a"); eq([r.dragged.slice().sort(), r.pending, r.ratio, r.isRoot], [["b", "c"], 5, 0.4, false], "2 of 5");
  const half = rootBlock(pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] }), mkUnit("c")]) , "a"); ok(half.ratio < 0.5 && !half.isRoot, "1 of 3 is not a root");
  const even = rootBlock(pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] }), mkUnit("c", { depends_on: ["a"] }), mkUnit("d"), mkUnit("e")]), "a"); eq([even.ratio, even.isRoot], [0.4, false], "2 of 5");
  const four = rootBlock(pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] }), mkUnit("c", { depends_on: ["a"] }), mkUnit("d", { depends_on: ["a"] })]), "a"); eq([four.ratio, four.isRoot], [0.75, true], "3 of 4");
  const exact = rootBlock(pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] }), mkUnit("c"), mkUnit("d", { state: "landed" })]), "a"); eq([exact.pending, exact.ratio, exact.isRoot], [3, 1 / 3, false], "terminal units are not pending");
  const two = rootBlock(pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] })]), "a"); eq([two.ratio, two.isRoot], [0.5, false], "exactly 50 % is not more than 50 %");
  const lone = rootBlock(pst([mkUnit("a")]), "a"); eq([lone.dragged, lone.ratio, lone.isRoot], [[], 0, false], "a lone unit drags 0 %");
});
await test("parkOrAssume: assume every reversible technical choice; protected actions still park", async () => {
  const parkOrAssume = await pfn("parkOrAssume");
  const big = pst([mkUnit("a"), mkUnit("b", { depends_on: ["a"] }), mkUnit("c", { depends_on: ["b"] })]);
  eq(parkOrAssume(big, "a", { reversible: true }).mode, "assume", "reversible root"); eq(parkOrAssume(big, "a", { reversible: false }).mode, "park", "irreversible root");
  eq(parkOrAssume(chain(), "a", { reversible: true }).mode, "assume", "40 % drag"); eq(parkOrAssume(pst([mkUnit("a")]), "a", { reversible: true }).mode, "assume", "lone unit");
  ok(parkOrAssume(big, "a", { reversible: true }).block.isRoot === true, "block returned");
});
await test("parkUnits: self from reported, dependents only from queued|admitted (a running dependent is skipped), events journaled, input state not mutated", async () => {
  const parkUnits = await pfn("parkUnits");
  const st = pst([mkUnit("a", { state: "reported" }), mkUnit("b", { depends_on: ["a"] }), mkUnit("c", { depends_on: ["a"], state: "running" }), mkUnit("d")]);
  const before = JSON.stringify(st);
  const out = parkUnits(st, "a", { reason: "owner_question", question: "d-0009" });
  eq(JSON.stringify(st), before, "pure: input untouched");
  const by = Object.fromEntries(out.state.units.map((u) => [u.id, u]));
  eq([by.a.state, by.a.parked, by.a.pending_answer], ["parked", "owner_question", "d-0009"], "self");
  eq([by.b.state, by.b.parked, by.b.pending_answer], ["parked", "owner_question", "d-0009"], "queued dependent");
  eq(by.c.state, "running", "a running dependent is not parked"); eq(out.skipped.map((x) => x.unit), ["c"], "reported as skipped"); eq(by.d.state, "queued", "independent untouched");
  eq(out.parked.map((x) => x.unit).sort(), ["a", "b"], "parked list"); ok(Array.isArray(out.events) && out.events.length >= 2, "events returned for the journal");
  const alone = parkUnits(st, "a", { reason: "owner_question", question: "d-0009", dependents: false }); eq(alone.state.units.find((u) => u.id === "b").state, "queued", "dependents:false leaves them");
});
await test("parkUnits: bad reason is INVALID_INPUT; unknown unit or a unit that cannot be parked (landed) is INVALID_STATE", async () => {
  const parkUnits = await pfn("parkUnits"); const st = pst([mkUnit("a", { state: "reported" }), mkUnit("l", { state: "landed" })]);
  await code(() => parkUnits(st, "a", { reason: "because", question: "d-1" }), "INVALID_INPUT", "bad reason");
  await code(() => parkUnits(st, "zzz", { reason: "owner_question", question: "d-1" }), "INVALID_STATE", "unknown unit");
  await code(() => parkUnits(st, "l", { reason: "owner_question", question: "d-1" }), "INVALID_STATE", "landed unit");
});
await test("assumeUnits: the root goes to queued; it and its non-terminal dependents carry parked built_on_assumption + pending_answer", async () => {
  const assumeUnits = await pfn("assumeUnits");
  const st = pst([mkUnit("a", { state: "reported" }), mkUnit("b", { depends_on: ["a"] }), mkUnit("t", { depends_on: ["a"], state: "landed" }), mkUnit("d")]);
  const out = assumeUnits(st, "a", { question: "d-0003" }); const by = Object.fromEntries(out.state.units.map((u) => [u.id, u]));
  eq([by.a.state, by.a.parked, by.a.pending_answer], ["queued", "built_on_assumption", "d-0003"], "root");
  eq([by.b.parked, by.b.pending_answer], ["built_on_assumption", "d-0003"], "dependent"); eq(by.t.parked, null, "terminal dependent untouched"); eq(by.d.parked, null, "independent untouched");
  eq(out.units.slice().sort(), ["a", "b"], "units list"); ok(Array.isArray(out.events), "events");
});
await test("assumptionUnits: the units built on a doubt's assumption", async () => {
  const assumptionUnits = await pfn("assumptionUnits");
  const st = pst([mkUnit("a", { parked: "built_on_assumption", pending_answer: "d-1" }), mkUnit("b", { parked: "built_on_assumption", pending_answer: "d-2" }), mkUnit("c", { parked: "owner_question", pending_answer: "d-1", state: "parked" })]);
  eq(assumptionUnits(st, "d-1").map((u) => u.id), ["a"], "only the built_on_assumption units of that doubt");
});
await test("releaseParked: owner_question units of that question go back to queued, cleared; other questions and assumption units untouched", async () => {
  const releaseParked = await pfn("releaseParked");
  const st = pst([mkUnit("a", { state: "parked", parked: "owner_question", pending_answer: "d-1" }), mkUnit("b", { state: "parked", parked: "owner_question", pending_answer: "d-1" }),
    mkUnit("o", { state: "parked", parked: "owner_question", pending_answer: "d-2" }), mkUnit("s", { parked: "built_on_assumption", pending_answer: "d-1" })]);
  const out = releaseParked(st, "d-1"); const by = Object.fromEntries(out.state.units.map((u) => [u.id, u]));
  eq(out.units.slice().sort(), ["a", "b"], "released ids"); eq([by.a.state, by.a.parked, by.a.pending_answer], ["queued", null, null], "released");
  eq([by.o.state, by.o.parked], ["parked", "owner_question"], "other question untouched"); eq(by.s.parked, "built_on_assumption", "assumption unit untouched");
});
await test("createAssumeBranch: creates lane/<run>/assume-<doubt> at the integration HEAD and is idempotent", async () => withRun({}, async (c) => {
  const createAssumeBranch = await pfn("createAssumeBranch"); const branch = c.p.assumeBranch(RUN, "d-0001");
  const a = await createAssumeBranch({ integrationRoot: c.p.integrationWorktree, branch }, c.deps);
  eq([a.branch, a.created], [branch, true], "first call creates"); eq(a.sha, c.git(c.p.integrationWorktree, ["rev-parse", "HEAD"]), "branched from the integration HEAD");
  eq(c.fx.git("rev-parse", `refs/heads/${branch}`), a.sha, "ref exists");
  const b = await createAssumeBranch({ integrationRoot: c.p.integrationWorktree, branch }, c.deps); eq([b.created, b.sha], [false, a.sha], "second call is a no-op");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
