#!/usr/bin/env node
// BL-0327: real blocked report from funko-tracker br-2026-11-16-01 (identity token sanitized).
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFixture, git, DEFAULT_NOW } from "./fixtures/build-v2/make-fixture.mjs";
import * as bs from "../runtime/build-state.mjs";
import { newUnit, newState, writeState, readState, fencedTwoPhase, rebuildState } from "../runtime/build/state.mjs";
import { appendEvent, readJournal } from "../runtime/build/journal.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { issueToken } from "../runtime/build/admission.mjs";
import { prepareUnitWorktree, writeUnitBrief } from "../runtime/build/units.mjs";
import { ingestReport } from "../runtime/build/report.mjs";
import {
  scopeRepairCommand,
  settleScopeRepairs,
  scopeAmendmentProblem,
  scopeDiagnosis,
  scopeDependencyUnits,
} from "../runtime/build/scope.mjs";
import * as scopeModule from "../runtime/build/scope.mjs";
const openScopeDisputes = (...args) => scopeModule.openScopeDisputes(...args);
import { updateFrontmatter } from "../runtime/build/card.mjs";
import { integrateCommitted } from "../runtime/build/integrate.mjs";
import { plan, readPlanWorkOrders } from "../runtime/build/planner.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { handBack } from "../runtime/build/failure.mjs";
const real = JSON.parse(await fs.readFile(new URL("./fixtures/build-v2/bl-0327/report.json", import.meta.url), "utf8"));
const RUN = "br-2026-11-16-01",
  ID = real.unit,
  WO = "WO-01-001";
const FILE = "docs/frds/frd-01-alpha/work-orders/wo-01-001.md";
const FILES = ["src/lib/contact/visitor.ts", "src/lib/_tests/launchIntegration.test.ts"];
const DISCOVERY = "src/lib/seo/_tests/discoveryBuild.test.ts";
const PRERENDER = "src/app/(catalog)/piece/[id]/_tests/publicPrerender.test.tsx";
const chainReport = JSON.parse(
  await fs.readFile(new URL("./fixtures/build-v2/bl-0329/report.json", import.meta.url), "utf8"),
);
let passed = 0,
  failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}: ${e.stack}`);
    failed++;
  }
};
async function withRun(fn, { legacy = false, hashed = false, chain = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pc-scope-"));
  try {
    const fx = await createFixture("basic", { dir });
    const deps = { env: fx.env(), clock: () => new Date(DEFAULT_NOW), bootstrap: false };
    const project = fx.root,
      p = buildPaths(project, deps);
    for (const file of [...FILES, DISCOVERY, PRERENDER]) {
      await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
      await fs.writeFile(path.join(project, file), "// existing scope fixture file\n");
    }
    git(project, ["--literal-pathspecs", "add", "--", ...FILES, DISCOVERY, PRERENDER]);
    git(project, ["commit", "-q", "-m", "fixture: scope repair paths"]);
    const lease = await bs.acquire(project, {
      runtime: "codex",
      runId: RUN,
      ttlSeconds: 1800,
      projectStatus: false,
      coordinator: "session",
    });
    const integration = { branch: p.integrationBranch(RUN), worktree: p.integrationWorktree, base_sha: fx.sha };
    git(project, ["worktree", "add", "-b", integration.branch, integration.worktree, "main"]);
    const wt = await prepareUnitWorktree({ project, runId: RUN, unit: ID }, deps);
    await fs.writeFile(path.join(wt.root, "src/alpha/list.ts"), 'export const value = "preserved";\n');
    const token = issueToken(ID, "B", { file: p.admissionFile });
    const root = newUnit({
      id: ID,
      kind: "build",
      wos: chain ? [WO, "WO-01-002", "WO-02-001"] : [WO],
      frd: "frd-01-alpha",
      state: "running",
      worktree: wt.worktree,
      branch: wt.branch,
      token_hash: token.token_hash,
    });
    const dependent = newUnit({
      id: "u-build-dependent",
      kind: "build",
      wos: ["WO-01-002"],
      frd: root.frd,
      depends_on: [ID],
    });
    const oracle = newUnit({
      id: "u-tests",
      kind: "tests",
      state: "integrated",
      test_hashes: hashed ? { [chain ? PRERENDER : FILES[1]]: "a".repeat(64) } : {},
    });
    const state = newState({
      run_id: RUN,
      epoch: lease.epoch,
      coordinator: "codex-session",
      label: "codex",
      size: "feature",
      scope: { card: null, frds: [root.frd], wos: [], out_of_scope: [] },
      integration,
      units: [root, dependent, oracle],
    });
    await writeState(project, state, deps);
    await appendEvent(p.journalFile, { run_id: RUN, epoch: lease.epoch, type: "run_started", data: { state } }, deps);
    await fs.mkdir(p.unitDir(ID), { recursive: true });
    const report = { ...(chain ? chainReport : real), unit: ID, token: token.token };
    await fs.writeFile(p.reportFile(ID), JSON.stringify(report));
    const input = { project, epoch: lease.epoch, unit: ID, token: token.token, file: p.reportFile(ID) };
    if (legacy)
      await fencedTwoPhase({ project, epoch: lease.epoch, deps }, undefined, undefined, (_r, _i, ctx) =>
        handBack(
          ctx,
          {
            unitId: ID,
            cause: "dependency",
            reasonCode: "dependency_missing",
            reason: real.summary,
            diagnosis: real.diagnosis,
          },
          deps,
        ),
      );
    await fn({ project, p, deps, lease, wt, input, state, root, dir });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
await test("real dependency diagnosis describing allowlist is scope, not a missing secret", () =>
  withRun(async (c) => {
    const out = await ingestReport(c.input, c.deps);
    assert.equal(out.action, "handback");
    const hb = (await readJournal(c.p.journalFile, c.deps)).events.find((e) => e.type === "handback");
    assert.equal(hb.data.cause, "scope");
    assert.equal(hb.data.reason_code, "allowlist");
    assert.equal((await readState(c.project, c.deps)).units[0].attempt, 1);
  }));

const repair = (c, extra = {}) =>
  scopeRepairCommand(
    {
      project: c.project,
      epoch: c.lease.epoch,
      unit: ID,
      files: FILES,
      reason:
        "ampliar el allowlist de WO-12-003 con los archivos de Contacto y los tests que contradicen el contrato nuevo",
      ownerApproved: true,
      ...extra,
    },
    c.deps,
  );
const settle = (c) =>
  fencedTwoPhase({ project: c.project, epoch: c.lease.epoch, deps: c.deps }, undefined, undefined, (_r, _i, ctx) =>
    settleScopeRepairs(ctx, c.deps),
  );
async function prepareDocs(c, id, mutate = (t) => t) {
  const state = await readState(c.project, c.deps),
    docs = state.units.find((u) => u.id === id);
  const wt = await prepareUnitWorktree({ project: c.project, runId: RUN, unit: id }, c.deps);
  const woFile = docs.scope_repair.wo_file;
  const before = await fs.readFile(path.join(wt.root, woFile), "utf8");
  const { parseYamlSubset, splitFrontmatter, frontmatterList } = await import("../runtime/build/card.mjs");
  const artifacts = frontmatterList(parseYamlSubset(splitFrontmatter(before).fm).data.artifacts);
  const after = updateFrontmatter(before, { set: { artifacts: [...artifacts, ...docs.scope_repair.files] } });
  await fs.writeFile(path.join(wt.root, woFile), mutate(after));
  const token = issueToken(id, "B", { file: c.p.admissionFile });
  const u = { ...docs, state: "running", worktree: wt.worktree, branch: wt.branch, token_hash: token.token_hash };
  await writeState(c.project, { ...state, units: state.units.map((x) => (x.id === id ? u : x)) }, c.deps);
  await appendEvent(c.p.journalFile, { run_id: RUN, epoch: c.lease.epoch, type: "unit_queued", data: u }, c.deps);
  const report = {
    ...real,
    unit: id,
    token: token.token,
    status: "done",
    summary: "Bounded approved scope repair",
    files: [woFile],
    diagnosis: null,
    pending: [],
    verification: [],
  };
  await fs.mkdir(c.p.unitDir(id), { recursive: true });
  await fs.writeFile(c.p.reportFile(id), JSON.stringify(report));
  return {
    u,
    wt,
    before,
    after,
    token: token.token,
    submit: () =>
      ingestReport(
        { project: c.project, epoch: c.lease.epoch, unit: id, token: token.token, file: c.p.reportFile(id) },
        c.deps,
      ),
  };
}
await test("legacy hand-back -> owner decision -> isolated architect -> integrated scope -> same checkout, branch and attempt", () =>
  withRun(
    async (c) => {
      const before = git(c.wt.root, ["diff"]);
      const head = git(c.wt.root, ["rev-parse", "HEAD"]);
      const res = await repair(c);
      assert.equal(res.action, "docs");
      assert.equal((await repair(c)).applied, false, "idempotent decision");
      let state = await readState(c.project, c.deps);
      const docs = state.units.find((u) => u.id === res.docs);
      assert.equal(docs.role, "architect");
      assert.equal(state.units[0].state, "blocked");
      const read = await readPlanWorkOrders(state.integration.worktree, c.deps);
      const schedule = plan(
        { wos: read.wos, scope: state.scope, units: state.units, ceiling: 2 },
        { cellOf: () => ({ runtime: "codex", model: "sol", effort: "low" }) },
      );
      assert.ok(
        schedule.round.includes(docs.id),
        "blocked target does not prevent its docs prerequisite from dispatching",
      );
      const d = await prepareDocs(c, docs.id);
      const brief = await writeUnitBrief(
        {
          project: c.project,
          state,
          unit: docs,
          cell: { runtime: "codex", model: "sol", effort: "low" },
          agentType: "architect",
          token: "brief-token",
          worktree: d.wt.worktree,
        },
        c.deps,
      );
      assert.match(brief.text, /Keep implementation_status BLOCKED/);
      assert.doesNotMatch(brief.text, /Never amend a WO already claimed/);
      // The brief archives the stale report, exactly as a dispatch does. Recreate the new output for report.
      await fs.writeFile(
        c.p.reportFile(docs.id),
        JSON.stringify({
          ...real,
          unit: docs.id,
          token: d.token,
          status: "done",
          summary: "Approved repair",
          files: [FILE],
          diagnosis: null,
          pending: [],
          verification: [],
        }),
      );
      const committed = await d.submit();
      assert.equal(committed.outcome, "committed", JSON.stringify(committed));
      state = await readState(c.project, c.deps);
      const merged = await integrateCommitted({ state, keepWorktrees: true }, { ...c.deps, project: c.project });
      assert.equal(merged.conflicts.length, 0);
      assert.equal(merged.integrated[0].unit, docs.id);
      await fencedTwoPhase(
        { project: c.project, epoch: c.lease.epoch, deps: c.deps },
        undefined,
        undefined,
        async (_r, _i, ctx) => {
          await ctx.writeState(merged.state);
          for (const e of merged.events) await ctx.appendEvent(e);
        },
      );
      await settle(c);
      await settle(c); // crash recovery/idempotent settlement
      state = await readState(c.project, c.deps);
      const root = state.units[0];
      assert.equal(root.state, "queued");
      assert.equal(root.attempt, 1);
      assert.equal(root.worktree, c.wt.worktree);
      assert.equal(root.branch, c.wt.branch);
      assert.ok(root.scope_revision);
      assert.ok(root.depends_on.includes(docs.id));
      assert.equal(git(c.wt.root, ["diff"]), before);
      assert.equal(git(c.wt.root, ["rev-parse", "HEAD"]), head);
      assert.match(
        await fs.readFile(c.p.reportFile(ID).replace("report.json", "report-a1-blocked.json"), "utf8"),
        /fuera del allowlist/,
      );
      assert.equal(state.units.find((u) => u.id === "u-build-dependent").state, "queued");
      const adopted = await prepareUnitWorktree({ project: c.project, runId: RUN, unit: ID }, c.deps);
      assert.equal(adopted.created, false);
      assert.equal(git(c.wt.root, ["diff"]), before);
      const b = await writeUnitBrief(
        {
          project: c.project,
          state,
          unit: root,
          cell: { runtime: "codex", model: "sol", effort: "low" },
          agentType: "implementer",
          token: "new",
          worktree: c.wt.worktree,
        },
        c.deps,
      );
      assert.match(b.text, /owner-approved scope gap/);
      for (const f of FILES) assert.ok(b.text.includes(f));
      const replay = (await rebuildState({ project: c.project, deps: c.deps })).state;
      assert.equal(replay.units[0].scope_revision, root.scope_revision);
      assert.equal(replay.units[0].attempt, 1);
      assert.equal(replay.units[0].worker, null);
      const events = (await readJournal(c.p.journalFile, c.deps)).events;
      assert.equal(events.filter((e) => e.type === "scope_repair_approved").length, 1);
      assert.equal(events.filter((e) => e.type === "unblocked").length, 1);
      // Complete preserved builder work with one newly allowed file: report must use the architect revision, not the old fork.
      const token = issueToken(ID, "B", { file: c.p.admissionFile });
      await fs.mkdir(path.dirname(path.join(c.wt.root, FILES[0])), { recursive: true });
      await fs.writeFile(path.join(c.wt.root, FILES[0]), "export const contact = true;\n");
      await writeState(
        c.project,
        {
          ...state,
          units: state.units.map((u) => (u.id === ID ? { ...u, state: "running", token_hash: token.token_hash } : u)),
        },
        c.deps,
      );
      await fs.writeFile(
        c.p.reportFile(ID),
        JSON.stringify({
          ...real,
          unit: ID,
          token: token.token,
          status: "done",
          summary: "Finished preserved work",
          files: ["src/alpha/list.ts", FILES[0]],
          diagnosis: null,
          pending: [],
          verification: [],
        }),
      );
      const done = await ingestReport({ ...c.input, token: token.token }, c.deps);
      assert.equal(done.outcome, "committed", JSON.stringify(done));
    },
    { legacy: true },
  ));
await test("scope command refuses stale epoch, absent approval, dependent, globs and unrelated hand-backs without a decision", () =>
  withRun(
    async (c) => {
      const input = {
        project: c.project,
        epoch: c.lease.epoch,
        unit: ID,
        files: FILES,
        reason: "approved bounded repair",
        ownerApproved: true,
      };
      for (const [patch, code] of [
        [{ epoch: c.lease.epoch + 1 }, "FENCE"],
        [{ ownerApproved: false }, "INVALID_INPUT"],
        [{ unit: "u-build-dependent" }, "INVALID_INPUT"],
        [{ files: ["src/**"] }, "USAGE"],
        [{ files: ["src/*.ts"] }, "USAGE"],
        [{ files: ["src/?.ts"] }, "USAGE"],
        [{ wo: "WO-99-999" }, "INVALID_INPUT"],
        [{ files: ["../escape"] }, "USAGE"],
        [{ files: ["docs/frds/a.md"] }, "USAGE"],
        [{ files: ["src"] }, "INVALID_INPUT"],
        [{ files: ["src/missing.ts"] }, "INVALID_INPUT"],
      ])
        await assert.rejects(scopeRepairCommand({ ...input, ...patch }, c.deps), { code });
      const state = await readState(c.project, c.deps);
      assert.equal(state.units.length, 3);
      assert.equal(
        (await readJournal(c.p.journalFile, c.deps)).events.filter((e) => e.type === "scope_repair_approved").length,
        0,
      );
      assert.equal(
        scopeDiagnosis({ ...real, diagnosis: { cause: "dependency", detail: "Missing database account" }, pending: [] })
          .cause,
        "dependency",
      );
    },
    { legacy: true },
  ));
await test("architect cannot widen approved files or alter status, identity, acceptance criteria, another WO or a running claim", () =>
  withRun(
    async (c) => {
      const res = await repair(c);
      const d = await prepareDocs(c, res.docs);
      const args = {
        unit: d.u,
        rel: FILE,
        before: d.before,
        after: d.after,
        targets: (await readState(c.project, c.deps)).units,
        hashed: new Set(),
      };
      assert.equal(scopeAmendmentProblem(args), null);
      for (const after of [
        updateFrontmatter(d.after, { set: { artifacts: ["src/**"] } }),
        updateFrontmatter(d.after, { set: { implementation_status: "PLANNED" } }),
        updateFrontmatter(d.after, { set: { id: "WO-99-001" } }),
        d.after.replace("return its value", "delete its data"),
      ])
        assert.ok(scopeAmendmentProblem({ ...args, after }));
      assert.ok(scopeAmendmentProblem({ ...args, rel: "docs/other.md" }));
      assert.ok(scopeAmendmentProblem({ ...args, targets: [{ ...c.root, state: "running" }] }));
      assert.ok(scopeAmendmentProblem({ ...args, hashed: new Set([FILES[1]]) }));
      await fs.writeFile(path.join(d.wt.root, FILE), updateFrontmatter(d.after, { set: { artifacts: ["src/**"] } }));
      const rejected = await d.submit();
      assert.equal(rejected.outcome, "rejected");
      assert.match(rejected.reasons.join(" "), /exactly the owner-approved/);
    },
    { legacy: true },
  ));
await test("dependency additions are validated: self/cycle, dangling and unfinished unclaimed WOs are refused", () =>
  withRun(
    async (c) => {
      const state = await readState(c.project, c.deps),
        root = state.integration.worktree;
      const before = await fs.readFile(path.join(root, FILE), "utf8");
      for (const id of ["WO-01-001", "WO-missing", "WO-02-001"])
        await assert.rejects(
          scopeDependencyUnits(
            root,
            { id: WO, text: updateFrontmatter(before, { set: { dependsOn: [id] } }) },
            state.units,
            c.deps,
          ),
          { code: "INVALID_INPUT" },
        );
      const added = { ...newUnit({ id: "u-prereq", kind: "build", wos: ["WO-02-001"], state: "integrated" }) };
      assert.deepEqual(
        await scopeDependencyUnits(
          root,
          { id: WO, text: updateFrontmatter(before, { set: { dependsOn: ["WO-02-001"] } }) },
          [...state.units, added],
          c.deps,
        ),
        ["u-prereq"],
      );
    },
    { legacy: true },
  ));
await test("protected test in approval follows existing dispute/doubt, without architect or allowlist widening", () =>
  withRun(
    async (c) => {
      const res = await repair(c, { files: [FILES[1]] });
      assert.equal(res.action, "dispute");
      assert.ok(res.doubt.opened, JSON.stringify(res));
      const state = await readState(c.project, c.deps);
      assert.ok(!state.units.some((u) => u.scope_repair));
      assert.ok(state.units[0].doubt_id);
      assert.equal(state.units[0].attempt, 1);
      assert.deepEqual(state.units.find((u) => u.id === "u-tests").test_hashes, { [FILES[1]]: "a".repeat(64) });
      assert.doesNotMatch(await fs.readFile(path.join(state.integration.worktree, FILE), "utf8"), /launchIntegration/);
    },
    { legacy: true, hashed: true },
  ));
await test("real report mentioning a protected test is disputed at ingest without spending an attempt", () =>
  withRun(
    async (c) => {
      const res = await ingestReport({ ...c.input, openDoubt: true }, c.deps);
      assert.equal(res.action, "dispute");
      assert.ok(res.doubt_opened.opened, JSON.stringify(res));
      assert.equal((await readState(c.project, c.deps)).units[0].attempt, 1);
    },
    { hashed: true },
  ));
await test("CLI exposes the repair and fences an obsolete epoch", () =>
  withRun(
    async (c) => {
      const cli = fileURLToPath(new URL("./pandacorp-build.mjs", import.meta.url));
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "scope-repair",
          "--project",
          c.project,
          "--epoch",
          String(c.lease.epoch + 1),
          "--unit",
          ID,
          "--files",
          JSON.stringify(FILES),
          "--owner-approved",
          "--reason",
          "owner approved",
        ],
        { env: { ...process.env, ...c.deps.env }, encoding: "utf8" },
      );
      assert.equal(result.status, 3, result.stdout + result.stderr);
    },
    { legacy: true },
  ));
await test("next automatically settles an integrated repair, and a newer hand-back cannot be lifted", () =>
  withRun(
    async (c) => {
      const { docs } = await repair(c);
      const d = await prepareDocs(c, docs);
      assert.equal((await d.submit()).outcome, "committed");
      const state = await readState(c.project, c.deps);
      const merged = await integrateCommitted({ state, keepWorktrees: true }, { ...c.deps, project: c.project });
      await fencedTwoPhase(
        { project: c.project, epoch: c.lease.epoch, deps: c.deps },
        undefined,
        undefined,
        async (_r, _i, ctx) => {
          await ctx.writeState(merged.state);
          for (const e of merged.events) await ctx.appendEvent(e);
        },
      );
      // Inject a later authoritative hand-back event: handBack itself is idempotent on an already blocked unit.
      await appendEvent(
        c.p.journalFile,
        {
          run_id: RUN,
          epoch: c.lease.epoch,
          type: "handback",
          data: {
            unit: "u-build-dependent",
            cause: "owner",
            reason_code: "manual",
            reason: "new independent blocker",
            attempt: 1,
            blocked: ["u-build-dependent"],
          },
        },
        c.deps,
      );
      const { next } = await import("../runtime/build/next.mjs");
      const planner = {
        readPlanWorkOrders,
        plan: () => ({ units: [], now: [], ready: [], round: [], deadlock: null }),
      };
      const risk = { staticZones: async (wos) => wos.map((w) => ({ ...w, zone: "none", risk_rules: [] })) };
      await next({ project: c.project, epoch: c.lease.epoch }, { ...c.deps, planner, risk });
      const after = await readState(c.project, c.deps);
      assert.equal(after.units[0].state, "queued");
      assert.equal(after.units[0].attempt, 1);
      assert.equal(after.units.find((u) => u.id === "u-build-dependent").state, "blocked");
      assert.ok(after.units[0].scope_revision);
    },
    { legacy: true },
  ));
async function integrateRepair(c, docs) {
  const d = await prepareDocs(c, docs);
  const outcome = await d.submit();
  assert.equal(outcome.outcome, "committed", JSON.stringify(outcome));
  const state = await readState(c.project, c.deps);
  const merged = await integrateCommitted({ state, keepWorktrees: true }, { ...c.deps, project: c.project });
  assert.equal(merged.conflicts.length, 0);
  await fencedTwoPhase(
    { project: c.project, epoch: c.lease.epoch, deps: c.deps },
    undefined,
    undefined,
    async (_r, _i, ctx) => {
      await ctx.writeState(merged.state);
      for (const e of merged.events) await ctx.appendEvent(e);
    },
  );
  await settle(c);
}
for (const wo of [undefined, "wo-01-002"])
  await test(`multi-WO repair owns only ${wo ?? "first WO"} through integration and replay`, () =>
    withRun(
      async (c) => {
        const res = await repair(c, { files: [DISCOVERY], wo });
        let state = await readState(c.project, c.deps);
        const docs = state.units.find((u) => u.id === res.docs);
        assert.deepEqual(docs.wos, [wo ? "WO-01-002" : WO]);
        assert.equal((await repair(c, { files: [DISCOVERY], wo })).applied, false);
        await assert.rejects(repair(c, { files: [DISCOVERY], wo: wo ? WO : "WO-01-002" }), { code: "INVALID_INPUT" });
        const untouched = await fs.readFile(path.join(state.integration.worktree, FILE), "utf8");
        await integrateRepair(c, res.docs);
        state = await readState(c.project, c.deps);
        assert.equal(state.units[0].state, "queued");
        assert.equal(state.units[0].attempt, 1);
        if (wo) {
          const after = await fs.readFile(path.join(state.integration.worktree, FILE), "utf8");
          // Engine re-admission changes BLOCKED to PLANNED on all WOs; artifacts remain owned by the chosen WO only.
          assert.equal(after.replace("PLANNED", "BLOCKED"), untouched.replace(/^blocked_reason:.*\n/m, ""));
        }
        const wos = await (await import("../runtime/build/units.mjs")).readUnitWorkOrders(
          state.integration.worktree,
          state.units[0].wos,
        );
        assert.deepEqual(
          wos.filter((w) => w.artifacts.includes(DISCOVERY)).map((w) => w.id),
          docs.wos,
        );
        const replay = await rebuildState({ project: c.project, deps: c.deps });
        assert.equal(replay.state.units[0].scope_revision, state.units[0].scope_revision);
      },
      { legacy: true, chain: true },
    ));
await test("Next literal brackets reach the existing protected dispute for a multi-WO unit", () =>
  withRun(
    async (c) => {
      const res = await repair(c, {
        files: [PRERENDER],
        reason: "d-0001 = empty-only-sentinel: correct the empty catalog 404 oracle",
      });
      assert.equal(res.action, "dispute");
      assert.ok(res.doubt.opened, JSON.stringify(res));
      const state = await readState(c.project, c.deps);
      assert.ok(!state.units.some((u) => u.scope_repair));
      assert.equal(state.units[0].attempt, 1);
      const record = JSON.parse(await fs.readFile(c.p.doubtFile(res.doubt.doubt_id), "utf8"));
      assert.match(record.question, /d-0001 = empty-only-sentinel/);
      assert.deepEqual(
        record.options.map((o) => o.id),
        ["fix-test", "keep-test"],
      );
    },
    { legacy: true, chain: true, hashed: true },
  ));
await test("mixed repair integrates only ordinary artifacts then opens protected dispute, idempotently", () =>
  withRun(
    async (c) => {
      const res = await repair(c, { files: [DISCOVERY, PRERENDER], reason: "d-0001 = empty-only-sentinel" });
      assert.equal(res.action, "docs");
      let state = await readState(c.project, c.deps);
      const docs = state.units.find((u) => u.id === res.docs);
      assert.deepEqual(docs.scope_repair.files, [DISCOVERY]);
      assert.deepEqual(docs.scope_repair.protected_files, [PRERENDER]);
      await integrateRepair(c, docs.id);
      state = await readState(c.project, c.deps);
      assert.equal(state.units[0].state, "reported");
      const revision = state.units[0].scope_revision;
      await openScopeDisputes({ project: c.project, epoch: c.lease.epoch }, c.deps);
      state = await readState(c.project, c.deps);
      const doubt = state.units[0].doubt_id;
      assert.ok(doubt);
      await openScopeDisputes({ project: c.project, epoch: c.lease.epoch }, c.deps);
      assert.equal((await readState(c.project, c.deps)).units[0].doubt_id, doubt);
      assert.equal(state.units[0].scope_revision, revision);
      assert.equal(state.units[0].attempt, 1);
      assert.deepEqual(state.units.find((u) => u.id === "u-tests").test_hashes, { [PRERENDER]: "a".repeat(64) });
      const text = await fs.readFile(path.join(state.integration.worktree, FILE), "utf8");
      assert.ok(text.includes(DISCOVERY));
      assert.ok(!text.includes(PRERENDER));
    },
    { legacy: true, chain: true, hashed: true },
  ));
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
