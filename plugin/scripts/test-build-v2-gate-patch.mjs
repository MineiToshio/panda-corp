#!/usr/bin/env node
// PLAN-E2 PATCH §3.2: diagnostic fixtures, exact WO scope, fallback budget and G2 recovery.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGateFailure, attributeGateFailure, planGatePatch } from "../runtime/build/gatefail.mjs";
import { newState, newUnit, readState, writeState } from "../runtime/build/state.mjs";
import { validate } from "../runtime/build/fsx.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { harvest } from "../runtime/build/next/harvest.mjs";
import { frdsReadyForG2 } from "../runtime/build/integrate/chain.mjs";
import { createFixture, git } from "./fixtures/build-v2/make-fixture.mjs";
import { acquire } from "../runtime/build-state.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS ${name}`); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); failed++; } };
const fixture = async (name) => readFile(new URL(`./fixtures/build-v2/gate-logs/${name}.log`, import.meta.url), "utf8");
const wo = (id, artifacts) => ({ id, artifacts });
const units = [newUnit({ id: "u-list", kind: "build", wos: ["WO-01-001"], frd: "frd-01-alpha", state: "verified", attempt: 3 }), newUnit({ id: "u-filter", kind: "build", wos: ["WO-01-002"], frd: "frd-01-alpha", state: "verified" }), newUnit({ id: "u-beta", kind: "build", wos: ["WO-02-001"], frd: "frd-02-beta", state: "verified" })];
const workOrders = [wo("WO-01-001", ["src/alpha/list.ts"]), wo("WO-01-002", ["src/alpha/filter.ts"]), wo("WO-02-001", ["src/beta/**"])];

await test("PATCH parser fixtures: six real verifier formats exclude passing files and command echoes", async () => {
  for (const name of ["vitest", "playwright", "tsc", "biome", "next-build", "doc-lint"]) {
    const out = parseGateFailure({ log: await fixture(name) });
    assert.deepEqual(out.checks, [name], name);
    const expected = name === "playwright" ? ["e2e/filter.spec.ts"] : name === "doc-lint" ? ["docs/frds/frd-01-alpha/frd.md"] : name === "vitest" ? ["src/alpha/filter.test.ts", "src/alpha/filter.ts"] : ["src/alpha/filter.ts"];
    assert.deepEqual(out.paths, expected, name);
    if (["vitest", "playwright"].includes(name)) assert(out.tests.some((s) => s.includes("empty values")), name);
  }
});
await test("PATCH parser: unknown output, ANSI, absolute paths, traversal and bounded tail", async () => {
  assert.deepEqual(parseGateFailure({ log: await fixture("unknown") }).paths, []);
  assert.deepEqual(parseGateFailure({ root: "/project", log: "\x1b[31m/project/src/alpha/filter.ts(2,1): error TS2322: wrong\x1b[0m\n/outside/src/other.ts(1,1): error TS1\n../src/private.ts(1,1): error TS1" }).paths, ["src/alpha/filter.ts"]);
  const out = parseGateFailure({ log: Array.from({ length: 100 }, (_, n) => `line ${n} ${"x".repeat(500)}`).join("\n") });
  assert(out.tail.length <= 12000 && out.tail.includes("line 99") && !out.tail.includes("line 1 "));
});
await test("PATCH attribution: canonical artifacts and test_hashes select only the failing WO", () => {
  const withTests = [...units, newUnit({ id: "u-tests", kind: "tests", wos: ["WO-01-002"], attempt: 3, test_hashes: { "e2e/filter.spec.ts": "a".repeat(64) } })];
  const out = attributeGateFailure({ evidence: { paths: ["e2e/filter.spec.ts"] }, units: withTests, workOrders });
  assert.deepEqual(out.wos, ["WO-01-002"]); assert.deepEqual(out.fixed.map((u) => u.id), ["u-filter"]);
  assert.deepEqual(attributeGateFailure({ evidence: { paths: ["src/outside.ts"] }, units, workOrders }).wos, []);
  const glob = attributeGateFailure({ evidence: { paths: ["src/beta/deep/view.ts"] }, units, workOrders });
  assert.deepEqual(glob.wos, ["WO-02-001"]);
});
await test("PATCH budget and fallback: unrelated exhausted WO does not charge the failing WO; unknown gate gets exactly three patches", async () => {
  const state = { units };
  const input = { state, units, workOrders, evidence: parseGateFailure({ log: await fixture("tsc") }), gate: "G3", job: "j-red" };
  const plan = planGatePatch(input);
  assert.deepEqual(plan.wos, ["WO-01-002"]); assert.equal(plan.attempt, 2);
  const schema = JSON.parse(await readFile(new URL("../runtime/build/schemas/gate-failure.schema.json", import.meta.url), "utf8"));
  assert.equal(validate(schema, plan.evidence).ok, true);
  const fallbackInput = { ...input, evidence: parseGateFailure({ log: await fixture("unknown") }) };
  let previous = null;
  for (let n = 1; n <= 4; n++) {
    const p = planGatePatch({ ...fallbackInput, state: { units: [...units, ...(previous ? [previous] : [])] } });
    assert.equal(p.id, "u-patch-g3"); assert.equal(p.attempt, n); assert.deepEqual(p.fixed, []); assert.deepEqual(p.evidence.wos, []);
    assert.deepEqual(p.wos, ["WO-01-001", "WO-01-002", "WO-02-001"]);
    previous = newUnit({ id: p.id, kind: "patch", wos: p.wos, attempt: p.attempt });
  }
  const g2 = planGatePatch({ ...fallbackInput, gate: "G2", frd: "frd-01-alpha" });
  assert.equal(g2.attempt, 1); assert.equal(g2.frd, "frd-01-alpha");
});

const scratch = await mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "gate-patch-"));
try {
  await test("PATCH G2: exact red scope, evidence on disk, patch integration restores G2 readiness and green review keeps healthy work", async () => {
    const fx = await createFixture("basic", { dir: scratch });
    const env = fx.env(); const deps = { env };
    const p = buildPaths(fx.root, deps); const runId = "run-patch";
    const lease = await acquire(fx.root, { runtime: "claude", runId, projectStatus: false });
    const branch = p.integrationBranch(runId); const wt = p.integrationWorktree;
    git(fx.root, ["worktree", "add", "-q", "-b", branch, wt, "main"]);
    const job = { id: "j-g2", kind: "g2", unit: null, frd: "frd-01-alpha", cwd: wt, pid: null, started_at: "2026-11-11T12:00:00.000Z", state: "running", exit: null, h_slot: true, worker_id: null };
    let state = newState({ run_id: runId, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "feature", scope: { card: null, frds: ["frd-01-alpha"], wos: ["WO-01-001", "WO-01-002"], out_of_scope: [] }, integration: { branch, worktree: wt, base_sha: fx.sha }, units: units.slice(0, 2).map((u) => ({ ...u, state: "integrated" })), jobs: [job] });
    await writeState(fx.root, state, deps);
    await mkdir(p.jobDir(job.id), { recursive: true }); await writeFile(p.jobOutFile(job.id), await fixture("tsc"));
    let exit = 1;
    deps.jobs = { pollJob: async () => ({ state: "done", exit }) };
    deps.risk = { computeRisk: async () => ({ zone: "none", rules: [] }) };
    const run = { ref: { project: fx.root, epoch: lease.epoch, deps }, paths: p, d: deps };
    await harvest(run, state, []);
    state = await readState(fx.root, deps);
    const patch = state.units.find((u) => u.kind === "patch");
    assert.deepEqual(patch.wos, ["WO-01-002"]); assert.equal(patch.attempt, 2);
    assert.equal(state.units.find((u) => u.id === "u-list").state, "integrated");
    assert.equal(state.units.find((u) => u.id === "u-filter").state, "patching");
    assert.deepEqual(JSON.parse(await readFile(path.join(p.unitDir(patch.id), "gate-failure.json"), "utf8")).checks, ["tsc"]);
    // The report/integrate phase has now merged the patch. No gate job is live yet.
    patch.state = "integrated"; await writeState(fx.root, state, deps);
    await harvest(run, state, []);
    state = await readState(fx.root, deps); assert.deepEqual(frdsReadyForG2(state), ["frd-01-alpha"]);
    state.jobs.push({ ...job, id: "j-g2-green" }); await writeState(fx.root, state, deps); exit = 0;
    await harvest(run, state, []);
    state = await readState(fx.root, deps);
    assert(state.units.filter((u) => ["build", "patch"].includes(u.kind)).every((u) => u.state === "reviewing"));
    assert(state.units.some((u) => u.kind === "review" && u.state === "queued"));
    // A later red consumes only the failed WO's budget and uses the governed budget hand-back, not a manual one.
    state.units = state.units.map((u) => u.kind === "build" ? { ...u, state: "integrated", attempt: 3 } : { ...u, state: "verified" });
    state.jobs.push({ ...job, id: "j-g2-exhausted" }); await writeState(fx.root, state, deps);
    await mkdir(p.jobDir("j-g2-exhausted"), { recursive: true }); await writeFile(p.jobOutFile("j-g2-exhausted"), await fixture("tsc"));
    exit = 1; const handedBack = [];
    deps.failure = { handBack: async (ctx, input) => {
      handedBack.push(input);
      const current = await ctx.readState();
      await ctx.writeState({ ...current, units: current.units.map((u) => u.id === input.unitId ? { ...u, state: "blocked" } : u) });
    } };
    await harvest(run, state, []);
    assert.deepEqual(handedBack.map((x) => [x.unitId, x.reasonCode]), [["u-filter", "budget_exhausted"]]);
    assert(handedBack[0].failure.tail.includes("TS2322"));
    assert.equal((await readState(fx.root, deps)).units.find((u) => u.id === "u-list").state, "integrated");
    assert.equal(git(fx.root, ["status", "--porcelain"]), "");
  });
} finally { await rm(scratch, { recursive: true, force: true }); }
console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
