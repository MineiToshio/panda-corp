#!/usr/bin/env node
// Independent BL-0329 review: a process loss must never expose a protected dispute as builder-ready.
// Explicit pre-rescue persisted fixture: exercise recovery compatibility without invoking current technical recovery.
async function seedLegacyHandback(ctx, input, deps) {
  const { planHandback, commitPlan } = await import("../runtime/build/failure/policy.mjs");
  const { findWorkOrderFiles, commitIntegration, changedTrackedFiles } = await import("../runtime/build/failure/handback.mjs");
  const { handbackDecisionEntry, handbackMarkdown } = await import("../runtime/build/failure/handbackText.mjs");
  const { writeInbox } = await import("../runtime/build/doubts/integrationLog.mjs");
  const buildState = await import("../runtime/build-state.mjs");
  const io = await import("node:fs/promises");
  const state = await ctx.readState();
  const unit = state.units.find(u => u.id === input.unitId);
  const handbackPath = ctx.paths.handbackFile(unit.id);
  const plan = planHandback({ state, unitId: unit.id, cause: input.cause, reasonCode: input.reasonCode, reason: input.reason, path: handbackPath });
  const root = path.resolve(ctx.project, state.integration.worktree);
  const targets = plan.blocked.map(t => state.units.find(u => u.id === t.unit));
  const files = await findWorkOrderFiles(root, targets.flatMap(u => u.wos), deps);
  for (const target of targets) for (const wo of target.wos) {
    const file = files.get(wo.toLowerCase());
    if (file) await buildState.transitionWorkOrderAt(root, { file, to: "BLOCKED", reason: target.id === unit.id ? `needs-owner: ${input.cause}: ${input.reason}` : `blocked-by: ${unit.id}` });
  }
  const info = { unit: unit.id, wos: unit.wos, cause: input.cause, reasonCode: input.reasonCode, reason: input.reason,
    attempt: unit.attempt, date: "2026-11-17", path: handbackPath, failure: input.failure ?? null, diagnosis: input.diagnosis ?? null,
    attempts: [], preserved: [], blockedUnits: plan.blocked.map(t => t.unit), skippedWos: [] };
  await writeInbox(ctx.project, root, handbackDecisionEntry(info), deps);
  await io.mkdir(path.dirname(handbackPath), { recursive: true });
  await io.writeFile(handbackPath, handbackMarkdown(info));
  const commit = await commitIntegration(root, await changedTrackedFiles(root, deps), `test: seed legacy handback ${unit.id}`, deps);
  await commitPlan(ctx, plan);
  return { blocked: plan.blocked, commit, path: handbackPath };
}

import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { planUnblock } from "../runtime/build/failure/unblock.mjs";
import { newState, newUnit, writeState, readState, fencedTwoPhase } from "../runtime/build/state.mjs";
import { scopeAmendmentProblem, scopeRepairCommand, openScopeDisputes } from "../runtime/build/scope.mjs";
import { createFixture, git, DEFAULT_NOW } from "./fixtures/build-v2/make-fixture.mjs";
import { acquire } from "../runtime/build-state.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { appendEvent, readJournal } from "../runtime/build/journal.mjs";
import { updateFrontmatter, frontmatterList, splitFrontmatter, parseYamlSubset } from "../runtime/build/card.mjs";
import { readPlanWorkOrders } from "../runtime/build/planner.mjs";
import { next } from "../runtime/build/next.mjs";

const ID = "u-build-wo-12-004";
const WO = "wo-12-005";
const ORDINARY = "src/lib/seo/_tests/discoveryBuild.test.ts";
const PROTECTED = "src/app/(catalog)/piece/[id]/_tests/publicPrerender.test.tsx";
const root = newUnit({ id: ID, kind: "build", state: "blocked", wos: ["wo-12-004", WO, "wo-12-007"] });
const docs = newUnit({
  id: "u-scope-test",
  kind: "docs",
  role: "architect",
  wos: [WO],
  state: "integrated",
  scope_repair: {
    target: ID,
    attempt: 1,
    wo_file: "docs/frds/frd-12/work-orders/wo-12-005.md",
    files: [ORDINARY],
    protected_files: [PROTECTED],
  },
});
const state = newState({ run_id: "br-2026-11-16-01", epoch: 1, units: [root, docs] });
const events = [{ seq: 12, type: "handback", data: { unit: ID, attempt: 1, cause: "scope", blocked: [ID] } }];

for (const mixed of [false, true])
  test(`protected ${mixed ? "mixed" : "only"} repair never journals a builder-ready root`, () => {
    const resolution = {
      handback_seq: 12,
      dispute: true,
      ...(mixed ? { docs: docs.id, revision: "a".repeat(40), depends_on: [] } : {}),
    };
    const planned = planUnblock({
      state,
      events,
      unitId: ID,
      reason: "d-0001 = empty-only-sentinel",
      scopeResolution: resolution,
    });
    assert.equal(planned.state.units[0].state, "reported");
    assert.equal(planned.state.units[0].attempt, 1);
    // Recovery replays the durable state payload. No intermediate event may permit the builder to run.
    assert.equal(
      planned.events.some((e) => e.type === "unit_state" && e.data.unit === ID && e.data.to === "queued"),
      false,
    );
    const replay = planned.events.filter((e) => e.type === "unit_queued" && e.data.id === ID).at(-1);
    assert.equal(replay.data.state, "reported");
    if (mixed) assert.equal(replay.data.scope_revision, "a".repeat(40));
  });

test("selected sibling WO keeps its own identity, exact artifact set and protected oracle", () => {
  const before = `---\nid: ${WO}\nstatus: ACTIVE\nimplementation_status: BLOCKED\nartifacts: [src/old.ts]\n---\nOriginal acceptance contract.\n`;
  const after = before.replace("[src/old.ts]", `[src/old.ts, ${ORDINARY}]`);
  const args = {
    unit: docs,
    rel: docs.scope_repair.wo_file,
    before,
    after,
    targets: [root, docs],
    hashed: new Set([PROTECTED]),
  };
  assert.equal(scopeAmendmentProblem(args), null);
  assert.ok(
    scopeAmendmentProblem({ ...args, before: before.replace(WO, "wo-12-004"), after: after.replace(WO, "wo-12-004") }),
  );
  assert.ok(scopeAmendmentProblem({ ...args, after: after.replace(ORDINARY, `${ORDINARY}, ${PROTECTED}`) }));
  assert.ok(scopeAmendmentProblem({ ...args, hashed: new Set([ORDINARY, PROTECTED]) }));
});

test("real CLI accepts explicit sibling --wo and a literal Next bracket path", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pc-scope-adversarial-"));
  try {
    const fx = await createFixture("basic", { dir });
    const deps = { env: fx.env(), clock: () => new Date(DEFAULT_NOW), bootstrap: false };
    const paths = buildPaths(fx.root, deps);
    await fs.mkdir(path.dirname(path.join(fx.root, PROTECTED)), { recursive: true });
    await fs.writeFile(path.join(fx.root, PROTECTED), "// literal route fixture\n");
    git(fx.root, ["--literal-pathspecs", "add", "--", PROTECTED]);
    git(fx.root, ["commit", "-qm", "fixture: literal Next route"]);
    const lease = await acquire(fx.root, {
      runtime: "codex",
      runId: state.run_id,
      ttlSeconds: 1800,
      projectStatus: false,
      coordinator: "session",
    });
    const integration = {
      branch: paths.integrationBranch(state.run_id),
      worktree: paths.integrationWorktree,
      base_sha: fx.sha,
    };
    git(fx.root, ["worktree", "add", "-b", integration.branch, integration.worktree, "main"]);
    const unit = newUnit({
      id: ID,
      kind: "build",
      state: "blocked",
      wos: ["WO-01-001", "WO-01-002", "WO-02-001"],
      frd: "frd-01-alpha",
    });
    const run = newState({
      run_id: state.run_id,
      epoch: lease.epoch,
      coordinator: "codex-session",
      label: "codex",
      size: "feature",
      scope: { card: null, frds: [unit.frd], wos: [], out_of_scope: [] },
      integration,
      units: [unit],
    });
    await writeState(fx.root, run, deps);
    await appendEvent(
      paths.journalFile,
      { run_id: run.run_id, epoch: lease.epoch, type: "run_started", data: { state: run } },
      deps,
    );
    await appendEvent(
      paths.journalFile,
      {
        run_id: run.run_id,
        epoch: lease.epoch,
        type: "handback",
        data: { unit: ID, attempt: 1, cause: "scope", blocked: [ID] },
      },
      deps,
    );
    await fs.mkdir(paths.unitDir(ID), { recursive: true });
    await fs.writeFile(
      paths.reportFile(ID),
      JSON.stringify({ unit: ID, status: "blocked", diagnosis: { cause: "scope", detail: "outside allowlist" } }),
    );
    const cli = fileURLToPath(new URL("./pandacorp-build.mjs", import.meta.url));
    const out = spawnSync(
      process.execPath,
      [
        cli,
        "scope-repair",
        "--project",
        fx.root,
        "--epoch",
        String(lease.epoch),
        "--unit",
        ID,
        "--wo",
        "wo-01-002",
        "--files",
        JSON.stringify([PROTECTED]),
        "--owner-approved",
        "--reason",
        "approved literal Next route",
      ],
      { env: { ...process.env, ...deps.env }, encoding: "utf8" },
    );
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const queued = (await readState(fx.root, deps)).units.find((u) => u.scope_repair);
    assert.deepEqual(queued.wos, ["WO-01-002"]);
    assert.deepEqual(queued.scope_repair.files, [PROTECTED]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("next opens an integrated mixed repair before planning, and never reuses it for later reported work", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pc-scope-next-adversarial-"));
  try {
    const fx = await createFixture("basic", { dir });
    const deps = { env: fx.env(), clock: () => new Date(DEFAULT_NOW), bootstrap: false };
    const paths = buildPaths(fx.root, deps);
    for (const file of [ORDINARY, PROTECTED]) {
      await fs.mkdir(path.dirname(path.join(fx.root, file)), { recursive: true });
      await fs.writeFile(path.join(fx.root, file), "// existing test fixture\n");
    }
    git(fx.root, ["--literal-pathspecs", "add", "--", ORDINARY, PROTECTED]);
    git(fx.root, ["commit", "-qm", "fixture: mixed repair tests"]);
    const lease = await acquire(fx.root, {
      runtime: "codex",
      runId: state.run_id,
      ttlSeconds: 1800,
      projectStatus: false,
      coordinator: "session",
    });
    const integration = {
      branch: paths.integrationBranch(state.run_id),
      worktree: paths.integrationWorktree,
      base_sha: fx.sha,
    };
    git(fx.root, ["worktree", "add", "-b", integration.branch, integration.worktree, "main"]);
    const unit = newUnit({
      id: ID,
      kind: "build",
      state: "running",
      wos: ["WO-01-001", "WO-01-002", "WO-02-001"],
      frd: "frd-01-alpha",
    });
    const oracle = newUnit({
      id: "u-oracle",
      kind: "tests",
      state: "integrated",
      test_hashes: { [PROTECTED]: "a".repeat(64) },
    });
    const run = newState({
      run_id: state.run_id,
      epoch: lease.epoch,
      coordinator: "codex-session",
      label: "codex",
      size: "feature",
      scope: { card: null, frds: [unit.frd], wos: [], out_of_scope: [] },
      integration,
      units: [unit, oracle],
    });
    const record = async (event) =>
      appendEvent(paths.journalFile, { run_id: run.run_id, epoch: lease.epoch, ...event }, deps);
    await writeState(fx.root, run, deps);
    await record({ type: "run_started", data: { state: run } });
    await fs.mkdir(paths.unitDir(ID), { recursive: true });
    await fs.writeFile(
      paths.reportFile(ID),
      JSON.stringify({ unit: ID, status: "blocked", diagnosis: { cause: "scope", detail: "outside allowlist" } }),
    );
    await fencedTwoPhase({ project: fx.root, epoch: lease.epoch, deps }, undefined, undefined, (_r, _i, ctx) =>
      seedLegacyHandback(ctx, { unitId: ID, cause: "scope", reasonCode: "allowlist", reason: "outside allowlist" }, deps),
    );
    const repair = await scopeRepairCommand(
      {
        project: fx.root,
        epoch: lease.epoch,
        unit: ID,
        files: [ORDINARY, PROTECTED],
        ownerApproved: true,
        reason: "d-0001 = empty-only-sentinel",
      },
      deps,
    );
    let current = await readState(fx.root, deps);
    const amendment = current.units.find((u) => u.id === repair.docs);
    const woFile = path.join(integration.worktree, amendment.scope_repair.wo_file);
    const before = await fs.readFile(woFile, "utf8");
    const artifacts = frontmatterList(parseYamlSubset(splitFrontmatter(before).fm).data.artifacts);
    await fs.writeFile(woFile, updateFrontmatter(before, { set: { artifacts: [...artifacts, ORDINARY] } }));
    git(integration.worktree, ["add", "--", amendment.scope_repair.wo_file]);
    git(integration.worktree, ["commit", "-qm", "fixture: independently approved WO amendment"]);
    const sha = git(integration.worktree, ["rev-parse", "HEAD"]).trim();
    await writeState(
      fx.root,
      { ...current, units: current.units.map((u) => (u.id === repair.docs ? { ...u, state: "integrated" } : u)) },
      deps,
    );
    await record({ type: "integrated", data: { unit: repair.docs, sha } });
    let observedPlanning = false;
    const planner = {
      readPlanWorkOrders,
      plan: (input) => {
        observedPlanning = true;
        const target = input.units.find((u) => u.id === ID);
        assert.equal(target.state, "reported", "builder cannot become dispatchable before its protected dispute");
        assert.ok(target.doubt_id, "next must open the dispute before asking the planner");
        return { units: [], now: [], ready: [], round: [], deadlock: null };
      },
    };
    const risk = { staticZones: async (wos) => wos.map((w) => ({ ...w, zone: "none", risk_rules: [] })) };
    await next({ project: fx.root, epoch: lease.epoch }, { ...deps, planner, risk });
    assert.ok(observedPlanning);
    current = await readState(fx.root, deps);
    assert.equal(current.units.find((u) => u.id === ID).attempt, 1);
    const opened = (await readJournal(paths.journalFile, deps)).events.filter(
      (e) => e.type === "doubt_opened" && e.data.unit === ID,
    );
    assert.equal(opened.length, 1);
    assert.match(opened[0].data.question, /empty-only-sentinel/);
    // A later manual report at the same attempt owns this input. The old integrated repair must never overwrite it.
    const freshQuestion = { question: "A later execution asks an unrelated ambiguity" };
    await fs.writeFile(paths.unitDoubtFile(ID), JSON.stringify(freshQuestion));
    await openScopeDisputes({ project: fx.root, epoch: lease.epoch }, deps);
    assert.deepEqual(JSON.parse(await fs.readFile(paths.unitDoubtFile(ID), "utf8")), freshQuestion);
    assert.equal(
      (await readJournal(paths.journalFile, deps)).events.filter((e) => e.type === "doubt_opened" && e.data.unit === ID)
        .length,
      1,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
