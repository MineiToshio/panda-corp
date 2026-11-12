#!/usr/bin/env node
// test-build-v2-answer.mjs: T-C10 (part 2), the official test of plugin/runtime/build/answers.mjs (`answer`, kinds ask|parked|gate).
// Written from the contracts only (PLAN 5.2 row C10, 3.16 A20, RESOLUTIONS D19, CLI doc 3.13, standard BUILD-12/BUILD-13,
// schemas doubt / state / journal-event). Run: node plugin/scripts/test-build-v2-answer.mjs
//
// ASSUMED INTERFACE (the docs fix the CLI shape, not the export names; the orchestrator reconciles test and module):
//   answers.mjs  answer({project, epoch, question, value}, deps?) -> Promise<{ok:true, cmd:"answer", question, kind:"ask|parked|gate",
//                applied: boolean, units:[{unit, effect}], reason: string|null}>   (aliases tried: answerQuestion, recordAnswer, applyAnswer, answerCommand).
//                `value` is the JSON TEXT of --value (e.g. '"opt-no"', 'true'): the command parses it, as the CLI does. Refusals are thrown errors: error.exit === 6 or a code
//                matching INVALID/ANSWER/QUESTION/GATE/REFUS; a stale epoch is code FENCE (exit 3).
//   deps         {env, clock}.
//   Question lookup: asks come from build/preflight.json (the documented `start --preflight` output: checks[{id, status:"ask", question:{id,text_es,
//                default_es,default_action,affects,reversible}}], need_from_owner[]) and from the units' pending_answer; parks from build/doubts/<id>.json (doubt.schema);
//                gates from `g-<unit id>` of a unit in state waiting_gate with waiting_gate money|delete|external|production.
//   Ask default: the question's `default_action` (a string here). A unit whose pending_answer is the id and that is still `queued` is
//                `unblocked`; one past dispatch (`integrated`) already ran on the default: equal answer -> none_default_matches, different and
//                `reversible` -> rework_queued (a `patch` unit queued for that unit's WOs).
//   Park / assumption: the units' parked/pending_answer fields (a parked dependent carries pending_answer = the doubt id, as park.mjs sets it when a doubt parks); a built-on-assumption root has parked "built_on_assumption", doubt_id set,
//                the doubt record carries assumption {option, branch = paths.assumeBranch(run, id)}; the branch exists in git.
//   Gate answered false: unit and dependents `blocked`, build/handback/<unit>.md contains "owner refused gate".
//   Brief regeneration happens at dispatch; when a brief file is already on disk it must carry the answer.
//   applyStartAnswers(state, {answers, questions: Map}) and readAnswersArg(raw, deps) per the C10 report EXPORTS addendum.
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
const NAMES = { answer: ["answer", "answerQuestion", "recordAnswer", "applyAnswer", "answerCommand"] };
const need = async (key) => {
  const mod = await load("answers.mjs");
  if (mod.__error) throw Object.assign(new Error(`plugin/runtime/build/answers.mjs cannot be imported: ${mod.__error.message}`), { loader: true });
  for (const name of NAMES[key]) if (typeof mod[name] === "function") return mod[name];
  throw Object.assign(new Error(`plugin/runtime/build/answers.mjs exports none of ${NAMES[key].join("|")} (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`), { loader: true });
};
const sib = async (file) => { const m = await load(file); if (m.__error) throw new Error(`settled module ${file} cannot be imported: ${m.__error.message}`); return m; };
const fixturesMod = async () => import(pathToFileURL(FIXTURES).href);
const buildStateMod = async () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);

const refused = async (fn, what) => {
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a refusal (exit 6), but the call succeeded`);
  if (err.loader) throw new Error(`${what}: ${err.message}`);
  if (err instanceof TypeError || err instanceof ReferenceError) throw new Error(`${what}: crash instead of a refusal: ${err.message}`);
  const isSix = err.exit === 6 || err.exitCode === 6 || /INVALID|ANSWER|QUESTION|GATE|REFUS|BAD|TOKEN/i.test(String(err.code || ""));
  if (!isSix) throw new Error(`${what}: expected exit 6 / an INVALID-style code, got code=${err.code || "(none)"} exit=${err.exit}: ${err.message}`);
  return err;
};

const RUN = "run-c10a";
const NOW = "2026-11-11T12:00:00.000Z";
const FRD = "frd-01-alpha";
const CELL = { sonnetHigh: { runtime: "claude", model: "sonnet", effort: "high" } };
const mkUnit = (id, over = {}) => ({
  id, kind: "build", wos: [], frd: FRD, chain: null, zone: "none", risk_rules: [], state: "queued", attempt: 1, token_hash: null,
  worker: { ...CELL.sonnetHigh, via: "agent", pid: null, worker_id: null }, worktree: null, branch: null, depends_on: [], pending_answer: null,
  parked: null, waiting_gate: null, evidence_hash: null, doubt_id: null, test_hashes: {}, probe_hashes: {}, review: null, ...over,
});
const baseState = (over = {}) => ({
  schema: 2, engine: "v2", run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature", status: "active", status_reason: null,
  tranche: null, scope: { card: null, frds: [FRD], wos: ["WO-01-001"], out_of_scope: [] },
  integration: { branch: `lane/${RUN}/integration`, worktree: "/nonexistent", base_sha: "a".repeat(40) },
  last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {}, ...over,
});
const Q_ID = "q-access.test-db";
const Q = { id: Q_ID, text_es: "La base de pruebas no responde. Que hago?", default_es: "Sigo sin ella", default_action: "skip", affects: { wos: ["WO-01-001"] }, reversible: true };
const DOUBT_ID = "d-0007";
const doubtRecord = (over = {}) => ({
  schema: 1, id: DOUBT_ID, unit: "u-build-wo-01-001", opened_at: NOW, question: "Paginate the alpha list?",
  options: [{ id: "opt-yes", text: "yes" }, { id: "opt-no", text: "no" }], preferred: "opt-no", why: "FRD silent", step: "parked",
  consults: [], decision: null, assumption: null, ...over,
});

const withRun = async (opts, fn) => {
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c10a-"));
  const { createFixture, git } = await fixturesMod();
  const fx = await createFixture("basic", { dir });
  const savedEnv = { ...process.env };
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" });
  try {
    const env = fx.env();
    const { buildPaths } = await sib("paths.mjs");
    const stateMod = await sib("state.mjs");
    const journalMod = await sib("journal.mjs");
    const bs = await buildStateMod();
    const lease = await bs.acquire(fx.root, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
    const p = buildPaths(fx.root, { env });
    const branch = p.integrationBranch(RUN);
    fx.git("worktree", "add", "-q", "-b", branch, p.integrationWorktree);
    await stateMod.writeState(fx.root, baseState({ epoch: lease.epoch, answers: opts.answers || {}, units: opts.units || [],
      integration: { branch, worktree: p.integrationWorktree, base_sha: fx.sha } }), { env });
    if (opts.questions) { await mkdir(path.dirname(p.preflightFile), { recursive: true }); await writeFile(p.preflightFile, `${JSON.stringify({ ok: true, cmd: "start", mode: "preflight", elapsed_ms: 10, checks: opts.questions.map((q) => ({ group: "access", id: q.id.replace(/^q-/, ""), status: "ask", detail_es: "pregunta de prueba", question: q })), need_from_owner: opts.questions.map((q) => q.id), announce: {}, drive_armable: false, drive_block_reason: null }, null, 2)}\n`); }
    if (opts.doubt) { await mkdir(p.doubtsDir, { recursive: true }); await writeFile(p.doubtFile(opts.doubt.id), `${JSON.stringify(opts.doubt, null, 2)}\n`); }
    if (opts.assumeBranch) {
      const tree = fx.git("rev-parse", "HEAD^{tree}"); const commit = fx.git("commit-tree", tree, "-p", "HEAD", "-m", "assume: root block work");
      fx.git("branch", p.assumeBranch(RUN, opts.assumeBranch), commit);
      opts.assumeCommit = commit;
    }
    const deps = { env, clock: () => new Date(NOW) };
    const ctx = {
      fx, env, p, lease, epoch: lease.epoch, deps, git, branch, stateMod, assumeCommit: opts.assumeCommit,
      readState: () => stateMod.readState(fx.root, { env }),
      unit: async (id) => (await stateMod.readState(fx.root, { env })).units.find((u) => u.id === id),
      setUnit: async (id, patch) => { const st = await stateMod.readState(fx.root, { env }); st.units = st.units.map((u) => (u.id === id ? { ...u, ...patch } : u)); await stateMod.writeState(fx.root, st, { env }); },
      events: async (type) => (await journalMod.readJournal(p.journalFile)).events.filter((e) => !type || e.type === type),
      doubtRec: async (id) => JSON.parse(await readFile(p.doubtFile(id), "utf8")),
      snapshot: async () => JSON.stringify({ s: await stateMod.readState(fx.root, { env }), e: (await journalMod.readJournal(p.journalFile)).events.length }),
      ans: async (question, value, { epoch = lease.epoch, raw } = {}) => (await need("answer"))({ project: fx.root, epoch, question, ...(value === undefined && raw === undefined ? {} : { value: raw !== undefined ? raw : JSON.stringify(value) }) }, deps),
      effects: (out) => Object.fromEntries((out.units || []).map((x) => [x.unit, x.effect])),
    };
    return await fn(ctx);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true });
  }
};

const U_ASK = "u-build-wo-01-001";
const askUnits = (over = {}) => [mkUnit(U_ASK, { wos: ["WO-01-001"], pending_answer: Q_ID, ...over }), mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], pending_answer: "q-other.thing" }), mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta" })];

// =====================================================================================================================
// ask
// =====================================================================================================================
await test("ask: value stored in state.answers, answer_recorded journaled, pending unit unblocked, unrelated units untouched; output shape", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  const out = await c.ans(Q_ID, "include");
  eq([out.ok, out.cmd, out.question, out.kind, out.applied, out.reason], [true, "answer", Q_ID, "ask", true, null], "output head");
  eq(c.effects(out), { [U_ASK]: "unblocked" }, "effects (only the unit whose pending_answer is the id)");
  const st = await c.readState(); eq(st.answers[Q_ID], "include", "state.answers");
  const u = st.units.find((x) => x.id === U_ASK); eq([u.state, u.pending_answer], ["queued", null], "unit eligible again, pending_answer cleared");
  eq(st.units.find((x) => x.id === "u-build-wo-01-002").pending_answer, "q-other.thing", "a unit waiting on another question stays last (pending_answer kept)");
  const ev = await c.events("answer_recorded"); eq(ev.length, 1, "one answer_recorded");
  eq([ev[0].data.question, ev[0].data.kind, ev[0].data.value], [Q_ID, "ask", "include"], "event data"); eq(ev[0].data.units, [{ unit: U_ASK, effect: "unblocked" }], "event units");
}));

await test("ask: a boolean and an object value are stored verbatim", async () => withRun({ questions: [{ ...Q, default_action: false }], units: askUnits() }, async (c) => {
  await c.ans(Q_ID, true); eq((await c.readState()).answers[Q_ID], true, "boolean stored");
}));

await test("ask: unit already ran on the default and the answer equals it -> none_default_matches, nothing changes for it", async () => withRun({ questions: [Q], units: askUnits({ state: "integrated" }) }, async (c) => {
  const out = await c.ans(Q_ID, "skip");
  eq(c.effects(out)[U_ASK], "none_default_matches", "effect");
  const u = await c.unit(U_ASK); eq(u.state, "integrated", "state untouched");
  eq((await c.readState()).units.some((x) => x.kind === "patch"), false, "no patch unit");
}));

await test("ask: unit already ran on the default, answer differs, question reversible -> rework_queued with a patch unit queued", async () => withRun({ questions: [Q], units: askUnits({ state: "integrated" }) }, async (c) => {
  const out = await c.ans(Q_ID, "include");
  eq(c.effects(out)[U_ASK], "rework_queued", "effect");
  const patch = (await c.readState()).units.find((x) => x.kind === "patch"); ok(patch, "a patch unit must be queued");
  eq([patch.state, patch.wos], ["queued", ["WO-01-001"]], "patch unit queued for the WO that ran on the default");
}));

await test("ask idempotence: the same value again -> applied false / already_answered (exit 0), nothing changes", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  await c.ans(Q_ID, "include"); const before = await c.snapshot();
  const again = await c.ans(Q_ID, "include");
  eq([again.applied, again.reason], [false, "already_answered"], "second call");
  eq(await c.snapshot(), before, "state and journal untouched");
}));

await test("ask: a different value after the units acted on the first -> applied false / superseded_by_earlier_answer, nothing changes", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  await c.ans(Q_ID, "include"); await c.setUnit(U_ASK, { state: "integrated" });
  const before = await c.snapshot();
  const again = await c.ans(Q_ID, "exclude");
  eq([again.applied, again.reason], [false, "superseded_by_earlier_answer"], "second call");
  eq(await c.snapshot(), before, "state and journal untouched");
  eq((await c.readState()).answers[Q_ID], "include", "the first answer stands");
}));

await test("ask: a different second answer BEFORE any unit acted REPLACES the first (C2): applied, state.answers overwritten, new answer_recorded, unit still unblocked", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  await c.ans(Q_ID, "include");
  const again = await c.ans(Q_ID, "exclude");
  eq([again.applied, again.reason], [true, null], "the second, different answer is applied");
  eq((await c.readState()).answers[Q_ID], "exclude", "the new value replaces the first");
  const ev = await c.events("answer_recorded"); eq(ev.length, 2, "two answer_recorded events");
  eq(ev[1].data.value, "exclude", "latest event carries the replacement");
  eq((await c.unit(U_ASK)).state, "queued", "the unit has not acted, it stays queued (its brief is written at dispatch with the new value)");
}));
await test("ask: once a unit acted on the first answer (admitted/running), a different second answer is refused as superseded_by_earlier_answer and the first stands", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  await c.ans(Q_ID, "include"); await c.setUnit(U_ASK, { state: "running" }); const before = await c.snapshot();
  const again = await c.ans(Q_ID, "exclude");
  eq([again.applied, again.reason], [false, "superseded_by_earlier_answer"], "a unit past queued already acted");
  eq(await c.snapshot(), before, "state and journal untouched"); eq((await c.readState()).answers[Q_ID], "include", "first answer stands");
}));
await test("unknown question id is refused (exit 6) and changes nothing", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  const before = await c.snapshot();
  await refused(() => c.ans("q-does.not.exist", "x"), "unknown id");
  eq(await c.snapshot(), before, "state and journal untouched");
}));

const usage = async (fn, what) => {
  let err = null; try { await fn(); } catch (e) { err = e; }
  if (!err) throw new Error(`${what}: expected a usage error (exit 2)`);
  if (err.loader) throw new Error(`${what}: ${err.message}`);
  if (!(err.code === "USAGE" || err.exit === 2 || err.exitCode === 2)) throw new Error(`${what}: expected USAGE / exit 2, got code=${err.code} exit=${err.exit}: ${err.message}`);
};
await test("a missing --value, or a --value that is not valid JSON, is a usage error (exit 2) and changes nothing", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  const before = await c.snapshot();
  await usage(() => c.ans(Q_ID, undefined), "no value"); await usage(() => c.ans(Q_ID, undefined, { raw: "{not json" }), "garbage value");
  eq(await c.snapshot(), before, "nothing stored");
}));

await test("fence: a stale epoch is rejected with FENCE (exit 3) and nothing changes", async () => withRun({ questions: [Q], units: askUnits() }, async (c) => {
  const before = await c.snapshot(); let err = null;
  try { await c.ans(Q_ID, "include", { epoch: c.epoch + 4 }); } catch (e) { err = e; }
  ok(err, "a wrong epoch must throw"); if (err.loader) throw new Error(err.message);
  ok(err.code === "FENCE" || err.exit === 3, `expected FENCE / exit 3, got code=${err.code} exit=${err.exit}: ${err.message}`);
  eq(await c.snapshot(), before, "untouched");
}));

// =====================================================================================================================
// parked
// =====================================================================================================================
const parkedUnits = () => [
  mkUnit("u-build-wo-01-001", { wos: ["WO-01-001"], state: "parked", parked: "owner_question", pending_answer: DOUBT_ID, doubt_id: DOUBT_ID }),
  mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], state: "parked", parked: "owner_question", pending_answer: DOUBT_ID, depends_on: ["u-build-wo-01-001"] }),
  mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta" }),
];
await test("parked: an option id releases the unit and its dependents (back to queued, parked and pending_answer cleared); doubt decided by owner", async () => withRun({ doubt: doubtRecord(), units: parkedUnits() }, async (c) => {
  const out = await c.ans(DOUBT_ID, "opt-yes");
  eq([out.kind, out.applied], ["parked", true], "kind/applied");
  for (const id of ["u-build-wo-01-001", "u-build-wo-01-002"]) { const u = await c.unit(id); eq([u.state, u.parked, u.pending_answer], ["queued", null, null], `${id} released`); }
  const eff = c.effects(out); eq(eff["u-build-wo-01-001"], "released", "root effect"); eq(eff["u-build-wo-01-002"], "released", "dependent effect (units[] lists every affected unit)");
  eq((await c.unit("u-build-wo-02-001")).state, "queued", "an independent unit is untouched");
  const rec = await c.doubtRec(DOUBT_ID); eq(rec.step, "decided", "doubt step"); eq(rec.decision, { value: "opt-yes", why: "owner answer", decided_by: "owner" }, "doubt decision");
  const { loadSchema, validate } = await sib("fsx.mjs"); ok(validate(await loadSchema("doubt"), rec).ok, "the updated record still validates against doubt.schema");
  eq((await c.readState()).answers[DOUBT_ID], "opt-yes", "state.answers");
  eq((await c.events("answer_recorded"))[0].data.kind, "parked", "journal kind");
}));

await test("parked: a value that is not an option id of the doubt is refused and changes nothing; non-string value too", async () => withRun({ doubt: doubtRecord(), units: parkedUnits() }, async (c) => {
  const before = await c.snapshot();
  await refused(() => c.ans(DOUBT_ID, "opt-zzz"), "unknown option");
  await refused(() => c.ans(DOUBT_ID, true), "boolean for a parked doubt");
  eq(await c.snapshot(), before, "untouched"); eq((await c.doubtRec(DOUBT_ID)).step, "parked", "doubt record untouched");
}));

await test("parked idempotence: the same option again -> already_answered", async () => withRun({ doubt: doubtRecord(), units: parkedUnits() }, async (c) => {
  await c.ans(DOUBT_ID, "opt-yes"); const before = await c.snapshot();
  const again = await c.ans(DOUBT_ID, "opt-yes");
  eq([again.applied, again.reason], [false, "already_answered"], "second call"); eq(await c.snapshot(), before, "untouched");
}));

// =====================================================================================================================
// built on assumption
// =====================================================================================================================
const assumeUnits = () => [
  mkUnit("u-build-wo-01-001", { wos: ["WO-01-001"], state: "integrated", parked: "built_on_assumption", pending_answer: DOUBT_ID, doubt_id: DOUBT_ID }),
  mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], state: "integrated", parked: "built_on_assumption", pending_answer: DOUBT_ID, depends_on: ["u-build-wo-01-001"] }),
];
const assumeDoubt = () => doubtRecord({ assumption: { option: "opt-no", branch: `lane/${RUN}/assume-${DOUBT_ID}` } });
const isMerged = (c) => { try { c.fx.git("merge-base", "--is-ancestor", c.assumeCommit, c.branch); return true; } catch { return false; } };
await test("built on assumption, answer equals the assumed option -> assumption_accepted: units leave parked, the branch is kept (merged by the next chain integration, not by answer)", async () => withRun({ doubt: assumeDoubt(), units: assumeUnits(), assumeBranch: DOUBT_ID }, async (c) => {
  const out = await c.ans(DOUBT_ID, "opt-no");
  eq(c.effects(out)["u-build-wo-01-001"], "assumption_accepted", "root effect");
  for (const id of ["u-build-wo-01-001", "u-build-wo-01-002"]) eq((await c.unit(id)).parked, null, `${id} no longer parked`);
  const rec = await c.doubtRec(DOUBT_ID); eq([rec.step, rec.decision?.value, rec.decision?.decided_by], ["decided", "opt-no", "owner"], "doubt decided by owner");
  eq(c.fx.git("rev-parse", "--verify", `refs/heads/${c.p.assumeBranch(RUN, DOUBT_ID)}`), c.assumeCommit, "assume branch still exists at its commit");
  ok(!isMerged(c), "answer itself does not merge the assume branch into the integration branch");
}));

await test("built on assumption, any other option (DEC-7) -> assumption_discarded: dispatched units re-queued at attempt+1 with a fresh branch, branch work never merged", async () => withRun({ doubt: assumeDoubt(), units: assumeUnits(), assumeBranch: DOUBT_ID }, async (c) => {
  const out = await c.ans(DOUBT_ID, "opt-yes");
  eq(c.effects(out)["u-build-wo-01-001"], "assumption_discarded", "root effect");
  for (const id of ["u-build-wo-01-001", "u-build-wo-01-002"]) { const u = await c.unit(id); eq([u.state, u.parked, u.attempt], ["queued", null, 2], `${id} re-queued at attempt+1 (it ran on the rejected assumption)`); eq([u.branch, u.worktree, u.worker?.worker_id ?? null], [null, null, null], `${id} carries no branch/worktree/worker: the next dispatch derives a fresh branch`); }
  const brief = await readFile(c.p.briefFile("u-build-wo-01-001"), "utf8").catch(() => null);
  if (brief !== null) ok(brief.includes("opt-yes"), "a brief on disk must carry the owner's answer");
  const rec = await c.doubtRec(DOUBT_ID); eq([rec.step, rec.decision?.value], ["decided", "opt-yes"], "doubt decided with the owner's option");
  ok(!isMerged(c), "the discarded assumption branch is never merged into the integration branch");
}));

await test("built on assumption rejected, a never-dispatched unit only loses its flags: attempt unchanged (DEC-7)", async () => withRun({ doubt: assumeDoubt(), units: [mkUnit("u-build-wo-01-001", { wos: ["WO-01-001"], state: "queued", worker: null, parked: "built_on_assumption", pending_answer: DOUBT_ID, doubt_id: DOUBT_ID })], assumeBranch: DOUBT_ID }, async (c) => {
  const out = await c.ans(DOUBT_ID, "opt-yes");
  eq(c.effects(out)["u-build-wo-01-001"], "assumption_discarded", "effect");
  const u = await c.unit("u-build-wo-01-001"); eq([u.state, u.parked, u.pending_answer, u.attempt], ["queued", null, null, 1], "flags cleared, attempt kept");
}));

await test("built on assumption rejected at attempt 3 (DEC-7) -> handed_back answer_rework_budget: unit and dependents blocked (R4), never re-queued, branch never merged", async () => withRun({
  doubt: assumeDoubt(), assumeBranch: DOUBT_ID,
  units: [
    mkUnit("u-build-wo-01-001", { wos: ["WO-01-001"], state: "integrated", attempt: 3, parked: "built_on_assumption", pending_answer: DOUBT_ID, doubt_id: DOUBT_ID }),
    mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], state: "integrated", parked: "built_on_assumption", pending_answer: DOUBT_ID, depends_on: ["u-build-wo-01-001"] }),
    mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta" }),
  ],
}, async (c) => {
  const out = await c.ans(DOUBT_ID, "opt-yes");
  eq(c.effects(out)["u-build-wo-01-001"], "handed_back", "root effect");
  eq((await c.unit("u-build-wo-01-001")).state, "blocked", "unit blocked");
  const dep = await c.unit("u-build-wo-01-002"); ok(dep.state === "blocked" && dep.parked !== "owner_question", `dependent blocked, never parked (got ${dep.state}/${dep.parked})`);
  eq((await c.unit("u-build-wo-02-001")).state, "queued", "independent unit untouched");
  const hb = (await c.events("handback")).find((e) => e.data.unit === "u-build-wo-01-001");
  ok(hb, "a handback event for the root unit"); eq(hb.data.reason_code, "answer_rework_budget", "reason_code");
  ok(await exists(c.p.handbackFile("u-build-wo-01-001")), "handback file written");
  const rec = await c.doubtRec(DOUBT_ID); eq(rec.decision?.value, "opt-yes", "the owner's answer is recorded");
  ok(!isMerged(c), "the rejected assumption branch is never merged");
}));

// =====================================================================================================================
// gates
// =====================================================================================================================
const G_UNIT = "u-build-wo-01-001";
const gateUnits = (kind = "money") => [
  mkUnit(G_UNIT, { wos: ["WO-01-001"], state: "waiting_gate", waiting_gate: kind, pending_answer: `g-${G_UNIT}` }),
  mkUnit("u-build-wo-01-002", { wos: ["WO-01-002"], depends_on: [G_UNIT] }),
  mkUnit("u-build-wo-02-001", { wos: ["WO-02-001"], frd: "frd-02-beta" }),
];
for (const kind of ["money", "delete", "external"]) {
  await test(`gate ${kind}: true is the owner's recorded OK; the unit leaves waiting_gate (released, queued), answers stored, journal kind gate`, async () => withRun({ units: gateUnits(kind) }, async (c) => {
    const out = await c.ans(`g-${G_UNIT}`, true);
    eq([out.kind, out.applied], ["gate", true], "kind/applied"); eq(c.effects(out)[G_UNIT], "released", "effect");
    const u = await c.unit(G_UNIT); eq([u.state, u.waiting_gate, u.pending_answer], ["queued", null, null], "gate cleared");
    eq((await c.readState()).answers[`g-${G_UNIT}`], true, "OK recorded in state.answers");
    eq((await c.events("answer_recorded"))[0].data.kind, "gate", "journal kind");
    const brief = await readFile(c.p.briefFile(G_UNIT), "utf8").catch(() => null);
    if (brief !== null) ok(brief.includes(`g-${G_UNIT}`), "a brief on disk carries the owner's OK (question id)");
  }));
}

await test("gate false: the unit is handed back (blocked, reason 'owner refused gate'), its dependents blocked (never parked), independent units continue", async () => withRun({ units: gateUnits("money") }, async (c) => {
  const out = await c.ans(`g-${G_UNIT}`, false);
  eq(c.effects(out)[G_UNIT], "refused", "effect");
  const u = await c.unit(G_UNIT); eq(u.state, "blocked", "unit blocked (R4: a hand-back is blocked, never parked)");
  eq((await c.unit("u-build-wo-01-002")).state, "blocked", "dependent blocked");
  eq((await c.unit("u-build-wo-02-001")).state, "queued", "independent unit untouched");
  ok(await exists(c.p.handbackFile(G_UNIT)), "handback file written"); ok(/owner refused gate/.test(await readFile(c.p.handbackFile(G_UNIT), "utf8")), "handback names the reason 'owner refused gate'");
  eq((await c.readState()).answers[`g-${G_UNIT}`], false, "refusal recorded");
}));

await test("gate false hands back with reason_code owner_refused_gate (journal handback event) and the Spanish reason text", async () => withRun({ units: gateUnits("money") }, async (c) => {
  await c.ans(`g-${G_UNIT}`, false);
  const hb = (await c.events("handback")).find((e) => e.data.unit === G_UNIT);
  ok(hb, "a handback event for the gated unit");
  eq(hb.data.reason_code, "owner_refused_gate", "reason_code");
  ok((await readFile(c.p.handbackFile(G_UNIT), "utf8")).includes("el owner rechazó la puerta humana"), "owner-facing Spanish reason in handback/<unit>.md");
}));
await test("gate: a different second answer replaces the first before the unit acted (true then false -> refused)", async () => withRun({ units: gateUnits("money") }, async (c) => {
  await c.ans(`g-${G_UNIT}`, true);
  const again = await c.ans(`g-${G_UNIT}`, false);
  eq([again.applied, c.effects(again)[G_UNIT]], [true, "refused"], "the unit was only queued: false replaces true and hands it back");
  eq((await c.unit(G_UNIT)).state, "blocked", "unit blocked"); eq((await c.readState()).answers[`g-${G_UNIT}`], false, "replacement recorded");
}));
await test("gate: a non-boolean value is refused and changes nothing", async () => withRun({ units: gateUnits("money") }, async (c) => {
  const before = await c.snapshot();
  await refused(() => c.ans(`g-${G_UNIT}`, "yes"), "string for a gate"); await refused(() => c.ans(`g-${G_UNIT}`, 1), "number for a gate");
  eq(await c.snapshot(), before, "untouched");
}));

await test("gate idempotence: true twice -> already_answered; false after true once the unit moved on -> superseded_by_earlier_answer", async () => withRun({ units: gateUnits("delete") }, async (c) => {
  await c.ans(`g-${G_UNIT}`, true);
  eq((await c.ans(`g-${G_UNIT}`, true)).reason, "already_answered", "same value");
  await c.setUnit(G_UNIT, { state: "integrated" }); const before = await c.snapshot();
  const late = await c.ans(`g-${G_UNIT}`, false); eq([late.applied, late.reason], [false, "superseded_by_earlier_answer"], "different value after the unit acted");
  eq(await c.snapshot(), before, "untouched");
}));

await test("production gate: NOT answerable with `answer` (exit 6, message points at PANDACORP_OWNER_RELEASE_OK ... land), nothing changes, the release variable is never set", async () => withRun({ units: gateUnits("production") }, async (c) => {
  const before = await c.snapshot(); const env0 = process.env.PANDACORP_OWNER_RELEASE_OK;
  for (const value of [true, false]) {
    const err = await refused(() => c.ans(`g-${G_UNIT}`, value), `production gate answered ${value}`);
    ok(/PANDACORP_OWNER_RELEASE_OK|land|production|producci/i.test(err.message), `the message must say why (owner's chat order via land), got: ${err.message}`);
  }
  eq(await c.snapshot(), before, "state and journal untouched");
  eq((await c.unit(G_UNIT)).state, "waiting_gate", "the unit still waits at its gate");
  eq(process.env.PANDACORP_OWNER_RELEASE_OK, env0, "answer never sets PANDACORP_OWNER_RELEASE_OK"); eq(c.env.PANDACORP_OWNER_RELEASE_OK, undefined, "nor in the injected env");
}));

await test("gate id of a unit that is not at a gate is refused", async () => withRun({ units: gateUnits("money") }, async (c) => {
  await refused(() => c.ans("g-u-build-wo-02-001", true), "g-<unit> of a unit with no gate");
}));

// =====================================================================================================================
// applyStartAnswers (pure: start --run --answers)
// =====================================================================================================================
const startFn = async () => { const m = await load("answers.mjs"); if (m.__error) throw new Error(`answers.mjs cannot be imported: ${m.__error.message}`); if (typeof m.applyStartAnswers !== "function") throw new Error(`answers.mjs exports no applyStartAnswers (exports: ${Object.keys(m).join(", ")})`); return m.applyStartAnswers; };
const throwsCode = (fn, want, what) => { let err = null; try { fn(); } catch (e) { err = e; } if (!err) throw new Error(`${what}: expected ${want}`); if (err.code !== want && err.exit !== 6) throw new Error(`${what}: expected ${want}, got ${err.code}: ${err.message}`); };
const startState = () => baseState({ units: askUnits() });
await test("applyStartAnswers: answered asks are stored in state.answers and unblock the units that carry the question; applied[] reports them; input not mutated", async () => {
  const apply = await startFn(); const st = startState(); const before = JSON.stringify(st);
  const out = apply(st, { answers: { [Q_ID]: "include" }, questions: new Map([[Q_ID, Q]]) });
  eq(JSON.stringify(st), before, "pure");
  eq(out.state.answers[Q_ID], "include", "state.answers"); const u = out.state.units.find((x) => x.id === U_ASK); eq([u.state, u.pending_answer], ["queued", null], "unit unblocked");
  eq(out.state.units.find((x) => x.id === "u-build-wo-01-002").pending_answer, "q-other.thing", "another question's unit untouched");
  eq(out.applied, [{ question: Q_ID, value: "include", units: [{ unit: U_ASK, effect: "unblocked" }] }], "applied[]");
});
await test("applyStartAnswers: no answers is a no-op; booleans and objects fit", async () => {
  const apply = await startFn(); const st = startState();
  eq(apply(st, {}).applied, [], "no answers"); eq(JSON.stringify(apply(st, { answers: {}, questions: new Map() }).state), JSON.stringify(st), "state unchanged");
  const out = apply(st, { answers: { [Q_ID]: { action: "skip" } }, questions: new Map([[Q_ID, Q]]) }); eq(out.state.answers[Q_ID], { action: "skip" }, "object stored");
  eq(apply(st, { answers: { [Q_ID]: false }, questions: new Map([[Q_ID, Q]]) }).state.answers[Q_ID], false, "boolean stored");
});
await test("applyStartAnswers: an id that is not a preflight ask (unknown q-, a doubt id, a gate id) or a value that does not fit is INVALID_INPUT", async () => {
  const apply = await startFn(); const qs = new Map([[Q_ID, Q]]); const st = startState();
  throwsCode(() => apply(st, { answers: { "q-nope": "x" }, questions: qs }), "INVALID_INPUT", "unknown q id");
  throwsCode(() => apply(st, { answers: { [DOUBT_ID]: "opt-yes" }, questions: qs }), "INVALID_INPUT", "doubt id");
  throwsCode(() => apply(st, { answers: { "g-u-build-wo-01-001": true }, questions: qs }), "INVALID_INPUT", "gate id");
  for (const bad of [5, "", null, [1]]) throwsCode(() => apply(st, { answers: { [Q_ID]: bad }, questions: qs }), "INVALID_INPUT", `value ${JSON.stringify(bad)}`);
});
await test("readAnswersArg: inline JSON object, a file path, and absent -> {}", async () => withRun({}, async (c) => {
  const m = await load("answers.mjs"); if (typeof m.readAnswersArg !== "function") throw new Error("answers.mjs exports no readAnswersArg");
  eq(await m.readAnswersArg(`{"${Q_ID}":"include"}`, c.deps), { [Q_ID]: "include" }, "inline"); eq(await m.readAnswersArg(undefined, c.deps), {}, "absent");
  const f = path.join(c.fx.dir, "answers.json"); await writeFile(f, JSON.stringify({ [Q_ID]: true })); eq(await m.readAnswersArg(f, c.deps), { [Q_ID]: true }, "file path");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
