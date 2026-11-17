// Small incident regressions: isolated git fixtures, real engine transitions, no provider/model calls.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createFixture, git, testEnv, FAKE_WORKER_BIN } from "./fixtures/build-v2/make-fixture.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import * as st from "../runtime/build/state.mjs";
import * as adm from "../runtime/build/admission.mjs";
import * as jr from "../runtime/build/journal.mjs";
import * as bs from "../runtime/build-state.mjs";
import { ingestReport, resumeApprovedGates } from "../runtime/build/report.mjs";
import { planAnswer } from "../runtime/build/answers/plan.mjs";
import { planTestRepair, settleTestRepairs, doubtBasis } from "../runtime/build/recovery.mjs";
import { atomicWriteJson, sha256Hex } from "../runtime/build/fsx.mjs";
import { chooseTerminal } from "../runtime/build/next/terminal.mjs";
import { blockedClosure, depsMet } from "../runtime/build/next/scope.mjs";
import { isRepeatDoubt } from "../runtime/build/doubts/repeat.mjs";
import { vetoReasons } from "../runtime/build/doubts/veto.mjs";
import { launchWorker, pollWorker, reportEnvelope, buildWorkerArgv } from "../runtime/build/workers.mjs";
import { prepareSwcCache } from "../runtime/build/units/worktrees.mjs";
import { plan } from "../runtime/build/planner.mjs";

const FRD = "frd-01-alpha", RUN = "finish-regression", FILE = "src/alpha/list.ts", ORACLE = "src/alpha/_tests/params.test.mjs";
const write = async (root, rel, data) => { const file = path.join(root, rel); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data); };
const verify = `#!/bin/bash
for arg in "$@"; do case "$arg" in --tests=*) node --test "\${arg#--tests=}"; exit $?;; esac; done
exit 0
`;
async function fixture(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "finish-"));
  const fx = await createFixture("basic", { dir });
  const env = { ...testEnv(dir) }; delete env.PANDACORP_NOW;
  const saved = new Map(Object.keys(env).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    const project = fx.root, paths = buildPaths(project);
    await write(project, ".pandacorp/verify.sh", verify);
    await write(project, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], []);\n");
    git(project, ["add", "-A"]); git(project, ["commit", "-qm", "fixture oracle"]);
    const base = git(project, ["rev-parse", "HEAD"]), branch = paths.integrationBranch(RUN);
    git(project, ["worktree", "add", "-qb", branch, paths.integrationWorktree, "main"]);
    const lease = await bs.acquire(project, { runtime: "codex", runId: RUN, projectStatus: false, ttlSeconds: 1800 });
    await atomicWriteJson(paths.tokenFile, { token: lease.token, epoch: lease.epoch });
    const state = st.newState({ run_id: RUN, epoch: lease.epoch, coordinator: "codex-session", label: "codex", size: "feature",
      scope: { card: null, wos: ["WO-01-001"], frds: [FRD], out_of_scope: [] }, integration: { branch, worktree: paths.integrationWorktree, base_sha: base } });
    await st.writeState(project, state);
    await jr.appendEvent(paths.journalFile, { run_id: RUN, epoch: lease.epoch, actor: "cli", type: "run_started", data: { state } });
    const ref = { project, epoch: lease.epoch }, deps = { env, emit: async () => {}, notify: async () => {}, computeRisk: async () => ({ zone: "none", signals: { classify: [] }, failclosed: false }) };
    const ctx = { ...ref, paths, runId: RUN, readState: () => st.readState(project), writeState: s => st.writeState(project, s), appendEvent: e => jr.appendEvent(paths.journalFile, { ...e, run_id: RUN, epoch: lease.epoch, actor: "cli" }) };
    const dispatch = async fields => {
      const s = await ctx.readState(), token = adm.issueToken(fields.id, "B", { file: paths.admissionFile });
      const worktree = paths.unitWorktree(fields.id), branch = paths.unitBranch(RUN, fields.id);
      git(project, ["worktree", "add", "-qb", branch, worktree, s.integration.branch]);
      const unit = st.newUnit({ ...fields, frd: FRD, wos: ["WO-01-001"], state: "running", worktree, branch, token_hash: token.token_hash });
      await ctx.writeState({ ...s, units: [...s.units.filter(u => u.id !== unit.id), unit] });
      return { ...unit, token: token.token };
    };
    const report = async (unit, files) => {
      const file = paths.reportFile(unit.id);
      await atomicWriteJson(file, { schema: 1, unit: unit.id, token: unit.token, status: "done", summary: "regression change", authored_by: { runtime: "codex", model: "sol", effort: "high" }, files, verification: [], pending: [], diagnosis: null, doubt: null, gate: null });
      return ingestReport({ ...ref, unit: unit.id, token: unit.token, file }, deps);
    };
    await fn({ project, paths, ctx, ref, deps, dispatch, report, env });
  } finally {
    for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await fx.cleanup(); await fs.rm(dir, { recursive: true, force: true });
  }
}

test("F9: fix-test creates a separate verified oracle version before the same builder resumes", () => fixture(async c => {
  const old = sha256Hex(await fs.readFile(path.join(c.project, ORACLE)));
  let state = await c.ctx.readState();
  state.units.push(st.newUnit({ id: "u-tests", kind: "tests", state: "integrated", test_hashes: { [ORACLE]: old }, frd: FRD }));
  await c.ctx.writeState(state);
  const builder = await c.dispatch({ id: "u-build", kind: "build" });
  await write(builder.worktree, FILE, "export const preserved = 42;\n");
  state = await c.ctx.readState();
  state.units = state.units.map(u => u.id === builder.id ? { ...u, state: "parked", parked: "owner_question", pending_answer: "d-0001", doubt_id: "d-0001" } : u);
  const doubt = { id: "d-0001", unit: builder.id, step: "parked", question: `AC-01-001.1: ${ORACLE} expects [], installed framework rejects empty params`, why: "Use sentinel per the installed framework contract", options: [{ id: "fix-test", text: "correct oracle" }, { id: "keep-test", text: "keep" }], preferred: "fix-test" };
  const chosen = planAnswer({ state, question: doubt.id, value: "fix-test", doubt });
  await c.ctx.writeState(chosen.state);
  for (const e of chosen.events) await c.ctx.appendEvent(e);
  const repair = chosen.state.units.find(u => u.test_repair);
  assert.equal(repair.kind, "tests"); assert.notEqual(repair.id, builder.id);
  assert.equal(depsMet(chosen.state, st.findUnit(chosen.state, builder.id)), false);
  assert.throws(() => planTestRepair(chosen.state, doubt), /already has/);
  const round = plan({ wos: [{ id: "WO-01-001", frd: FRD, status: "IN_PROGRESS", deps: [], artifacts: [FILE], zone: "none", complexity: "normal" }], units: chosen.state.units, scope: chosen.state.scope, size: "feature" });
  assert.ok(round.round.includes(repair.id), JSON.stringify(round));
  assert.equal(round.round.includes(builder.id), false);
  const independent = await c.dispatch(repair);
  assert.notEqual(independent.worktree, builder.worktree);
  await write(independent.worktree, ORACLE, "import assert from 'node:assert/strict'; assert.deepEqual(['sentinel'], ['sentinel']); assert.notDeepEqual(['sentinel'], []);\n");
  const res = await c.report(independent, [ORACLE]);
  assert.equal(res.outcome, "committed", JSON.stringify(res));
  git(c.paths.integrationWorktree, ["merge", "--ff-only", res.commit]);
  state = await c.ctx.readState();
  await c.ctx.writeState(st.patchUnit(state, repair.id, { state: "integrated" }));
  await c.ctx.appendEvent({ type: "integrated", data: { unit: repair.id, sha: res.commit } });
  await settleTestRepairs(c.ctx, c.deps);
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, builder.id).attempt, 1);
  assert.equal(depsMet(state, st.findUnit(state, builder.id)), true);
  assert.equal(await fs.readFile(path.join(builder.worktree, FILE), "utf8"), "export const preserved = 42;\n");
  assert.equal(sha256Hex(await fs.readFile(path.join(builder.worktree, ORACLE))), st.findUnit(state, repair.id).test_hashes[ORACLE]);
  assert.equal(st.findUnit(state, repair.id).test_repair.old_hashes[ORACLE], old);
  assert.equal(st.findUnit(state, "u-tests").test_hashes[ORACLE], undefined);
  // The builder still cannot rewrite its new oracle.
  const tok = adm.issueToken(builder.id, "B", { file: c.paths.admissionFile });
  await c.ctx.writeState(st.patchUnit(state, builder.id, { state: "running", token_hash: tok.token_hash }));
  await write(builder.worktree, ORACLE, "throw new Error('builder cheating');\n");
  const refused = await c.report({ ...builder, token: tok.token }, [FILE, ORACLE]);
  assert.equal(refused.outcome, "rejected"); assert.match(refused.reasons.join(" "), /hashed test/);
}));

test("F4: an approved engine gate re-ingests the same SHA/report without a worker or attempt", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-gate", kind: "build" });
  await write(unit.worktree, FILE, "export const gate = true;\n");
  c.deps.computeRisk = async () => ({ failclosed: false, signals: { classify: [{ signal: "S8", detail: "actual deletion" }] } });
  const res = await c.report(unit, [FILE]); assert.equal(res.outcome, "waiting_gate", JSON.stringify(res));
  let state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).gate_report.commit, res.commit);
  const chosen = planAnswer({ state, question: `g-${unit.id}`, value: true });
  assert.equal(st.findUnit(chosen.state, unit.id).state, "reported");
  await c.ctx.writeState(chosen.state);
  await resumeApprovedGates(c.ref, c.deps);
  state = await c.ctx.readState();
  assert.equal(st.findUnit(state, unit.id).state, "committed"); assert.equal(st.findUnit(state, unit.id).attempt, 1);
  assert.equal(git(unit.worktree, ["rev-parse", "HEAD"]), res.commit);
  assert.deepEqual(await resumeApprovedGates(c.ref, c.deps), []);
  assert.equal((await jr.readJournal(c.paths.journalFile)).events.filter(e => e.type === "report_received").at(-1).data.commit, res.commit);
}));

test("closure: integrated preparation waiting on its builder's gate never becomes no_progress", () => {
  const tests = st.newUnit({ id: "u-tests", kind: "tests", state: "integrated" });
  const docs = st.newUnit({ id: "u-docs", kind: "docs", state: "integrated" });
  const build = st.newUnit({ id: "u-build", kind: "build", state: "waiting_gate", waiting_gate: "delete", depends_on: [tests.id, docs.id] });
  const state = { scope: { card: "CR-1" }, units: [tests, docs, build], handbacks_in_a_row: 0 };
  assert.equal(blockedClosure(state).all.has(tests.id), true);
  assert.deepEqual(chooseTerminal(state, {}), { action: "waiting-owner", status: "waiting_gate", reason: "gate" });
  assert.deepEqual(chooseTerminal({ ...state, units: [tests, docs] }, {}), { action: "wait", reason: "closure" });
});

test("repeat: paraphrases share concrete contract/file identity until a causal oracle repair", () => {
  const a = { question: `The contract in ${ORACLE} expects []`, why: "AC-01-001.1", preferred: "fix-test", options: [{ id: "fix-test" }, { id: "keep-test" }], step: "decided", basis: JSON.stringify([[ORACLE, "old"]]) };
  const b = { ...a, question: `Cannot enumerate an empty route: correct ${ORACLE}`, preferred: "keep-test" };
  assert.equal(isRepeatDoubt(a, b, a.basis), true);
  const hashState = { units: [{ test_hashes: { [ORACLE]: "old", "src/other.test.mjs": "a" } }] };
  const basis = doubtBasis(hashState, {}, a); hashState.units[0].test_hashes["src/other.test.mjs"] = "b";
  assert.equal(doubtBasis(hashState, {}, a), basis);
  assert.equal(isRepeatDoubt(a, b, JSON.stringify([[ORACLE, "new"]])), false);
  const noPath = { ...b, question: "AC-01-001.1 still rejects the sentinel", why: "same contract" };
  assert.equal(isRepeatDoubt(a, noPath, doubtBasis(hashState, {}, noPath)), true);
  const c = { ...b, question: "A different contract", why: "AC-02-001.1" };
  assert.equal(isRepeatDoubt(a, c), false);
  assert.throws(() => planAnswer({ state: { units: [], answers: {} }, question: "d-0002", value: "keep-test", doubt: { ...b, id: "d-0002", step: "parked", repeated: true } }), /causal repair/);
});

test("F3: only proven own atomic temporary cleanup avoids S8; actual deletion remains gated", () => fixture(async c => {
  const script = path.resolve("plugin/scripts/classify-change.mjs"), text = path.join(c.project, "cleanup.ts");
  const source = 'import { randomUUID } from \"node:crypto\";\nimport { writeFile, rename, unlink } from \"node:fs/promises\";\nconst temporary = `${target}.${randomUUID()}.tmp`;\nawait writeFile(temporary, data);\nawait rename(temporary, target);\nawait unlink(temporary);\n';
  const classify = async code => { await fs.writeFile(text, code); return JSON.parse(execFileSync(process.execPath, [script, "--repo", c.project, "--files", "src/save.ts", "--text", text], { encoding: "utf8" }).trim().split("\n").at(-1)); };
  assert.equal((await classify(source)).floor_hits.some(h => h.signal === "S8"), false);
  const fsynced = source.replace("writeFile, rename, unlink", "open, rename, unlink").replace("await writeFile(temporary, data);", 'const handle = await open(temporary, "wx", 0o600); await handle.writeFile(data); await handle.sync(); await handle.close();');
  assert.equal((await classify(fsynced)).floor_hits.some(h => h.signal === "S8"), false);
  assert.equal((await classify(fsynced.replace('"wx"', '"w"'))).floor_hits.some(h => h.signal === "S8"), true);
  for (const unsafe of [source + "await unlink(target);\n", source + "function remove(temporary) { unlink(temporary); }\n", "await unlink(temporary);\n", source.replace("randomUUID()", "userInput"), source.replace("node:crypto", "./fake-crypto"), source.replace("await unlink(temporary)", "other.unlink(temporary)"), source.replace("await unlink(temporary)", "temporary = target; await unlink(temporary)")]) {
    assert.equal((await classify(unsafe)).floor_hits.some(h => h.signal === "S8"), true);
  }
  const shadowed = source.replace("const temporary", "async function remove(randomUUID, writeFile, rename) { const temporary") + "}";
  assert.equal((await classify(shadowed)).floor_hits.some(h => h.signal === "S8"), true);
  const destructured = source.replace("const temporary", "async function remove(input) { const { randomUUID, writeFile, rename } = input; const temporary") + "}";
  assert.equal((await classify(destructured)).floor_hits.some(h => h.signal === "S8"), true);
  const doubt = { question: "Which empty sentinel satisfies AC-01-001.1?", why: "a reversible contract correction", options: [{ text: "Use sentinel" }, { text: "Keep empty" }] };
  assert.equal(vetoReasons({ unit: { zone: "floor" }, doubt, risk: { zone: "floor", irreversible: true, failclosed: false }, text: { ok: true, hits: [] } }).length, 0);
  assert.equal(vetoReasons({ unit: { zone: "floor" }, doubt, text: { ok: true, hits: [{ signal: "S8", level: "critical" }] } }).some(r => r.reason === "irreversible"), true);
}));

test("F6: launcher envelope ignores copied model token; corrupt transport retries the same job", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-envelope", kind: "docs" });
  const brief = c.paths.briefFile(unit.id); await write(c.project, path.relative(c.project, brief), "Return fixture JSON only.");
  const planFile = path.join(c.project, "fake-plan.json");
  const report = { schema: 1, unit: unit.id, token: "WRONG-MODEL-COPY", status: "done", summary: "fixture", files: [], verification: [], pending: [], diagnosis: null, doubt: null, gate: null };
  // Fake worker's sealed payload comes from an explicit plan; no real provider is reachable.
  await atomicWriteJson(planFile, { [unit.id]: report });
  const deps = { ...c.deps, env: { ...c.env, PANDACORP_FAKE_WORKER: FAKE_WORKER_BIN, PANDACORP_FAKE_WORKER_PLAN: planFile } };
  const launched = await launchWorker({ project: c.project, runId: RUN, epoch: c.ref.epoch, unit: unit.id, token: unit.token,
    cell: { runtime: "codex", model: "sol", effort: "high" }, dir: unit.worktree, briefFile: brief }, deps);
  assert.equal(launched.ok, true, JSON.stringify(launched));
  let state = await c.ctx.readState();
  state = st.patchUnit(state, unit.id, { worker: { runtime: "codex", model: "sol", effort: "high", via: "cli", pid: null, worker_id: launched.workerId } });
  state.jobs.push({ ...launched.job, state: "running" }); await c.ctx.writeState(state);
  const input = { project: c.project, workerId: launched.workerId, unit: unit.id, epoch: c.ref.epoch, schemaFile: c.paths.schemaFile("report") };
  assert.equal(reportEnvelope(input).token, unit.token);
  assert.equal(reportEnvelope({ ...input, epoch: c.ref.epoch + 1 }).ok, false);
  const envelope = path.join(c.paths.build, "worker-envelopes", `${launched.workerId}.json`), original = await fs.readFile(envelope);
  await fs.writeFile(envelope, "{}");
  const denied = { ...deps, fs: { ...(await import("node:fs")), writeFileSync: () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); } } };
  const transport = await pollWorker(input, denied); assert.equal(transport.kind, "transport");
  assert.equal((await pollWorker(input, deps)).report.token, unit.token); // launcher receipt repairs the envelope
  await fs.writeFile(envelope, '{"token":{}}');
  const receipt = envelope.replace(/\.json$/, '.launch.json'); await fs.writeFile(receipt, '{"token":42}');
  const bad = await pollWorker(input, deps); assert.equal(bad.state, "error"); assert.equal(bad.kind, "transport");
  await fs.writeFile(envelope, original);
  const good = await pollWorker(input, deps);
  assert.equal(good.outcome, "report", JSON.stringify(good)); assert.equal(good.report.token, unit.token);
  assert.equal((await c.ctx.readState()).units.find(u => u.id === unit.id).attempt, 1);
}));

test("SWC: physical sandbox cache is probed, and unwritable/escaped cache uses a writable fallback", () => fixture(async c => {
  const unit = await c.dispatch({ id: "u-cache", kind: "build" });
  const alias = path.join(c.project, "checkout-alias"); await fs.symlink(unit.worktree, alias);
  const cached = await prepareSwcCache(alias, { env: { NEXT_SWC_PATH: "/cache/outside-sandbox" } });
  assert.equal(cached.root, await fs.realpath(unit.worktree)); assert.ok(cached.cache.startsWith(cached.root + path.sep));
  assert.equal((await fs.readdir(cached.cache)).length, 0);
  const injected = { ...fs, writeFile: async (file, ...args) => { if (file.includes('/swc/')) throw Object.assign(new Error('sandbox denied'), { code: 'EACCES' }); return fs.writeFile(file, ...args); } };
  const fallback = await prepareSwcCache(alias, { fs: injected, env: {} }); assert.ok(fallback.cache.endsWith("swc-worker"));
  const argv = buildWorkerArgv({ project: c.project, workerId: "w-cache", unit: unit.id, cell: { runtime: "codex", model: "sol", effort: "high" }, promptFile: c.paths.schemaFile("report"), dir: alias });
  assert.equal(argv.args[argv.args.indexOf("--dir") + 1], await fs.realpath(unit.worktree));
}));
