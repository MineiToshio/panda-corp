#!/usr/bin/env node
// Permanent regressions from independent P9 review probes (H1-H4).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createFixture, git, testEnv, writeSignalsFile } from "./fixtures/build-v2/make-fixture.mjs";
import { plan, readPlanWorkOrders } from "../runtime/build/planner.mjs";
import { capacityTaskForUnit, builderCell } from "../runtime/build/routing.mjs";
import { buildModel } from "../runtime/build/planner/model.mjs";
import { changePreparationUnits, designPaths } from "../runtime/build/incremental.mjs";
import { renderCard, updateFrontmatter } from "../runtime/build/card.mjs";
import { newState, newUnit, readState, writeState, foldJournal } from "../runtime/build/state.mjs";
import { writeUnitBrief } from "../runtime/build/units/brief.mjs";
import { createIntegrationWorktree } from "../runtime/build/integrate/worktrees.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { acquire } from "../runtime/build-state.mjs";
import { appendEvent, readJournal } from "../runtime/build/journal.mjs";
import { planRound } from "../runtime/build/next/planning.mjs";
import { assertDesignHandoff } from "../runtime/build/visual-source.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } };
const frd = "frd-01-alpha", id = "wo-01-001";
const woPath = `docs/frds/${frd}/work-orders/${id}.md`, frdPath = `docs/frds/${frd}/frd.md`;
const scope = { card: null, frds: [], wos: [id], out_of_scope: [] };
const withFixture = async fn => {
  const dir = await fs.mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "pc-visual-source-"));
  const fx = await createFixture("basic", { dir });
  try { await fn(fx, dir); } finally { await fx.cleanup(); await fs.rm(dir, { recursive: true, force: true }); }
};
const put = async (root, ref, text) => { await fs.mkdir(path.dirname(path.join(root, ref)), { recursive: true }); await fs.writeFile(path.join(root, ref), text); };
const stamp = async (fx, ref, fields) => put(fx.root, ref, updateFrontmatter(await fs.readFile(path.join(fx.root, ref), "utf8"), { set: fields }));

await test("H3: FRD UI metadata covers directory globs; explicit backend WO wins", () => withFixture(async fx => {
  await stamp(fx, frdPath, { ui: true });
  await stamp(fx, woPath, { artifacts: ["src/app/account/**"] });
  let read = await readPlanWorkOrders(fx.root);
  let result = plan({ ...read, scope });
  assert.ok(result.units.some(u => u.role === "designer"));
  assert.ok(!result.round.includes(`u-build-${id}`));
  await stamp(fx, woPath, { ui: false });
  read = await readPlanWorkOrders(fx.root);
  result = plan({ ...read, scope });
  assert.ok(!result.units.some(u => u.role === "designer"));
  assert.ok(result.round.includes(`u-build-${id}`));
}));

await test("H2: planner and brief consume the same integrated non-FRD design references", () => withFixture(async (fx, dir) => {
  const card = { ui: true, design_source: "pending", frd: null };
  const refs = designPaths(null, "new-panel");
  const designer = newUnit({ id: "u-design-new-panel", kind: "docs", role: "designer", state: "integrated", design_refs: refs });
  for (const ref of refs) await put(fx.root, ref, "Scoped integrated design reference\n");
  await stamp(fx, woPath, { ui: true, design_source: "pending", source_change: ["new-panel"] });
  await put(fx.root, ".pandacorp/inbox/changes/new-panel.md", renderCard({ type: "change", date: "2026-11-14", title: "Panel", dentro: ["Add panel (owner quote)"], ...card }));
  const selected = { ...scope, card: "new-panel" };
  const read = await readPlanWorkOrders(fx.root, { units: [designer], design: card });
  const model = buildModel({ ...read, scope: selected, units: [designer], design: card });
  assert.deepEqual(model.nodes.get(id).design_refs, refs);
  const build = newUnit({ id: `u-build-${id}`, kind: "build", wos: [id], frd });
  const state = newState({ run_id: "br-2026-11-14-01", epoch: 1, coordinator: "claude-session", label: "claude", size: "touch", scope: selected, units: [designer, build], integration: { branch: "main", worktree: fx.root, base_sha: fx.sha } });
  const brief = await writeUnitBrief({ project: fx.root, state, unit: build, cell: { runtime: "claude", model: "sonnet", effort: "high" }, agentType: "pandacorp:implementer", token: "test-token", schemaPath: "schema", worktree: fx.root }, { env: fx.env(), homedir: dir });
  for (const ref of refs) assert.ok(brief.text.includes(path.join(fx.root, ref)), `missing effective context source ${ref}`);
  assert.ok(!brief.text.includes(`\"docs/frds/${frd}/fdd.md\"`));
}));

const mixedWos = [
  { id: "wo-01", frd: "frd-01", status: "PLANNED", ui: true, artifacts: ["src/widget.tsx"], source_change: ["mixed"] },
  { id: "wo-02", frd: "frd-02", status: "PLANNED", ui: false, artifacts: ["src/api.ts"], source_change: ["mixed"] },
];
const mixed = { wos: mixedWos, scope: { card: "mixed", frds: [], wos: ["wo-01", "wo-02"], out_of_scope: [] }, design: { ui: true, design_source: "pending" }, capacity: 5 };
await test("H4: real preparation chain lets backend build while its UI designer runs", () => {
  const prep = changePreparationUnits(mixed.design, "mixed");
  assert.deepEqual(prep.map(u => u.role), ["product-manager", "architect"]);
  for (const u of prep) u.state = "integrated";
  const first = plan({ ...mixed, units: prep });
  const designer = first.units.find(u => u.role === "designer");
  assert.ok(designer);
  assert.deepEqual(designer.wos, ["wo-01"]);
  const running = plan({ ...mixed, units: [...prep, { ...designer, state: "running" }] });
  assert.ok(running.now.includes("u-build-wo-02"));
  assert.ok(!running.round.includes("u-build-wo-01"));
  assert.equal(running.deadlock, null);
});
await test("H4b: a mixed UI card never adds a designer to an explicitly non-UI WO", () => {
  const units = changePreparationUnits(mixed.design, "mixed").map(u => ({ ...u, state: "integrated" }));
  assert.equal(buildModel({ ...mixed, units }).nodes.get("wo-02").ui, false);
  const result = plan({ ...mixed, units });
  assert.ok(!result.units.some(u => u.role === "designer" && u.wos.includes("wo-02")));
  assert.ok(result.round.includes("u-build-wo-02"));
});

await test("H1: uncommitted standalone files do not count as available integration design", () => withFixture(async (fx, dir) => {
  await stamp(fx, woPath, { ui: true });
  git(fx.root, ["add", woPath]); git(fx.root, ["commit", "-qm", "fixture UI work order"]);
  const refs = designPaths(frd, "standalone");
  for (const ref of refs) await put(fx.root, ref, "Standalone delta\n");
  const created = await createIntegrationWorktree({ project: fx.root, runId: "br-2026-11-14-standalone" }, { env: fx.env(), homedir: dir });
  const read = await readPlanWorkOrders(created.worktree);
  const result = plan({ ...read, scope, design: { ui: true, design_source: "existing", design_refs: refs } });
  assert.ok(result.units.some(u => u.role === "designer"));
  assert.ok(!result.round.includes(`u-build-${id}`));
}));

await test("H1 handoff: commit the exact standalone files before creating integration, including nested products", async () => {
  for (const nested of [false, true]) {
    const dir = await fs.mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), "pc-design-handoff-"));
    const fx = await createFixture({ nested }, { dir });
    try {
      const refs = designPaths(frd, "standalone");
      const source = { ui: true, design_source: "existing", design_refs: refs };
      for (const ref of refs) await put(fx.root, ref, "Scoped standalone delta\n");
      await assert.rejects(assertDesignHandoff(fx.root, source), /Design handoff incomplete/);
      git(fx.root, ["add", "--", ...refs]); git(fx.root, ["commit", "-qm", "fixture: conversation hands off design"]);
      const sha = await assertDesignHandoff(fx.root, source);
      // Detect tracked edits too: a path existing at HEAD is insufficient when the delta was never recorded.
      await put(fx.root, refs[0], "Newer standalone delta\n");
      await assert.rejects(assertDesignHandoff(fx.root, source), /Design handoff incomplete/);
      await put(fx.root, refs[0], "Scoped standalone delta\n");
      const created = await createIntegrationWorktree({ project: fx.root, runId: "br-2026-11-14-handoff", baseRef: sha }, { env: fx.env(), homedir: dir });
      const consumingRoot = nested ? path.join(created.worktree, "nested") : created.worktree;
      assert.equal(await assertDesignHandoff(consumingRoot, source, {}, sha), sha);
      const read = await readPlanWorkOrders(consumingRoot, { design: source });
      const result = plan({ ...read, wos: [{ ...read.wos[0], ui: true }], scope, design: source });
      assert.ok(result.round.includes(`u-build-${id}`));
      assert.ok(!result.units.some(u => u.role === "designer"));
      assert.equal(await assertDesignHandoff(fx.root, { design_source: "agreed", design_refs: ['owner: "compact modal"'] }), null);
    } finally { await fx.cleanup(); await fs.rm(dir, { recursive: true, force: true }); }
  }
});

await test("H2 fail closed: missing or empty integrated designer files cannot release UI", () => withFixture(async (fx, dir) => {
  await stamp(fx, woPath, { ui: true, design_source: "pending" });
  const refs = designPaths(frd, id);
  const designer = newUnit({ id: `u-design-${id}`, kind: "docs", role: "designer", frd, wos: [id], state: "integrated", design_refs: refs });
  for (const ref of refs) await put(fx.root, ref, " ");
  const read = await readPlanWorkOrders(fx.root, { units: [designer] });
  const result = plan({ ...read, scope, units: [designer] });
  assert.ok(result.units.some(u => u.role === "designer" && u.id !== designer.id));
  assert.ok(!result.round.includes(`u-build-${id}`));
  const unit = newUnit({ id: `u-build-${id}`, kind: "build", wos: [id], frd });
  const state = newState({ run_id: "br-2026-11-14-01", epoch: 1, coordinator: "claude-session", label: "claude", size: "touch", scope, units: [designer, unit], integration: { branch: "main", worktree: fx.root, base_sha: fx.sha } });
  await assert.rejects(writeUnitBrief({ project: fx.root, state, unit, cell: { runtime: "claude", model: "sonnet", effort: "high" }, agentType: "pandacorp:implementer", token: "test", schemaPath: "schema", worktree: fx.root }, { env: fx.env(), homedir: dir }), /no available design source/);
}));

await test("H1 real CLI rejects dirty handoff before lease; committed design is pinned and never redesigned", () => withFixture(async (fx, dir) => {
  const env = testEnv(dir);
  await fs.mkdir(env.HOME, { recursive: true });
  await fs.writeFile(env.PANDACORP_FAKE_WORKER_PLAN, "{}\n");
  await writeSignalsFile(env.PANDACORP_SIGNALS_FILE, "clean");
  const refs = designPaths(frd, "cli-handoff");
  await stamp(fx, woPath, { ui: true, artifacts: ["src/components/modal.tsx"], source_change: ["cli-handoff"] });
  for (const ref of refs) await put(fx.root, ref, "Committed scoped design\n");
  git(fx.root, ["add", "--", woPath, ...refs]);
  git(fx.root, ["commit", "-qm", "fixture: conversation records standalone design"]);
  const sourceSha = git(fx.root, ["rev-parse", "HEAD"]);
  await put(fx.root, ".pandacorp/inbox/changes/cli-handoff.md", renderCard({ type: "change", date: "2026-11-14", title: "Panel", dentro: ['Add agreed panel, owner: "Add the panel"'], ui: true, frd, design_source: "existing", design_refs: refs, design_decision_by: "agent" }));
  const cliFile = fileURLToPath(new URL("./pandacorp-build.mjs", import.meta.url));
  const cli = (args, success = true) => {
    const out = spawnSync(process.execPath, [cliFile, ...args, "--project", fx.root], { cwd: fx.root, env, encoding: "utf8", timeout: 60000 });
    const json = JSON.parse((out.stdout || "").trim().split("\n").at(-1));
    if (success) assert.equal(out.status, 0, `${args.join(" ")}: ${JSON.stringify(json)} ${out.stderr}`);
    else assert.notEqual(out.status, 0);
    return json;
  };
  const paths = buildPaths(fx.root, { env });
  let started;
  try {
    const detected = cli(["start", "--detect", "--args", "change:cli-handoff"]);
    const scopeFile = path.join(dir, "scope.json");
    await fs.writeFile(scopeFile, JSON.stringify(detected.scope));
    cli(["start", "--preflight", "--row", String(detected.row), "--scope-json", scopeFile, "--label", "claude", "--session-model", "sonnet", "--probe-codex"]);
    const args = ["start", "--run", "--scope-json", scopeFile, "--label", "claude", "--coordinator", "claude", "--session-model", "sonnet"];
    await put(fx.root, refs[0], "Unrecorded newer delta\n");
    assert.match(JSON.stringify(cli(args, false)), /Design handoff incomplete/);
    assert.equal(await fs.access(paths.leaseFile).then(() => true, () => false), false, "dirty design must fail before taking lease");
    assert.equal(await fs.access(paths.stateFile).then(() => true, () => false), false, "dirty design must not create a run");
    await put(fx.root, refs[0], "Committed scoped design\n");
    started = cli(args);
    const state = await readState(fx.root, { env });
    assert.equal(state.integration.base_sha, sourceSha);
    assert.equal(git(state.integration.worktree, ["rev-parse", "HEAD"]), sourceSha);
    for (const ref of refs) assert.equal(await fs.readFile(path.join(state.integration.worktree, ref), "utf8"), "Committed scoped design\n");
    const during = cli(["plan"]);
    assert.ok(during.units.some(u => u.kind === "build"));
    assert.ok(!during.units.some(u => u.role === "designer"));
  } finally {
    if (started) { try { cli(["stop", "--epoch", String(started.epoch)]); } catch { /* fixture cleanup follows */ } }
    const standby = await fs.readFile(paths.driveStandbyFile, "utf8").then(JSON.parse, () => null);
    const caffeinate = Number(await fs.readFile(paths.driveCaffeinatePidFile, "utf8").catch(() => ""));
    for (const pid of [started?.drive?.pid, standby?.pid, caffeinate]) if (Number.isInteger(pid) && pid > 1) { try { process.kill(pid, "SIGKILL"); } catch { /* already stopped */ } }
  }
}));

await test("H1 binary handoff: distinct valid BMP bytes with identical UTF-8 text must be rejected", () => withFixture(async (fx, dir) => {
  const before = Buffer.alloc(58);
  before.write("BM"); before.writeUInt32LE(58, 2); before.writeUInt32LE(54, 10);
  before.writeUInt32LE(40, 14); before.writeInt32LE(1, 18); before.writeInt32LE(1, 22);
  before.writeUInt16LE(1, 26); before.writeUInt16LE(24, 28); before.writeUInt32LE(4, 34); before[54] = 128;
  const after = Buffer.from(before); after[54] = 129;
  assert.notDeepEqual(before, after);
  assert.equal(before.toString("utf8"), after.toString("utf8"));
  const ref = "docs/design-reference.bmp", source = { design_source: "existing", design_refs: [ref] };
  await put(fx.root, ref, before);
  git(fx.root, ["add", "--", ref]); git(fx.root, ["commit", "-qm", "fixture: agreed binary mock"]);
  const sha = await assertDesignHandoff(fx.root, source);
  await put(fx.root, ref, after);
  await assert.rejects(assertDesignHandoff(fx.root, source), /Design handoff incomplete/);
  await put(fx.root, ref, before);
  const created = await createIntegrationWorktree({ project: fx.root, runId: "br-2026-11-15-binary", baseRef: sha }, { env: fx.env(), homedir: dir });
  assert.deepEqual(await fs.readFile(path.join(created.worktree, ref)), before);
  assert.equal(await assertDesignHandoff(created.worktree, source, {}, sha), sha);
  await put(fx.root, ref, Buffer.alloc(0));
  git(fx.root, ["add", "--", ref]); git(fx.root, ["commit", "-qm", "fixture: empty reference"]);
  await assert.rejects(assertDesignHandoff(fx.root, source), /Design handoff incomplete/);
}));

await test("N1: persisted queued build/patch restores lost UI source, preserves backend and journals its prerequisite", async () => {
  for (const kind of ["build", "patch"]) await withFixture(async (fx, dir) => {
    await stamp(fx, woPath, { ui: true, design_source: "pending" });
    const first = plan({ ...await readPlanWorkOrders(fx.root), scope });
    let units = first.units.filter(u => first.now.includes(u.id)).map(u => u.role === "designer" ? { ...u, state: "integrated" } : { ...u, kind });
    const build = units.find(u => u.kind === kind), designer = units.find(u => u.role === "designer");
    assert.ok(build);
    for (const ref of designer.design_refs) await put(fx.root, ref, "Integrated scoped design\n");
    assert.ok(plan({ ...await readPlanWorkOrders(fx.root, { units }), scope, units }).round.includes(build.id));
    await fs.unlink(path.join(fx.root, designer.design_refs[0]));
    // An independent backend unit is already queued as well.
    const backendId = "wo-02-001", backendFrd = "frd-02-beta";
    await stamp(fx, `docs/frds/${backendFrd}/work-orders/${backendId}.md`, { ui: false, artifacts: ["src/server.ts"] });
    const backend = newUnit({ id: "u-backend", kind: "build", wos: [backendId], frd: backendFrd });
    units.push(backend);
    const selected = { ...scope, wos: [id, backendId] };
    const read = await readPlanWorkOrders(fx.root, { units });
    const recovered = plan({ ...read, scope: selected, units, capacity: 5 });
    const repair = recovered.units.find(u => u.role === "designer");
    assert.ok(repair && repair.id !== designer.id);
    assert.deepEqual(repair.wos, [id]);
    assert.ok(recovered.round.includes(repair.id));
    assert.ok(!recovered.ready.includes(build.id));
    assert.ok(recovered.round.includes(backend.id));
    assert.equal(recovered.deadlock, null);
    const update = recovered.updates.find(u => u.id === build.id);
    assert.ok(update.depends_on.includes(repair.id));
    // A queued/running repair is reused on subsequent calls, never duplicated.
    const pending = [...units.map(u => u.id === update.id ? update : u), { ...repair, state: "running" }];
    const reused = plan({ ...read, scope: selected, units: pending, capacity: 5 });
    assert.ok(!reused.units.some(u => u.role === "designer"));
    assert.ok(!reused.round.includes(build.id));
    assert.ok(reused.round.includes(backend.id));
    // Verify the real fenced planner persists the dependency, and journal replay keeps it.
    const deps = { fs, env: fx.env(), homedir: dir, risk: { staticZones: async wos => wos } };
    const paths = buildPaths(fx.root, deps), runId = "br-2026-11-15-01";
    const lease = await acquire(fx.root, { runtime: "claude", runId, ttlSeconds: 1800, projectStatus: false });
    const state = newState({ run_id: runId, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "touch", scope: selected, units, integration: { branch: "main", worktree: fx.root, base_sha: fx.sha } });
    await writeState(fx.root, state, deps);
    await appendEvent(paths.journalFile, { run_id: runId, epoch: lease.epoch, actor: "cli", type: "run_started", data: { state } }, deps);
    const run = { ref: { project: fx.root, epoch: lease.epoch, deps }, d: deps, paths, overrides: { sessionModel: null, k: null } };
    const planned = await planRound(run, state, { claude_new_units: true, codex_new_units: true });
    const saved = await readState(fx.root, deps);
    const savedRepair = saved.units.find(u => u.id === repair.id);
    assert.ok(savedRepair);
    assert.ok(saved.units.find(u => u.id === build.id).depends_on.includes(repair.id));
    assert.ok(!planned.ready.includes(build.id));
    const replayed = foldJournal((await readJournal(paths.journalFile, deps)).events);
    assert.deepEqual(replayed.units.find(u => u.id === build.id).depends_on, saved.units.find(u => u.id === build.id).depends_on);
    for (const ref of repair.design_refs) await put(fx.root, ref, "Restored scoped design\n");
    const restoredUnits = saved.units.map(u => u.id === repair.id ? { ...u, state: "integrated" } : u);
    const restored = plan({ ...await readPlanWorkOrders(fx.root, { units: restoredUnits }), scope: selected, units: restoredUnits, capacity: 5 });
    assert.ok(restored.round.includes(build.id));
    assert.ok(!restored.units.some(u => u.role === "designer"));
  });
});

await test("N2: design recovery inherits the maximum unit/WO risk and complexity, preserving the effective routing floor", () => {
  const ctx = { label: "codex", size: "touch", quota: { claude_new_units: false, codex_new_units: true, now: Date.parse("2026-11-15T05:00:00Z") } };
  for (const kind of ["build", "patch"]) for (const source of ["wo", "unit"]) {
    const wos = [{ id, frd, status: "PLANNED", ui: true, design_source: "pending", artifacts: ["src/auth/panel.tsx"],
      zone: source === "wo" ? "r1" : "floor", risk_rules: ["AUTH"], complexity: source === "wo" ? "complex" : "trivial" }];
    const first = plan({ wos, scope });
    const original = first.units.find(u => u.role === "designer");
    const units = first.units.filter(u => first.now.includes(u.id)).map(u => u.id === original.id
      ? { ...u, state: "integrated" }
      : { ...u, kind, zone: source === "unit" ? "r1" : "floor", risk_rules: ["SESSION"], complexity: source === "unit" ? "complex" : "trivial" });
    const recovered = plan({ wos, scope, units });
    const repair = recovered.units.find(u => u.role === "designer");
    assert.ok(repair);
    assert.equal(repair.zone, "r1");
    assert.deepEqual(new Set(repair.risk_rules), new Set(["AUTH", "SESSION"]));
    const task = capacityTaskForUnit(repair);
    assert.equal(task.risk, "critical"); assert.equal(task.complexity, "complex"); assert.equal(task.type, "design");
    const cell = builderCell(repair, ctx);
    assert.deepEqual([cell.runtime, cell.model, cell.effort], ["codex", "astra", "high"]);
    // The floor wins even when complexity is explicitly trivial.
    const trivial = builderCell({ ...repair, complexity: "trivial" }, ctx);
    assert.deepEqual([trivial.model, trivial.effort], ["astra", "high"]);
    // A legacy queued/running repair below the floor must never be reused for critical work.
    for (const state of ["queued", "running"]) {
      const weak = { ...repair, id: "u-design-legacy-low", zone: "none", risk_rules: [], complexity: "trivial", state };
      const legacy = plan({ wos, scope, units: [...units, weak] });
      const upgraded = [...legacy.units, ...legacy.updates].find(u => u.role === "designer");
      assert.ok(upgraded);
      assert.equal(upgraded.id === weak.id, state === "queued");
      if (state === "running") assert.ok(!legacy.updates.some(u => u.id === weak.id), "active designer pins must stay untouched");
      assert.equal(capacityTaskForUnit(upgraded).risk, "critical");
      assert.equal(upgraded.complexity, "complex");
      assert.ok(legacy.updates.find(u => u.kind === kind).depends_on.includes(upgraded.id));
    }
  }
});

await test("N2 persistence: queued legacy designer is raised before routing and journal replay preserves its attempt", async () => {
  for (const kind of ["build", "patch"]) await withFixture(async (fx, dir) => {
    await stamp(fx, woPath, { ui: true, design_source: "pending", complexity: "complex" });
    const repair = newUnit({ id: "u-design-legacy", kind: "docs", role: "designer", frd, wos: [id],
      zone: "none", complexity: "trivial", risk_rules: ["LEGACY"], attempt: 2 });
    const builder = newUnit({ id: `u-${kind}-${id}`, kind, frd, wos: [id], zone: "r1", complexity: "trivial", risk_rules: ["SESSION"] });
    const units = [repair, builder];
    const deps = { fs, env: fx.env(), homedir: dir, risk: { staticZones: async wos => wos.map(w => ({ ...w, zone: "floor", risk_rules: ["AUTH"] })) } };
    const paths = buildPaths(fx.root, deps), runId = "br-2026-11-15-01";
    const lease = await acquire(fx.root, { runtime: "claude", runId, ttlSeconds: 1800, projectStatus: false });
    const state = newState({ run_id: runId, epoch: lease.epoch, coordinator: "claude-session", label: "claude", size: "touch", scope, units, integration: { branch: "main", worktree: fx.root, base_sha: fx.sha } });
    await writeState(fx.root, state, deps);
    await appendEvent(paths.journalFile, { run_id: runId, epoch: lease.epoch, actor: "cli", type: "run_started", data: { state } }, deps);
    const run = { ref: { project: fx.root, epoch: lease.epoch, deps }, d: deps, paths, overrides: { sessionModel: null, k: null } };
    await planRound(run, state, { claude_new_units: true, codex_new_units: true });
    const saved = await readState(fx.root, deps);
    const raised = saved.units.find(u => u.id === repair.id);
    assert.equal(raised.zone, "r1");
    assert.equal(raised.complexity, "complex");
    assert.deepEqual(new Set(raised.risk_rules), new Set(["LEGACY", "SESSION"]));
    assert.equal(raised.attempt, 2);
    assert.equal(saved.units.filter(u => u.role === "designer").length, 1);
    assert.ok(saved.units.find(u => u.id === builder.id).depends_on.includes(repair.id));
    const replayed = foldJournal((await readJournal(paths.journalFile, deps)).events);
    assert.deepEqual(replayed.units.find(u => u.id === repair.id), raised);
  });
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
