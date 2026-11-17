#!/usr/bin/env node
// test-build-v2-failure.mjs: official test of plugin/runtime/build/failure.mjs (PLAN 5.2 row C09; D21; BUILD-15).
// DR-164 active execution contract: repeated technical identity -> one rescue; rescue failure
// abandons the dependent closure while independent work continues. Safety refusals retain handback.
// Pure legacy D21 policy helpers remain covered separately from their active execution bridge.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture, DEFAULT_NOW, git } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
let F; let loadError = null;
try { F = await import("../runtime/build/failure.mjs"); } catch (e) { loadError = e; }
const fn = (name) => { if (loadError) throw new Error(`failure.mjs not loadable: ${loadError.message}`); const f = F[name]; if (typeof f !== "function") throw new Error(`failure.mjs does not export function ${name}`); return f; };
const bs = await import("../runtime/build-state.mjs");
const { newState, newUnit, writeState, readState, fencedTwoPhase } = await import("../runtime/build/state.mjs");
const { appendEvent, readJournal } = await import("../runtime/build/journal.mjs");
const { buildPaths } = await import("../runtime/build/paths.mjs");

const scratch = await mkdtemp(path.join(os.tmpdir(), "pc-failure-"));
let counter = 0;
const RUN = "run-f1";
const BL_STUB = (n) => `---\nid: BL-${n}\ntype: bug\narea: build-engine\ntitle: "stub ${n}"\nstatus: open\nseverity: p2\nopened: 2026-11-01\nclosed:\nsource: "test"\ncloses:\nlinks: []\n---\n\n## Problem\nx\n`;
const sandbox = async (preset = "basic") => {
  const dir = path.join(scratch, `t${counter++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture(preset, { dir });
  const factory = path.join(dir, "factory-root"); await mkdir(path.join(factory, "factory/backlog"), { recursive: true });
  await writeFile(path.join(factory, "factory/backlog/BL-0307-existing.md"), BL_STUB("0307"));
  await writeFile(path.join(factory, "factory/backlog/BL-0309-other.md"), BL_STUB("0309"));
  const env = fx.env({ PANDACORP_FACTORY_ROOT: factory });
  return { dir, fx, env, factory, project: fx.root, deps: { env, clock: () => new Date(DEFAULT_NOW), factoryRoot: factory }, p: buildPaths(fx.root, { env }) };
};
const mkState = (units, extra = {}) => newState({
  run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature",
  scope: { card: null, frds: ["frd-01-alpha"], wos: [], out_of_scope: [] },
  integration: { branch: buildPaths("/nonexistent/project").integrationBranch(RUN), worktree: "/nonexistent/integration", base_sha: "0".repeat(40) },
  units, ...extra,
});
const U = (id, extra = {}) => newUnit({ id, kind: "build", wos: [id.replace("u-build-", "")], frd: "frd-01-alpha", state: "running", ...extra });
const EVID = (over = {}) => ({ tests: ["t/a.test.ts#one"], command: "pnpm vitest run t/a.test.ts", files: ["src/alpha/list.ts"], ...over });
const DIAG = (cause = "code", detail = "diagnosis") => ({ cause, detail });
const evHash = (evidence, cause = "code") => fn("buildEvidence")({ ...evidence, diagnosis: { cause } }).hash;
/** A run on disk: state.json, a run_started journal line, a lease held by this process, and a real integration worktree. */
const seedRun = async (sb, state) => {
  const lease = await bs.acquire(sb.project, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
  const branch = sb.p.integrationBranch(RUN); const worktree = sb.p.integrationWorktree;
  git(sb.project, ["worktree", "add", "-b", branch, worktree, "main"]);
  const st = { ...state, epoch: lease.epoch, integration: { branch, worktree, base_sha: git(sb.project, ["rev-parse", "main"]) } };
  await writeState(sb.project, st, { env: sb.env });
  await appendEvent(sb.p.journalFile, { run_id: RUN, epoch: lease.epoch, type: "run_started", data: { detect: {}, preflight: {}, state: st } }, { env: sb.env, clock: () => new Date(DEFAULT_NOW) });
  return { lease, state: st };
};
const handBackIn = (sb, lease, input) => fencedTwoPhase({ project: sb.project, epoch: lease.epoch, deps: sb.deps }, undefined, undefined, (_r, _i, ctx) => fn("handBack")(ctx, input, sb.deps));
const OUTPUT = Array.from({ length: 100 }, (_, i) => `output line ${i + 1}`).join("\n");
const HB_UNIT = "u-build-WO-01-001";
const HB_STATE = (sb) => mkState([U(HB_UNIT, { attempt: 3, state: "reported", branch: sb.p.unitBranch(RUN, HB_UNIT, 3) }), U("u-build-WO-01-002", { state: "queued", depends_on: [HB_UNIT], wos: ["WO-01-002"] })]);
const HB_INPUT = (extra = {}) => ({
  unitId: HB_UNIT, cause: "code", reasonCode: "budget_exhausted", reason: "tercer intento fallido",
  failure: { command: "pnpm vitest run t/a.test.ts", tail: OUTPUT },
  attempts: [`intento 1: ${JSON.stringify(EVID())}`, `intento 2: ${JSON.stringify(EVID({ files: ["src/alpha/list.ts", "src/alpha/filter.ts"] }))}`, `intento 3: ${JSON.stringify(EVID({ tests: ["t/a.test.ts#two"] }))}`],
  diagnosis: DIAG("code", "the list filter ignores empty input"), ...extra,
});

// ---------------------------------------------------------------- module surface
await test("module loads and exports the policy functions", async () => {
  for (const n of ["buildEvidence", "decideFailure", "planHandback", "handBack", "withEngineRecovery"]) fn(n);
});

// ---------------------------------------------------------------- evidence identity
await test("buildEvidence hash: stable under key and array order, changes with any evidence element", async () => {
  const h = (e) => fn("buildEvidence")({ ...e, diagnosis: DIAG() }).hash;
  const a = h(EVID({ tests: ["x", "y"], files: ["f1", "f2"] }));
  ok(/^[0-9a-f]{64}$/.test(a), `not a sha256 hex: ${a}`);
  eq(h({ files: ["f2", "f1"], command: "pnpm vitest run t/a.test.ts", tests: ["y", "x"] }), a, "order must not matter");
  ok(h(EVID({ tests: ["x"], files: ["f1", "f2"] })) !== a, "different failing tests, same hash");
  ok(h(EVID({ tests: ["x", "y"], files: ["f1"] })) !== a, "different files, same hash");
  ok(h(EVID({ tests: ["x", "y"], files: ["f1", "f2"], command: "other" })) !== a, "different command, same hash");
});

// ---------------------------------------------------------------- attempt budget (D21)
await test("PATCH N16: only build and patch units spend the per-WO execution budget", async () => {
  const { executionsUsed } = await import("../runtime/build/failure/policy.mjs");
  const units = [U("builder", { wos: ["WO-01-001"], attempt: 1 }),
    ...["tests", "docs", "review", "audit", "doubt-consult"].map((kind) => U(`u-${kind}`, { kind, wos: ["wo-01-001"], attempt: 3 }))];
  eq(executionsUsed(mkState(units), ["WO-01-001"]), 1, "non-build executions do not charge the WO");
  const decision = fn("decideFailure")({ state: mkState(units), wos: ["WO-01-001"], failure: { source: "g3_red" }, evidence: EVID() });
  eq(decision.attempt, 2, "a tests attempt 3 cannot exhaust the first build's budget");
  units.push(U("patch", { kind: "patch", wos: ["WO-01-001"], attempt: 2 }));
  eq(executionsUsed(mkState(units), ["WO-01-001"]), 2, "patch executions do charge the WO");
  eq(executionsUsed(mkState(units), ["WO-02-001"]), 0, "unrelated WOs do not charge this budget");
});
await test("PATCH3 B1: fallback report failures spend only their own three executions", async () => {
  const healthy = U("healthy", { wos: ["WO-01-001"], state: "verified", attempt: 3 });
  for (const id of ["u-patch-g3", "u-patch-g2-frd-01-alpha"]) {
    for (const attempt of [1, 2, 3]) {
      const unit = U(id, { kind: "patch", wos: healthy.wos, attempt });
      const d = fn("decideFailure")({ state: mkState([healthy, unit]), unit, failure: { source: "report_failed" }, diagnosis: DIAG(), evidence: EVID() });
      eq(d.failed_attempt, attempt, "healthy attempt 3 cannot charge the fallback");
      eq(d.action, attempt === 1 ? "requeue" : attempt === 2 ? "escalate" : "handback", "own retry policy");
      eq(d.attempt, attempt < 3 ? attempt + 1 : null, "no fourth execution");
      if (attempt === 3) eq(d.reason_code, "budget_exhausted", "own budget exhausted");
    }
  }
});

await test("PATCH3 B2: exhausted fallback technical retry preserves healthy WOs and retains its allowlist", async () => {
  const sb = await sandbox();
  try {
    const healthy = [U("healthy-list", { wos: ["WO-01-001"], state: "verified", attempt: 3 }), U("healthy-filter", { wos: ["WO-01-002"], state: "verified" })];
    const patch = U("u-patch-g3", { kind: "patch", wos: healthy.flatMap((u) => u.wos), attempt: 3 });
    const { lease } = await seedRun(sb, mkState([...healthy, patch]));
    const woDir = path.join(sb.p.integrationWorktree, "docs/frds/frd-01-alpha/work-orders");
    const files = (await readdir(woDir)).filter((name) => /^wo-01-00[12]/i.test(name)).sort().map((name) => path.join(woDir, name));
    eq(files.length, 2, "both healthy WOs exist");
    const before = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const transitions = [];
    sb.deps.buildState = { ...bs, transitionWorkOrderAt: async (...args) => { transitions.push(args[1]); return bs.transitionWorkOrderAt(...args); } };
    const res = await handBackIn(sb, lease, { unitId: patch.id, cause: "code", reasonCode: "budget_exhausted", reason: "fallback exhausted" });
    eq(transitions, [], "allowlist WOs are never affected WOs");
    eq(res.wos_blocked, [], "no healthy WOs blocked"); eq(res.wos_skipped, [], "no attempted healthy transitions");
    eq(await Promise.all(files.map((file) => readFile(file, "utf8"))), before, "healthy frontmatter unchanged");
    const st = await readState(sb.project, { env: sb.env });
    eq(st.units.map((u) => u.state), ["verified", "verified", "reported"], "only fallback retries at its exhausted ordinary budget");
    eq(st.units.at(-1).wos, patch.wos, "allowlist retained in unit state");
  } finally { await sb.fx.cleanup(); }
});

const decide = (unitExtra, diagnosis, evidence, extra = {}) => { const unit = U("u-build-WO-01-001", unitExtra); return fn("decideFailure")({ state: mkState([unit]), unit, failure: { source: "report_failed" }, diagnosis, evidence, ...extra }); };
await test("attempt 1 failed with a code diagnosis -> queue attempt 2, no escalation", async () => {
  const d = decide({ attempt: 1 }, DIAG("code", "off by one"), EVID());
  eq(d.action, "requeue", "action"); eq(d.attempt, 2, "next attempt");
});
await test("attempt 2 failed with NEW evidence -> attempt 3 is queued automatically as an escalation", async () => {
  const next = EVID({ tests: ["t/a.test.ts#two"], files: ["src/alpha/list.ts", "src/alpha/filter.ts"] });
  const d = decide({ attempt: 2, evidence_hash: evHash(EVID()) }, DIAG("code", "the filter ignores empty input"), next, { previous_evidence_hash: evHash(EVID()) });
  eq(d.action, "escalate", "attempt 3 is the escalation"); eq(d.attempt, 3, "third execution");
  eq(d.evidence_hash, evHash(next), "the new evidence hash is recorded for the next comparison");
});
await test("attempt 2 failed with evidence IDENTICAL to attempt 2's -> hand-back, no attempt 3", async () => {
  const d = decide({ attempt: 2, evidence_hash: evHash(EVID()) }, DIAG("code", "same again"), EVID({ files: [...EVID().files].reverse() }), { previous_evidence_hash: evHash(EVID()) });
  eq(d.action, "handback", "identical evidence must hand back"); ok(d.attempt == null || d.attempt <= 2, "no attempt 3 queued");
});
await test("attempt 2 failed with a missing/empty diagnosis -> no escalation (new evidence needs the diagnosis)", async () => {
  const d = decide({ attempt: 2, evidence_hash: evHash(EVID()) }, undefined, EVID({ tests: ["t/a.test.ts#two"] }), { previous_evidence_hash: evHash(EVID()) });
  ok(d.action !== "escalate", `attempt 3 queued without a diagnosis: ${JSON.stringify(d)}`);
});
await test("attempt 3 failed -> hand-back (budget exhausted), never a fourth execution", async () => {
  const d = decide({ attempt: 3, evidence_hash: evHash(EVID()) }, DIAG("code", "still red"), EVID({ tests: ["brand-new"] }), { previous_evidence_hash: evHash(EVID()) });
  eq(d.action, "handback", "third failure"); ok(d.attempt == null || d.attempt <= 3, "attempt 4 must not exist");
});
await test("spec-ambiguous enters the doubt ladder instead of a hand-back, at any attempt", async () => {
  for (const attempt of [1, 2]) eq(decide({ attempt }, DIAG("spec-ambiguous", "AC says both"), EVID()).action, "doubt", `attempt ${attempt}`);
});
await test("immediate hand-backs: test-defective still disputed after one reviewer reply; dependency on a missing secret/account; a human gate", async () => {
  const td = DIAG("test-defective", "the RED test asserts the wrong value");
  eq(decide({ attempt: 1 }, td, EVID(), { reviewer_replies: 1 }).action, "handback", "test-defective after a reply");
  ok(decide({ attempt: 1 }, td, EVID(), { reviewer_replies: 0 }).action !== "handback", "test-defective before any reviewer reply is not yet a hand-back");
  eq(decide({ attempt: 1 }, DIAG("dependency", "needs the STRIPE_KEY secret"), EVID()).action, "handback", "missing secret");
  eq(decide({ attempt: 1 }, DIAG("dependency", "needs an account that does not exist"), EVID()).action, "handback", "missing account");
  eq(decide({ attempt: 1 }, DIAG("code", "deploy to production needed"), EVID(), { human_gate: "production" }).action, "handback", "human gate");
});

// ---------------------------------------------------------------- hand-back parks dependents (D21)
const idsOf = (blocked) => blocked.map((b) => (typeof b === "string" ? b : b.unit ?? b.id));
const apply = (state, unitId, cause, reasonCode = "budget_exhausted") => fn("planHandback")({ state, unitId, cause, reasonCode, reason: "x" });
await test("planHandback: the unit and its transitive dependents are blocked, independent units are untouched", async () => {
  const state = mkState([
    U("u-build-WO-01-001", { state: "reported" }),
    U("u-build-WO-01-002", { state: "queued", depends_on: ["u-build-WO-01-001"] }),
    U("u-build-WO-01-003", { state: "queued", depends_on: ["u-build-WO-01-002"] }),
    U("u-build-WO-02-001", { frd: "frd-02-beta", state: "running" }),
    U("u-build-WO-02-002", { frd: "frd-02-beta", state: "queued", depends_on: ["u-build-WO-02-001"] }),
  ]);
  const before = JSON.stringify(state);
  const res = apply(state, "u-build-WO-01-001", "code");
  eq(JSON.stringify(state), before, "input state must not be mutated (pure)");
  const by = (id) => res.state.units.find((u) => u.id === id);
  eq(by("u-build-WO-01-001").state, "blocked", "the handed-back unit");
  for (const id of ["u-build-WO-01-002", "u-build-WO-01-003"]) eq(by(id).state, "blocked", `dependent ${id}`);
  eq(by("u-build-WO-02-001").state, "running", "independent running unit continues"); eq(by("u-build-WO-02-002").state, "queued", "independent queued unit continues");
  eq(idsOf(res.blocked).filter((id) => id !== "u-build-WO-01-001").sort(), ["u-build-WO-01-002", "u-build-WO-01-003"], "blocked list = the dependents (plus the unit)");
  eq(res.stop_run, false, "one hand-back does not stop the run");
});
await test("legacy planHandback helper: env-infra counter retained (active technical path bypasses this plan)", async () => {
  let r = apply(mkState([U("u-a"), U("u-b"), U("u-c"), U("u-d")]), "u-a", "env-infra", "env_infra"); eq(r.stop_run, false, "1st"); eq(r.state.handbacks_in_a_row, 1, "streak 1");
  r = apply(r.state, "u-b", "env-infra", "env_infra"); eq(r.stop_run, false, "2nd"); eq(r.state.handbacks_in_a_row, 2, "streak 2");
  r = apply(r.state, "u-c", "env-infra", "env_infra"); eq(r.stop_run, true, "3rd must stop"); eq(r.state.handbacks_in_a_row, 3, "streak 3");
});
await test("a non-env-infra hand-back resets the env-infra counter", async () => {
  let r = apply(mkState([U("u-a"), U("u-b"), U("u-c"), U("u-d")]), "u-a", "env-infra", "env_infra");
  r = apply(r.state, "u-b", "env-infra", "env_infra"); eq(r.state.handbacks_in_a_row, 2, "two in a row");
  r = apply(r.state, "u-c", "code"); eq(r.state.handbacks_in_a_row, 0, "code hand-back resets"); eq(r.stop_run, false, "no stop");
  r = apply(r.state, "u-d", "env-infra", "env_infra"); eq(r.state.handbacks_in_a_row, 1, "counting restarts at 1");
});

// ---------------------------------------------------------------- handback file (Spanish, safe on the lane branch)
await test("technical handback retries once, then rescues with failure history and no owner question", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, HB_STATE(sb));
  const branch = sb.p.unitBranch(RUN, HB_UNIT, 3); git(sb.project, ["branch", branch, "main"]);
  const head = git(sb.project, ["rev-parse", branch]);
  const first = await handBackIn(sb, lease, HB_INPUT()); eq(first.recovery, "retry", "first technical failure retries");
  const second = await handBackIn(sb, lease, HB_INPUT()); eq(second.recovery, "rescue", "same cause enters rescue");
  const unit = (await readState(sb.project, { env: sb.env })).units[0];
  eq(unit.state, "rescue", "rescue state"); eq(unit.technical_failures.length, 2, "both failures retained");
  ok(unit.technical_failures.every(f => f.code === "budget_exhausted" && f.detail === "tercer intento fallido"), "cause and diagnosis retained");
  ok(unit.rescue.skipped.length > 0, "skipped fences disclosed");
  eq(git(sb.project, ["rev-parse", branch]), head, "partial work preserved");
  const { events } = await readJournal(sb.p.journalFile, { env: sb.env });
  ok(events.some(e => e.type === "technical_failure") && events.some(e => e.type === "rescue_started"), "journal records retry and rescue");
  ok(!existsSync(sb.p.handbackFile(HB_UNIT)), "no obsolete owner handback");
  ok(!existsSync(path.join(sb.project, ".pandacorp/inbox/decisions.md")), "no technical owner question");
  await sb.fx.cleanup();
});

await test("failed rescue abandons dependent closure, preserves lease and main checkout", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, HB_STATE(sb));
  const before = git(sb.project, ["status", "--porcelain"]);
  for (let i = 0; i < 3; i++) await handBackIn(sb, lease, HB_INPUT());
  const st = await readState(sb.project, { env: sb.env });
  eq(st.units.map(u => u.state), ["abandoned", "abandoned"], "failed rescue abandons dependent closure");
  eq(st.status, "active", "run continues");
  const { events } = await readJournal(sb.p.journalFile, { env: sb.env });
  eq(events.filter(e => e.type === "rescue_started").length, 1, "one rescue only");
  eq(events.filter(e => e.type === "unit_abandoned").length, 2, "root and dependency journaled");
  ok(existsSync(path.join(sb.p.unitDir(HB_UNIT), "abandoned.json")), "abandonment report exists");
  eq(git(sb.project, ["status", "--porcelain"]), before, "main checkout unchanged");
  ok((await bs.currentLease(sb.project))?.epoch === lease.epoch, "lease held");
  await sb.fx.cleanup();
});

await test("handbackCommand rejects a unit id that is unsafe as a path segment", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, HB_STATE(sb)); let threw = false; let res; const cmd = fn("handbackCommand");
  try { res = await cmd({ project: sb.project, epoch: lease.epoch, unit: "../../etc/passwd", reason: "x" }, sb.deps); } catch { threw = true; }
  ok(threw || (res && res.ok === false), "path traversal in the unit id must be refused");
  ok(!existsSync(path.join(sb.project, ".pandacorp/etc")), "nothing written outside the handback dir");
  await sb.fx.cleanup();
});

// ---------------------------------------------------------------- failUnit (a worker ended without a valid report, RULINGS-C2 FAIL-M2)
const FU_UNIT = "u-build-WO-01-001";
const FU_STATE = (attempt, sb) => mkState([U(FU_UNIT, { attempt, state: "running", branch: sb.p.unitBranch(RUN, FU_UNIT, attempt) }), U("u-build-WO-01-002", { state: "queued", depends_on: [FU_UNIT], wos: ["WO-01-002"] }), U("u-build-WO-01-003", { state: "running", wos: ["WO-01-003"] })]);
await test("failUnit: attempt 1 without a valid report is requeued at attempt 2, the run continues (no hand-back, dependents and independents untouched, lease held)", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, FU_STATE(1, sb));
  const res = await fn("failUnit")({ project: sb.project, epoch: lease.epoch, unit: FU_UNIT, attempt: 1, cause: "env-infra", detail: "el proceso del trabajador murio", command: "codex exec", tail: "boom" }, sb.deps);
  eq(res.ok, true, "ok"); eq(res.cmd, "fail", "cmd"); eq(res.applied, true, "applied"); eq(res.action, "requeue", "action"); eq(res.next_attempt, 2, "next_attempt");
  ok(!res.handback, "no hand-back on attempt 1");
  const st = await readState(sb.project, { env: sb.env });
  const u = st.units.find((x) => x.id === FU_UNIT);
  eq([u.state, u.attempt], ["queued", 2], "same unit requeued at attempt 2");
  eq(st.units.find((x) => x.id === "u-build-WO-01-002").state, "queued", "dependent keeps waiting, not blocked");
  eq(st.units.find((x) => x.id === "u-build-WO-01-003").state, "running", "independent unit keeps running");
  const cur = await bs.currentLease(sb.project); ok(cur && cur.epoch === lease.epoch, "the run (lease) continues");
  ok(!existsSync(sb.p.handbackFile(FU_UNIT)), "no handback file");
  const again = await fn("failUnit")({ project: sb.project, epoch: lease.epoch, unit: FU_UNIT, attempt: 1, cause: "env-infra", detail: "replay" }, sb.deps);
  eq(again.applied, false, "replaying the same failed attempt is idempotent"); eq(again.reason, "already_applied", "reason");
  await sb.fx.cleanup();
});
await test("failUnit: ordinary attempt 3 records technical retry without blocking independent work", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, FU_STATE(3, sb));
  git(sb.project, ["branch", sb.p.unitBranch(RUN, FU_UNIT, 3), "main"]);
  const res = await fn("failUnit")({ project: sb.project, epoch: lease.epoch, unit: FU_UNIT, attempt: 3, cause: "code", detail: "sin informe valido", command: "codex exec", tail: "boom" }, sb.deps);
  eq(res.action, "handback", "ordinary budget policy routes through technical recovery");
  eq(res.handback.blocked, [], "technical recovery blocks no unit");
  const st = await readState(sb.project, { env: sb.env });
  eq(st.units.map(u => u.state), ["reported", "queued", "running"], "dependent and independent not blocked");
  eq(st.units[0].attempt, 3, "no ordinary fourth attempt");
  eq(st.units[0].technical_failures.length, 1, "failure evidence recorded");
  ok(!existsSync(sb.p.handbackFile(FU_UNIT)), "no technical owner handback");
  ok((await bs.currentLease(sb.project))?.epoch === lease.epoch, "lease held");
  await sb.fx.cleanup();
});

await test("failUnit: usage errors (no unit, no detail) are rejected before touching state", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, FU_STATE(1, sb));
  for (const bad of [{ attempt: 1, detail: "x" }, { unit: FU_UNIT, attempt: 1, detail: "  " }]) {
    let threw = null; try { await fn("failUnit")({ project: sb.project, epoch: lease.epoch, ...bad }, sb.deps); } catch (e) { threw = e; }
    ok(threw && threw.code === "USAGE", `expected USAGE, got ${threw && (threw.code || threw.message)}`);
  }
  eq((await readState(sb.project, { env: sb.env })).units.find((x) => x.id === FU_UNIT).state, "running", "state untouched");
  await sb.fx.cleanup();
});

// ---------------------------------------------------------------- owner-facing Spanish reason texts (RULINGS-C2 FAIL-M3)
const REASON_TEXTS = {
  worker_blocked: "el trabajador se declaró bloqueado y no puede seguir sin ti",
  worker_failed: "el trabajador falló sin informe válido en sus intentos",
  answer_rework_budget: "tu respuesta pedía rehacer una unidad que ya agotó sus 3 ejecuciones",
  owner_refused_gate: "el owner rechazó la puerta humana",
};
for (const [code, text] of Object.entries(REASON_TEXTS)) {
  await test(`handBack reason ${code}: technical recovery or authorized safety refusal retains its evidence`, async () => {
    const sb = await sandbox(); const { lease } = await seedRun(sb, HB_STATE(sb));
    const res = await handBackIn(sb, lease, HB_INPUT({ reasonCode: code, reason: "" }));
    if (code !== "owner_refused_gate") {
      eq(res.recovery, "retry", "technical reason retries autonomously");
      ok(!existsSync(res.path), "no owner handback for technical reason");
      const st = await readState(sb.project, { env: sb.env });
      eq(st.units[0].technical_failures[0].code, code, "machine cause retained");
      eq(st.status, "active", "run remains active");
      await sb.fx.cleanup(); return;
    }
    const md = await readFile(res.path, "utf8");
    ok(md.includes(text), `handback md must say: ${text}`);
    ok(!/[\u2013\u2014]/.test(text), "the reason text has no em/en dashes");
    ok(!md.includes(`motivo: ${code}`), "the raw code is not shown to the owner");
    if (res.notice_es) ok(!/[\u2013\u2014]/.test(res.notice_es), "notice_es has no em/en dashes");
    await sb.fx.cleanup();
  });
}

// ---------------------------------------------------------------- engine failure
const engineFault = () => Object.assign(new Error("simulated engine fault"), { code: "EIO" });
/** Runs withEngineRecovery; returns {ok:true,value} or {ok:false, error, result} for an ENGINE_FAILURE (exit 8). */
const recover = async (sb, lease, step, rebuildCounter) => {
  const run = fn("withEngineRecovery");
  try { return { ok: true, value: await run({ project: sb.project, epoch: lease.epoch, cmd: "next", step }, { ...sb.deps, rebuild: async () => { rebuildCounter.n++; } }) }; }
  catch (error) { if (error.code === "ENGINE_FAILURE") return { ok: false, error, result: error.result }; throw error; }
};
await test("a step that succeeds first time is returned untouched: no rebuild-state, no handback, no BL file", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U("u-build-WO-01-001")])); const rb = { n: 0 }; let calls = 0;
  const res = await recover(sb, lease, async () => { calls++; return { answer: 42 }; }, rb);
  ok(res.ok === true && res.value.answer === 42, `unexpected: ${JSON.stringify(res)}`); eq(calls, 1, "step calls"); eq(rb.n, 0, "rebuild-state calls");
  ok(!existsSync(sb.p.engineHandbackFile), "no engine handback"); ok((await bs.currentLease(sb.project)) !== null, "lease held");
  await sb.fx.cleanup();
});
await test("a fault that goes away after rebuild-state: the step is retried exactly once and succeeds, nothing stops", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U("u-build-WO-01-001")])); const rb = { n: 0 }; let calls = 0;
  const res = await recover(sb, lease, async () => { calls++; if (calls === 1) throw engineFault(); return "fine"; }, rb);
  ok(res.ok === true && res.value === "fine", `unexpected: ${JSON.stringify(res)}`);
  eq(calls, 2, "step called twice"); eq(rb.n, 1, "rebuild-state called once, between the two calls");
  ok(!existsSync(sb.p.engineHandbackFile), "no engine handback"); eq((await readState(sb.project, { env: sb.env })).status, "active", "run stays active"); ok((await bs.currentLease(sb.project)) !== null, "lease held");
  await sb.fx.cleanup();
});
await test("a repeating engine fault rescues without releasing lease or consuming ordinary attempt", async () => {
  const sb = await sandbox(); const safe = { sha: "a".repeat(40), kind: "wo-commit", at: DEFAULT_NOW };
  const { lease, state } = await seedRun(sb, mkState([U(HB_UNIT, { attempt: 2, state: "committed" }), U("u-build-WO-01-002", { state: "queued" })], { last_safe_point: safe }));
  const rb = { n: 0 }; let calls = 0;
  const res = await recover(sb, lease, async () => { calls++; throw engineFault(); }, rb);
  ok(res.ok, "engine fault recovered"); eq(res.value.body.action, "rescue", "rescue returned");
  eq(calls, 2, "two identical failures"); eq(rb.n, 1, "rebuild once");
  const after = await readState(sb.project, { env: sb.env });
  eq(after.status, "active", "not stopped"); eq(after.run_id, RUN, "same run"); eq(after.last_safe_point, safe, "safe point retained");
  eq(after.units.map(u => u.attempt), state.units.map(u => u.attempt), "no ordinary attempt consumed");
  eq(after.units[0].state, "rescue", "failed unit rescued"); eq(after.units[1].state, "queued", "independent unit untouched");
  ok((await bs.currentLease(sb.project))?.epoch === lease.epoch, "lease retained");
  const { events } = await readJournal(sb.p.journalFile, { env: sb.env });
  ok(events.some(e => e.type === "rescue_started"), "rescue journaled"); ok(!events.some(e => e.type === "run_stopped"), "no technical stop");
  await sb.fx.cleanup();
});

await test("different engine failure classes retain separate history and do not rescue yet", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U(HB_UNIT)])); let calls = 0;
  const res = await recover(sb, lease, async () => { throw Object.assign(new Error("distinct technical failure"), { code: calls++ ? "ENOENT" : "EIO" }); }, { n: 0 });
  ok(res.ok, "technical errors returned as recovery"); eq(res.value.body.outcome, "retry", "distinct causes retry");
  const st = await readState(sb.project, { env: sb.env }); eq(st.status, "active", "active");
  eq(st.units[0].technical_failures.map(f => f.code), ["EIO", "ENOENT"], "both error classes retained");
  ok(!st.units[0].rescue, "no repeated identity yet");
  ok((await bs.currentLease(sb.project))?.epoch === lease.epoch, "lease held");
  await sb.fx.cleanup();
});

await test("an engine failure during rescue abandons once and keeps independent work active", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U(HB_UNIT), U("u-build-WO-01-002", { state: "queued" })]));
  await recover(sb, lease, async () => { throw engineFault(); }, { n: 0 });
  const res = await recover(sb, lease, async () => { throw engineFault(); }, { n: 0 });
  ok(res.ok, "rescue failure returned without stopping"); eq(res.value.body.outcome, "abandoned", "rescue failed");
  const st = await readState(sb.project, { env: sb.env }); eq(st.units.map(u => u.state), ["abandoned", "queued"], "independent work retained");
  eq(st.status, "active", "run active"); ok((await bs.currentLease(sb.project))?.epoch === lease.epoch, "lease held");
  const { events } = await readJournal(sb.p.journalFile, { env: sb.env }); eq(events.filter(e => e.type === "rescue_started").length, 1, "one rescue");
  await sb.fx.cleanup();
});

await test("a fence error (FENCE/QUIESCED) is not an engine failure: rethrown at once, no retry, no handback, lease untouched", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U("u-build-WO-01-001")])); const run = fn("withEngineRecovery");
  for (const code of ["FENCE", "QUIESCED"]) {
    let calls = 0; const rb = { n: 0 }; let thrown = null;
    try { await run({ project: sb.project, epoch: lease.epoch, cmd: "next", step: async () => { calls++; throw Object.assign(new Error("fenced"), { code }); } }, { ...sb.deps, rebuild: async () => { rb.n++; } }); } catch (e) { thrown = e; }
    ok(thrown && thrown.code === code, `${code} must be rethrown, got ${thrown && thrown.code}`); eq(calls, 1, `${code}: no retry`); eq(rb.n, 0, `${code}: no rebuild-state`);
  }
  ok(!existsSync(sb.p.engineHandbackFile), "no engine handback for a fence error"); ok((await bs.currentLease(sb.project)) !== null, "lease untouched");
  const files = (await readdir(path.join(sb.factory, "factory/backlog"))).filter((f) => /^BL-/.test(f)); eq(files.length, 2, "no BL item filed");
  await sb.fx.cleanup();
});
await test("engine failure never touches a tracked file of the main checkout", async () => {
  const sb = await sandbox(); const { lease } = await seedRun(sb, mkState([U("u-build-WO-01-001", { state: "committed" })]));
  const before = git(sb.project, ["status", "--porcelain"]); const head = git(sb.project, ["rev-parse", "HEAD"]);
  await recover(sb, lease, async () => { throw engineFault(); }, { n: 0 });
  eq(git(sb.project, ["status", "--porcelain"]), before, "working tree unchanged"); eq(git(sb.project, ["rev-parse", "HEAD"]), head, "main untouched, nothing landed");
  await sb.fx.cleanup();
});

await rm(scratch, { recursive: true, force: true });
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
