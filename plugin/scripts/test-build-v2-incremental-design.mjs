#!/usr/bin/env node
// Incremental UI changes: specialist planning, design provenance, no owner pause, bounded WO reopening.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFixture, git, testEnv, writeSignalsFile } from "./fixtures/build-v2/make-fixture.mjs";
import { changePreparationUnits, designPaths, existingWoAmendmentProblem } from "../runtime/build/incremental.mjs";
import { checkCardText, renderCard, updateFrontmatter } from "../runtime/build/card.mjs";
import { capacityTaskForUnit } from "../runtime/build/routing.mjs";
import { agentTypeForUnit } from "../runtime/build/next/constants.mjs";
import { plan, readPlanWorkOrders } from "../runtime/build/planner.mjs";
import { newState, newUnit, readState, writeState } from "../runtime/build/state.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { acquire } from "../runtime/build-state.mjs";
import { issueToken } from "../runtime/build/admission.mjs";
import { appendEvent } from "../runtime/build/journal.mjs";
import { ingestReport } from "../runtime/build/report.mjs";
import { writeBrief } from "../runtime/build/units/dispatch.mjs";
import { writeUnitBrief } from "../runtime/build/units/brief.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS ${name}`); passed++; } catch (e) { console.error(`FAIL ${name}: ${e.stack}`); failed++; } };
const FRD = "frd-01-alpha"; const CARD = "small-modal";
const card = (over = {}) => ({ type: "change", date: "2026-11-14", title: "Modal", dentro: ['"Add a modal" (owner message)'], ui: true, design_source: "pending", ...over });
const wo = (over = {}) => ({ id: "wo-01-001", frd: FRD, status: "PLANNED", deps: [], artifacts: ["src/components/modal.tsx"], ui: true, source_change: [CARD], acs: [], ...over });
const scope = { card: CARD, frds: [FRD], wos: [], out_of_scope: [] };

await test("card design_source records citations and rejects an unsupported or unbound source", () => {
  assert.equal(checkCardText(renderCard(card({ design_source: "agreed", design_refs: ['owner: "use a compact modal"'] }))).ok, true);
  assert.equal(checkCardText(renderCard(card({ design_source: "agreed", design_refs: [] }))).ok, false);
  assert.equal(checkCardText(renderCard(card({ design_source: "invented" }))).ok, false);
  assert.equal(checkCardText(renderCard(card({ ui: false, design_source: "pending" }))).ok, false);
  assert.equal(checkCardText(renderCard(card({ ui: false, design_source: "not-applicable" }))).ok, true);
});
await test("docs preparation uses serial product-manager, designer and architect units with planning capacity", () => {
  const units = changePreparationUnits({ ...card(), frd: FRD }, CARD);
  assert.deepEqual(units.map(u => u.role), ["product-manager", "designer", "architect"]);
  assert.deepEqual(units[1].depends_on, [units[0].id]); assert.deepEqual(units[2].depends_on, [units[1].id]);
  for (const u of units) { assert.equal(capacityTaskForUnit(u).type, "design"); assert.equal(agentTypeForUnit(u), `pandacorp:${u.role}`); }
  assert.deepEqual(changePreparationUnits(card({ design_source: "agreed", design_refs: ["owner citation"] }), CARD).map(u => u.role), ["product-manager", "architect"]);
  assert.deepEqual(changePreparationUnits(card({ ui: false, design_source: "not-applicable" }), CARD).map(u => u.role), ["product-manager", "architect"]);
});
await test("UI WO without source receives lightweight design before build while independent non-UI work continues", () => {
  const result = plan({ wos: [wo(), wo({ id: "wo-02-001", frd: "frd-02-beta", artifacts: ["src/query.ts"], ui: false })], scope, capacity: 5 });
  const designer = result.units.find(u => u.role === "designer"); const build = result.units.find(u => u.kind === "build" && u.frd === FRD);
  assert.ok(designer); assert.equal(designer.kind, "docs"); assert.ok(build.depends_on.includes(designer.id));
  assert.ok(result.round.includes(designer.id)); assert.ok(!result.round.includes(build.id));
  assert.ok(result.round.includes("u-build-wo-02-001")); assert.equal(result.deadlock, null);
  assert.ok(!result.units.some(u => u.parked || u.waiting_gate));
});
await test("agreed conversation design and existing artifacts bypass redesign even for inferred UI", () => {
  for (const source of ["agreed", "existing"]) {
    const result = plan({ wos: [wo()], scope, design: { ui: true, design_source: source, design_refs: [source === "agreed" ? "owner message 4" : `docs/frds/${FRD}/fdd.md`] } });
    assert.ok(!result.units.some(u => u.role === "designer")); assert.ok(result.round.includes("u-build-wo-01-001"));
  }
});
await test("pending card design is not mistaken for an old FDD, completed designer is reused", () => {
  const input = { wos: [wo({ design_source: "existing", design_refs: ["old/fdd.md"] })], scope, design: card() };
  assert.ok(plan(input).units.some(u => u.role === "designer"));
  const designer = newUnit({ id: `u-design-${CARD}`, kind: "docs", role: "designer", frd: FRD, state: "integrated", design_refs: designPaths(FRD, CARD) });
  assert.ok(!plan({ ...input, units: [designer] }).units.some(u => u.role === "designer"));
});

const withFixture = async (fn) => {
  const dir = await fs.mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "pc-incremental-"));
  const fixture = await createFixture("basic", { dir });
  try { return await fn(fixture, dir); } finally { await fixture.cleanup(); await fs.rm(dir, { recursive: true, force: true }); }
};
await test("disk reader recognizes existing FDD as legacy UI source and preserves explicit pending", () => withFixture(async (fx) => {
  const fdd = path.join(fx.root, `docs/frds/${FRD}/fdd.md`); await fs.writeFile(fdd, "# Scoped modal\n");
  const file = path.join(fx.root, `docs/frds/${FRD}/work-orders/wo-01-001.md`);
  await fs.writeFile(file, updateFrontmatter(await fs.readFile(file, "utf8"), { set: { ui: true } }));
  const read = await readPlanWorkOrders(fx.root);
  const node = read.wos.find(w => w.id === "wo-01-001"); assert.equal(node.design_source, "existing"); assert.deepEqual(node.design_refs, [`docs/frds/${FRD}/fdd.md`]);
  await fs.writeFile(file, updateFrontmatter(await fs.readFile(file, "utf8"), { set: { design_source: "pending" } }));
  assert.equal((await readPlanWorkOrders(fx.root)).wos.find(w => w.id === node.id).design_source, "pending");
}));

async function reportFixture(fx, dir, role = "architect") {
  const env = testEnv(dir); const deps = { env, homedir: dir, computeRisk: async () => ({ zone: "none", failclosed: false, signals: { classify: [] } }) };
  const paths = buildPaths(fx.root, deps); const runId = "br-2026-11-14-01"; const branch = `integration/${runId}`;
  git(fx.root, ["worktree", "add", "-q", "-b", branch, paths.integrationWorktree, "main"]);
  const lease = await acquire(fx.root, { runtime: "claude", runId, ttlSeconds: 1800, projectStatus: false });
  const id = `u-${role}-${CARD}`; const token = issueToken(id, "B", { file: paths.admissionFile });
  const wt = paths.unitWorktree(id, 1); const unitBranch = paths.unitBranch(runId, id, 1);
  git(fx.root, ["worktree", "add", "-q", "-b", unitBranch, wt, branch]);
  const unit = newUnit({ id, kind: "docs", role, frd: FRD, design_refs: designPaths(FRD, CARD), state: "running", worktree: wt, branch: unitBranch, token_hash: token.token_hash });
  const state = newState({ run_id: runId, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "touch", scope, units: [unit], integration: { branch, worktree: paths.integrationWorktree, base_sha: fx.sha } });
  await writeState(fx.root, state, deps);
  await appendEvent(paths.journalFile, { run_id: runId, epoch: lease.epoch, actor: "cli", type: "run_started", data: { state } }, deps);
  const submit = async files => {
    const report = { schema: 1, unit: id, token: token.token, status: "done", summary: "bounded delta", files,
      verification: [{ command: "bash .pandacorp/verify.sh --light", exit_code: 0, tail: "green" }], pending: [], doubt: null, diagnosis: null, gate: null, authored_by: { runtime: "claude", model: "opus", effort: "high" } };
    const file = paths.reportFile(id); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(report));
    return ingestReport({ project: fx.root, epoch: lease.epoch, unit: id, token: token.token, file }, deps);
  };
  return { deps, paths, unit, state, submit, wt };
}
await test("report accepts a card architect reopening VERIFIED WO and planner schedules its incremental scope", () => withFixture(async (fx, dir) => {
  const rel = `docs/frds/${FRD}/work-orders/wo-01-001.md`; const original = await fs.readFile(path.join(fx.root, rel), "utf8");
  await fs.writeFile(path.join(fx.root, rel), updateFrontmatter(original, { set: { implementation_status: "VERIFIED", source_change: ["previous-change"], reopen_count: 2 } }));
  git(fx.root, ["add", rel]); git(fx.root, ["commit", "-qm", "fixture: previously verified WO"]);
  const c = await reportFixture(fx, dir);
  const before = await fs.readFile(path.join(c.wt, rel), "utf8");
  const after = updateFrontmatter(before, { set: { implementation_status: "PLANNED", source_change: ["previous-change", CARD], reopen_count: 3, complexity: "normal", artifacts: ["src/alpha/list.ts", "src/alpha/filter.ts"] } }) + `\n## Status Note\nReopened by ${CARD}: extend the filter behavior.\n`;
  await fs.writeFile(path.join(c.wt, rel), after);
  const result = await c.submit([rel]); assert.equal(result.outcome, "committed", JSON.stringify(result));
  assert.equal((await readState(fx.root, c.deps)).units[0].state, "committed");
  const data = await readPlanWorkOrders(c.wt); const planned = plan({ wos: data.wos, scope });
  assert.ok(planned.units.some(u => u.kind === "build" && u.wos.includes("wo-01-001")));
  assert.equal(git(fx.root, ["status", "--porcelain"]), "");
}));
await test("WO amendment cannot change identity, drop previous card, bypass activation or reopen a claimed unit", () => {
  const before = "---\nid: WO-01-001\nstatus: ACTIVE\nimplementation_status: VERIFIED\nsource_change: [old]\n---\n# WO\n";
  const after = updateFrontmatter(before, { set: { implementation_status: "PLANNED", source_change: ["old", CARD], reopen_count: 1 } }) + `\n## Status Note\n${CARD}: extend modal.\n`;
  const args = { unit: { kind: "docs", role: "architect" }, card: CARD, before, after };
  assert.equal(existingWoAmendmentProblem(args), null);
  for (const set of [{ id: "WO-99-001" }, { source_change: [CARD] }, { status: "DRAFT" }, { reopen_count: 0 }]) assert.ok(existingWoAmendmentProblem({ ...args, after: updateFrontmatter(after, { set }) }));
  assert.ok(existingWoAmendmentProblem({ ...args, claimed: true }));
  assert.ok(existingWoAmendmentProblem({ ...args, unit: { kind: "build" } }));
  assert.ok(existingWoAmendmentProblem({ ...args, unit: { kind: "docs", role: "product-manager" } }));
});
await test("report rejects a lightweight designer without FDD/mock instead of releasing dependent UI", () => withFixture(async (fx, dir) => {
  const c = await reportFixture(fx, dir, "designer"); const rel = "docs/decision-log.md";
  await fs.appendFile(path.join(c.wt, rel), "\nAgent selected a reversible compact modal.\n");
  const result = await c.submit([rel]); assert.equal(result.outcome, "rejected"); assert.match(result.reasons.join(" "), /FDD and mock/);
}));
await test("designer report commits only scoped artifacts and brief forbids global phase/gate actions", () => withFixture(async (fx, dir) => {
  const c = await reportFixture(fx, dir, "designer");
  for (const rel of c.unit.design_refs) { await fs.mkdir(path.dirname(path.join(c.wt, rel)), { recursive: true }); await fs.writeFile(path.join(c.wt, rel), rel.endsWith("html") ? "<main>Modal mock</main>" : "# Modal delta\nUse existing tokens.\n"); }
  const brief = await writeUnitBrief({ project: fx.root, state: c.state, unit: c.unit, cell: { runtime: "claude", model: "opus", effort: "high" }, agentType: agentTypeForUnit(c.unit), token: "brief-token", schemaPath: c.paths.schemaFile("report"), worktree: c.wt }, c.deps);
  assert.match(brief.text, /agents\/designer\.md/); assert.match(brief.text, /No owner visual approval, global freeze, phase change or skill invocation/);
  assert.match(brief.text, /taken by the agent, reversible/);
  const result = await c.submit(c.unit.design_refs); assert.equal(result.outcome, "committed", JSON.stringify(result));
  assert.equal(git(fx.root, ["show", "HEAD:.pandacorp/status.yaml"]), git(fx.root, ["show", `${result.commit}:.pandacorp/status.yaml`]));
}));
await test("public writeBrief dispatch uses product-manager role rather than generic implementer", () => withFixture(async (fx, dir) => {
  const c = await reportFixture(fx, dir, "product-manager");
  const brief = await writeBrief({ project: fx.root, unit: c.unit, cell: { runtime: "claude", model: "opus", effort: "high" }, token: "public-token", worktree: c.wt }, c.deps);
  assert.match(brief.text, /Act as `pandacorp:product-manager`/); assert.match(brief.text, /agents\/product-manager\.md/);
  assert.match(brief.text, /Own only the product delta/); assert.doesNotMatch(brief.text, /Act as `pandacorp:implementer`/);
}));
await test("real CLI start and plan preserve agreed conversation design from ignored owner card", () => withFixture(async (fx, dir) => {
  const env = testEnv(dir); await fs.mkdir(env.HOME, { recursive: true }); await fs.writeFile(env.PANDACORP_FAKE_WORKER_PLAN, "{}\n");
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  const rel = `docs/frds/${FRD}/work-orders/wo-01-001.md`;
  await fs.writeFile(path.join(fx.root, rel), updateFrontmatter(await fs.readFile(path.join(fx.root, rel), "utf8"), { set: { artifacts: ["src/components/modal.tsx"], ui: true, source_change: [CARD] } }));
  git(fx.root, ["add", rel]); git(fx.root, ["commit", "-qm", "fixture: scoped UI delta"]);
  const queue = path.join(fx.root, ".pandacorp/inbox/changes"); await fs.mkdir(queue, { recursive: true });
  await fs.writeFile(path.join(queue, `${CARD}.md`), renderCard(card({ frd: FRD, design_source: "agreed", design_refs: ['owner message 4: "Use the compact modal we agreed"'], design_decision_by: "owner" })));
  const cliFile = fileURLToPath(new URL("./pandacorp-build.mjs", import.meta.url));
  const cli = args => {
    const out = spawnSync(process.execPath, [cliFile, ...args, "--project", fx.root], { cwd: fx.root, env, encoding: "utf8", timeout: 60000 });
    const json = JSON.parse((out.stdout || "").trim().split("\n").at(-1));
    assert.equal(out.status, 0, `${args.join(" ")}: ${JSON.stringify(json)} ${out.stderr}`); return json;
  };
  let started;
  try {
    const detected = cli(["start", "--detect", "--args", `change:${CARD}`]);
    const scopeFile = path.join(dir, "agreed-scope.json"); await fs.writeFile(scopeFile, JSON.stringify(detected.scope));
    const before = cli(["plan", "--scope-json", scopeFile]);
    assert.ok(before.units.some(u => u.kind === "build")); assert.ok(!before.units.some(u => u.id.startsWith("u-design-")));
    cli(["start", "--preflight", "--row", String(detected.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]);
    started = cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet"]);
    const state = await readState(fx.root, { env }); assert.deepEqual(state.units.map(u => u.role), ["product-manager", "architect"]);
    assert.ok(!state.units.some(u => u.id.startsWith("u-design-")));
    const during = cli(["plan"]); assert.ok(during.units.some(u => u.kind === "build")); assert.ok(!during.units.some(u => u.id.startsWith("u-design-")));
  } finally {
    if (started) { try { cli(["stop", "--epoch", String(started.epoch)]); } catch { /* cleanup still owns only fixture processes */ } }
    const paths = buildPaths(fx.root, { env });
    const standby = await fs.readFile(paths.driveStandbyFile, "utf8").then(JSON.parse, () => null);
    const caffeinate = Number(await fs.readFile(paths.driveCaffeinatePidFile, "utf8").catch(() => ""));
    for (const pid of [started?.drive?.pid, standby?.pid, caffeinate]) if (Number.isInteger(pid) && pid > 1) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
  }
}));
await test("real CLI pending UI integrates lightweight designer before dispatching construction without an owner pause", () => withFixture(async (fx, dir) => {
  const env = testEnv(dir, { PANDACORP_FAKE_WORKER: fileURLToPath(new URL("./fixtures/build-v2/fake-worker-e2e.mjs", import.meta.url)) }); await fs.mkdir(env.HOME, { recursive: true }); await fs.writeFile(env.PANDACORP_FAKE_WORKER_PLAN, "{}\n");
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  const rel = `docs/frds/${FRD}/work-orders/wo-01-001.md`;
  await fs.writeFile(path.join(fx.root, rel), updateFrontmatter(await fs.readFile(path.join(fx.root, rel), "utf8"), { set: { artifacts: ["src/components/modal.tsx"], ui: true, source_change: [CARD] } }));
  git(fx.root, ["add", rel]); git(fx.root, ["commit", "-qm", "fixture: scoped UI delta"]);
  const queue = path.join(fx.root, ".pandacorp/inbox/changes"); await fs.mkdir(queue, { recursive: true });
  await fs.writeFile(path.join(queue, `${CARD}.md`), renderCard(card({ frd: FRD, design_source: "pending", design_refs: [], design_decision_by: "agent" })));
  const cliFile = fileURLToPath(new URL("./pandacorp-build.mjs", import.meta.url));
  const cli = args => {
    const out = spawnSync(process.execPath, [cliFile, ...args, "--project", fx.root], { cwd: fx.root, env, encoding: "utf8", timeout: 60000 });
    const json = JSON.parse((out.stdout || "").trim().split("\n").at(-1));
    assert.equal(out.status, 0, `${args.join(" ")}: ${JSON.stringify(json)} ${out.stderr}`); return json;
  };
  let started;
  try {
    const detected = cli(["start", "--detect", "--args", `change:${CARD}`]);
    const scopeFile = path.join(dir, "agreed-scope.json"); await fs.writeFile(scopeFile, JSON.stringify(detected.scope));
    const before = cli(["plan", "--scope-json", scopeFile]);
    assert.ok(before.units.some(u => u.kind === "build")); assert.ok(before.units.some(u => u.id.startsWith("u-design-")));
    cli(["start", "--preflight", "--row", String(detected.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]);
    started = cli(["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet"]);
    const state = await readState(fx.root, { env }); assert.deepEqual(state.units.map(u => u.role), ["product-manager", "designer", "architect"]);
    let built = false;
    for (let attempt = 0; attempt < 30 && !built; attempt++) {
      const action = cli(["next", "--epoch", String(started.epoch)]);
      assert.ok(["dispatch", "wait"].includes(action.action), JSON.stringify(action));
      for (const dispatched of action.units ?? []) {
        if (dispatched.kind === "build") {
          const current = await readState(fx.root, { env });
          const design = current.units.find(u => u.role === "designer");
          assert.equal(design.state, "integrated");
          for (const ref of design.design_refs) assert.ok((await fs.readFile(path.join(current.integration.worktree, ref), "utf8")).trim());
          built = true; break;
        }
        if (dispatched.via === "cli") continue;
        assert.equal(dispatched.kind, "docs");
        const current = await readState(fx.root, { env }); const unit = current.units.find(u => u.id === dispatched.unit);
        const files = unit.role === "designer" ? unit.design_refs : [`docs/frds/${FRD}/${unit.role === "product-manager" ? "frd" : "blueprint"}.md`];
        for (const rel of files) {
          const file = path.join(dispatched.worktree, rel); await fs.mkdir(path.dirname(file), { recursive: true });
          const content = unit.role === "designer" ? rel.endsWith(".html") ? "<!doctype html><main>Compact modal</main>" : "# Scoped modal FDD\nReuse tokens. Agent decided, reversible."
            : `${await fs.readFile(file, "utf8")}\nIncremental ${unit.role} delta retains the fixture contract.\n`;
          await fs.writeFile(file, content);
        }
        const report = { schema: 1, unit: dispatched.unit, token: dispatched.token, status: "done", summary: "bounded specialist delta", files,
          verification: [{ command: "bash .pandacorp/verify.sh --light", exit_code: 0, tail: "green" }], pending: [], doubt: null, diagnosis: null, gate: null, authored_by: { runtime: dispatched.runtime, model: dispatched.model, effort: dispatched.effort } };
        await fs.writeFile(dispatched.report_path, JSON.stringify(report));
        assert.equal(cli(["report", "--epoch", String(started.epoch), "--unit", dispatched.unit, "--token", dispatched.token, "--file", dispatched.report_path]).outcome, "committed");
      }
      if (!built) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(built, "pending UI never reached construction");
  } finally {
    if (started) { try { cli(["stop", "--epoch", String(started.epoch)]); } catch { /* cleanup still owns only fixture processes */ } }
    const paths = buildPaths(fx.root, { env });
    const standby = await fs.readFile(paths.driveStandbyFile, "utf8").then(JSON.parse, () => null);
    const caffeinate = Number(await fs.readFile(paths.driveCaffeinatePidFile, "utf8").catch(() => ""));
    for (const pid of [started?.drive?.pid, standby?.pid, caffeinate]) if (Number.isInteger(pid) && pid > 1) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
  }
}));
console.log(`RESULT: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
