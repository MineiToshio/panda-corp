#!/usr/bin/env node
// test-build-v2-integrate.mjs — engine v2 `plugin/runtime/build/integrate.mjs` (PLAN C12, D22, D1, A5, A13, A16).
// Run: node plugin/scripts/test-build-v2-integrate.mjs   (real git in throwaway fixture repos, offline, no sleeps)
//
// CONTRACT PINNED (from PLAN D1/D22/A5/A13/A16, CLI doc 4.1 and 3.14):
//  - integration happens ONLY on the run's integration branch in the integration worktree `.pandacorp/run/build/integration`;
//    the main checkout stays clean (no tracked write, no status.yaml write), `main` gets no commit;
//  - a committed chain (one commit, `Unit:` + one `WO:` trailer per WO) is rebased onto the integration tip and
//    fast-forwarded (linear history), then each WO goes to IN_REVIEW on the branch (transitionWorkOrderAt) and
//    `wo_end` (state in_review) lines are appended to `.pandacorp/track.jsonl` on the branch (never on main);
//  - WO transitions never write `running`, `build_*`, `supervisor_heartbeat` or `phase` into status.yaml (A5);
//  - a rebase conflict does not throw, leaves the integration branch (and worktree) unchanged and reports
//    `outcome:"conflict"`, `reason:"rebase_conflict"`; nothing is left mid-rebase;
//  - worktrees are created/removed with `git worktree`: `git worktree list` never shows a prunable entry;
//  - a tracked inbox file (MC's force-tracked decisions.md) is written on the integration branch, not in main.
//
// ASSUMED INTERFACE: none left to guess for names/shapes. The docs name no signatures, so the names below were taken from
// the module's export lines and JSDoc only (bodies never read). All take `deps` last; `deps.env` carries the test hooks.
//   createIntegrationWorktree({project, runId, baseRef?}, deps) -> {branch, worktree, base_sha, created}   (branch `lane/<run>/integration`)
//   removeIntegrationWorktree({project, worktree}, deps) -> {removed, worktree}   (branch kept)
//   integrateUnit({unit, integration:{branch, worktree}, runId}, deps) -> {outcome:"integrated"|"already"|"conflict", sha, code_sha,
//       transitions, track, wo_commit} | {outcome:"conflict", reason:"rebase_conflict", files, tip}
//   integrateCommitted({state, runId?, appendEvent?, keepWorktrees?}, deps) -> {state, integrated, conflicts, events, cleanup}
//   transitionWorkOrders({integration, runId, wos, to, unitId?}, deps) -> {commit, steps, track}
//   writeProjectFile({project, integration, runId, relPath, text, mode?, subject?}, deps) -> {tracked, file, commit}
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPaths } from "../runtime/build/paths.mjs";
import { createFixture, git as fxGit, testEnv } from "./fixtures/build-v2/make-fixture.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(HERE, "..", "runtime", "build", "integrate.mjs");
const RUN = "r-itest";

let passed = 0;
let failed = 0;
const fails = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`assertion failed: ${msg}`); };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { failed++; fails.push(name); console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split("\n").join("\n     ")}`); }
}

// module under test: absent or different => every test fails with a clear message
let mod = null;
let loadError = null;
try { mod = await import(pathToFileURL(MODULE).href); } catch (e) { loadError = e; }
function api(name) {
  if (loadError) throw new Error(`integrate.mjs cannot be loaded (${loadError.code === "ERR_MODULE_NOT_FOUND" ? "module missing" : loadError.message}): ${MODULE}`);
  if (typeof mod[name] !== "function") throw new Error(`integrate.mjs does not export function ${name} (exports: ${Object.keys(mod).join(", ") || "none"})`);
  return mod[name];
}

// ---------------------------------------------------------------------------------------------
// fixture helpers
const IDENT = { GIT_AUTHOR_NAME: "Engine", GIT_AUTHOR_EMAIL: "engine@example.invalid", GIT_COMMITTER_NAME: "Engine", GIT_COMMITTER_EMAIL: "engine@example.invalid" };
async function sandbox(preset = "basic") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tc12-"));
  const fx = await createFixture(preset, { dir });
  const deps = { env: testEnv(dir, IDENT) };
  const g = (cwd, ...args) => fxGit(cwd, args);
  const snap = () => ({
    head: g(fx.root, "rev-parse", "main"), count: g(fx.root, "rev-list", "--count", "main"), branch: g(fx.root, "rev-parse", "--abbrev-ref", "HEAD"),
    status: g(fx.root, "status", "--porcelain"), files: g(fx.root, "ls-files"), statusYaml: readFileSync(path.join(fx.root, ".pandacorp", "status.yaml"), "utf8"),
  });
  const sb = { dir, fx, deps, g, snap, before: snap(), integration: null, done: () => rm(dir, { recursive: true, force: true }) };
  return sb;
}
const branchOf = (unitId) => buildPaths("/nonexistent/project").unitBranch(RUN, unitId);

/** Creates the integration worktree through the module under test; returns {branch, worktree}. */
async function ensure(sb) {
  const r = await api("createIntegrationWorktree")({ project: sb.fx.root, runId: RUN, baseRef: "main" }, sb.deps);
  sb.integration = { branch: r.branch, worktree: r.worktree };
  return r;
}
const tipOf = (sb) => sb.g(sb.fx.root, "rev-parse", sb.integration.branch);

/** A unit worktree+branch cut from `base` (default main) with ONE commit carrying `Unit:` and one `WO:` trailer per WO. */
async function makeUnit(sb, { id, frd, wos, files, base = "main" }) {
  const wt = path.join(sb.fx.root, ".pandacorp", "run", "build", "wt", id);
  await mkdir(path.dirname(wt), { recursive: true });
  sb.g(sb.fx.root, "worktree", "add", "-q", "-b", branchOf(id), wt, base);
  for (const [rel, text] of Object.entries(files)) { await mkdir(path.dirname(path.join(wt, rel)), { recursive: true }); await writeFile(path.join(wt, rel), text); }
  sb.g(wt, "add", "-A");
  sb.g(wt, "commit", "-q", "-m", `feat(${frd}): ${id}\n\nUnit: ${id}\n${wos.map((w) => `WO: ${w}`).join("\n")}`);
  return { id, kind: "build", frd, wos, chain: `c-${wos[0].toLowerCase()}`, attempt: 1, state: "committed", branch: null, worktree: wt, depends_on: [] };
}
const woFile = (frd, wo) => `docs/frds/${frd}/work-orders/${wo.toLowerCase()}.md`;
const readAt = (sb, ref, rel) => { try { return sb.g(sb.fx.root, "show", `${ref}:${rel}`); } catch { return null; } };
const woStatusAt = (sb, ref, frd, wo) => (readAt(sb, ref, woFile(frd, wo)) ?? "").match(/^implementation_status:\s*(\S+)/m)?.[1] ?? null;
const trackAt = (sb, ref) => (readAt(sb, ref, ".pandacorp/track.jsonl") ?? "").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const worktrees = (sb) => sb.g(sb.fx.root, "worktree", "list", "--porcelain").split("\n\n").filter(Boolean).map((blk) => ({ path: blk.match(/^worktree (.+)$/m)[1], prunable: /^prunable/m.test(blk), branch: blk.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null }));
const assertRegistryConsistent = (sb, label) => {
  for (const w of worktrees(sb)) { ok(!w.prunable, `${label}: worktree ${w.path} is prunable`); ok(existsSync(w.path), `${label}: registered worktree ${w.path} missing on disk`); }
};
const assertMainUntouched = (sb, label) => {
  const now = sb.snap();
  eq(now.head, sb.before.head, `${label}: main head moved`);
  eq(now.count, sb.before.count, `${label}: main gained commits`);
  eq(now.branch, "main", `${label}: main checkout left its branch`);
  eq(now.status, "", `${label}: main checkout is not clean`);
  eq(now.files, sb.before.files, `${label}: main checkout tracked file list changed`);
  eq(now.statusYaml, sb.before.statusYaml, `${label}: main checkout status.yaml bytes changed`);
  ok(readAt(sb, "main", ".pandacorp/track.jsonl") === null, `${label}: track.jsonl reached main`);
  ok(!existsSync(path.join(sb.fx.root, ".pandacorp", "track.jsonl")), `${label}: track.jsonl written in the main checkout`);
};
const integrate = (sb, unit) => api("integrateUnit")({ unit, integration: sb.integration, runId: RUN }, sb.deps);
const wtClean = (sb, label) => eq(sb.g(sb.integration.worktree, "status", "--porcelain"), "", `${label}: integration worktree has uncommitted changes`);

const A = { id: "u-build-wo-01-001", frd: "frd-01-alpha", wos: ["WO-01-001", "WO-01-002"], files: { "src/alpha/list.ts": "export const value = 2;\n", "src/alpha/filter.ts": "export const value = 3;\n" } };
const B = { id: "u-build-wo-02-001", frd: "frd-02-beta", wos: ["WO-02-001"], files: { "src/beta/view.ts": "export const value = 4;\n" } };

// ---------------------------------------------------------------------------------------------
await test("module exports the functions the engine calls", async () => {
  for (const n of ["createIntegrationWorktree", "removeIntegrationWorktree", "integrateUnit", "integrateCommitted", "transitionWorkOrders", "writeProjectFile", "committedUnits", "frdsReadyForG2"]) api(n);
});

await test("createIntegrationWorktree: git worktree on its own branch from main, registered, main untouched, idempotent, never lane/<run> itself", async () => {
  const sb = await sandbox();
  try {
    const r = await ensure(sb);
    ok(r.created === true, "first call creates");
    ok(r.branch.startsWith(`lane/${RUN}`), `branch ${r.branch} is under lane/<run_id>`);
    ok(r.branch !== `lane/${RUN}`, "the integration branch must not be lane/<run_id>: git cannot hold it next to lane/<run_id>/<unit>");
    ok(existsSync(r.worktree) && r.worktree.endsWith(path.join(".pandacorp", "run", "build", "integration")), "worktree at .pandacorp/run/build/integration");
    ok(worktrees(sb).some((w) => w.path.endsWith("/build/integration") && w.branch === r.branch), "registered with git on the integration branch");
    eq(tipOf(sb), sb.before.head, "branch starts at main");
    eq(r.base_sha, sb.before.head, "base_sha is the main head it was cut from");
    const again = await api("createIntegrationWorktree")({ project: sb.fx.root, runId: RUN, baseRef: "main" }, sb.deps);
    eq([again.branch, again.worktree, again.created], [r.branch, r.worktree, false], "second call re-attaches");
    eq(tipOf(sb), sb.before.head, "second call did not move the branch");
    // a unit branch can now coexist with the integration branch (the namespace trap)
    await makeUnit(sb, { ...A, files: { "src/alpha/list.ts": "export const value = 2;\n" } });
    assertRegistryConsistent(sb, "after create");
    assertMainUntouched(sb, "after create");
  } finally { await sb.done(); }
});

await test("integrateUnit: 2-WO chain rebased onto a moved tip, linear, WOs IN_REVIEW + wo_end track lines on the branch only", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    // both units are cut from the same base, so the second one MUST be rebased onto the first one's integration
    const ua = await makeUnit(sb, A);
    const ub = await makeUnit(sb, B);
    const baseSha = sb.before.head;
    const ra = await integrate(sb, ua);
    eq(ra.outcome, "integrated", "first chain outcome");
    ok(/^[0-9a-f]{40}$/.test(ra.sha) && /^[0-9a-f]{40}$/.test(ra.code_sha), "result carries sha and code_sha");
    const tipA = tipOf(sb);
    eq(ra.sha, tipA, "sha is the integration tip after the chain");
    sb.g(sb.fx.root, "merge-base", "--is-ancestor", ra.code_sha, tipA); // throws unless code_sha is on the branch
    eq(sb.g(sb.fx.root, "rev-list", "--merges", `${baseSha}..${tipA}`), "", "no merge commits (rebase + ff)");
    ok(readAt(sb, tipA, "src/alpha/list.ts")?.includes("value = 2"), "chain code present on the branch");
    const msgsA = sb.g(sb.fx.root, "log", "--format=%B", `${baseSha}..${tipA}`);
    ok(msgsA.includes(`Unit: ${A.id}`), "Unit trailer preserved");
    for (const wo of A.wos) {
      ok(msgsA.includes(`WO: ${wo}`), `WO trailer ${wo} preserved`);
      eq(woStatusAt(sb, tipA, A.frd, wo), "IN_REVIEW", `${wo} IN_REVIEW on the branch`);
      eq(woStatusAt(sb, "main", A.frd, wo), "PLANNED", `${wo} still PLANNED on main`);
    }
    const rb = await integrate(sb, ub);
    eq(rb.outcome, "integrated", "second chain outcome");
    const tipB = tipOf(sb);
    sb.g(sb.fx.root, "merge-base", "--is-ancestor", tipA, tipB); // second chain sits on top of the first
    eq(sb.g(sb.fx.root, "rev-list", "--merges", `${baseSha}..${tipB}`), "", "still linear");
    ok(readAt(sb, tipB, "src/alpha/list.ts")?.includes("value = 2") && readAt(sb, tipB, "src/beta/view.ts")?.includes("value = 4"), "both chains' code present");
    eq(woStatusAt(sb, tipB, B.frd, "WO-02-001"), "IN_REVIEW", "second chain WO IN_REVIEW");
    const lines = trackAt(sb, tipB);
    for (const [frd, wo] of [[A.frd, "WO-01-001"], [A.frd, "WO-01-002"], [B.frd, "WO-02-001"]]) {
      const mine = lines.filter((x) => x.kind === "wo_end" && x.wo === wo);
      eq(mine.length, 1, `exactly one wo_end line for ${wo}`);
      eq([mine[0].frd, mine[0].state], [frd, "in_review"], `track line shape for ${wo}`);
      ok(typeof mine[0].at === "string" && !Number.isNaN(Date.parse(mine[0].at)), `track line ${wo} has an ISO at`);
    }
    for (const l of lines) ok(["wo_start", "wo_end", "review_start", "review_end", "frd_end"].includes(l.kind), `unknown track kind ${l.kind}`);
    wtClean(sb, "after integrate");
    assertRegistryConsistent(sb, "after integrate");
    assertMainUntouched(sb, "after integrate");
  } finally { await sb.done(); }
});

await test("integrateUnit: status.yaml on the branch only gets work_orders_* counters/updated_at; never running/build_*/phase (A5)", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    eq((await integrate(sb, await makeUnit(sb, A))).outcome, "integrated", "outcome");
    const before = readAt(sb, "main", ".pandacorp/status.yaml");
    const after = readAt(sb, sb.integration.branch, ".pandacorp/status.yaml");
    const keys = (text) => new Map(text.split("\n").filter((l) => /^[a-z_]+:/.test(l)).map((l) => [l.split(":")[0], l.slice(l.indexOf(":") + 1).trim()]));
    const kb = keys(before); const ka = keys(after);
    for (const [k, v] of ka) {
      if (kb.get(k) === v) continue;
      ok(/^work_orders_/.test(k) || k === "updated_at", `status.yaml key ${k} changed (${kb.get(k)} -> ${v}); only work_orders_* and updated_at may`);
    }
    for (const k of ka.keys()) ok(!/^build_/.test(k) && k !== "supervisor_heartbeat", `status.yaml gained forbidden key ${k}`);
    eq(ka.get("running"), "false", "running stays false (never written true)");
    eq(ka.get("phase"), kb.get("phase"), "phase untouched");
    eq(ka.get("work_orders_in_review"), "2", "rollup counts the 2 IN_REVIEW WOs");
    assertMainUntouched(sb, "status");
  } finally { await sb.done(); }
});

await test("integrateUnit: WO already IN_PROGRESS on the branch is accepted (no illegal-transition crash)", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const file = path.join(sb.integration.worktree, woFile(B.frd, "WO-02-001"));
    await writeFile(file, readFileSync(file, "utf8").replace("implementation_status: PLANNED", "implementation_status: IN_PROGRESS"));
    sb.g(sb.integration.worktree, "add", "-A"); sb.g(sb.integration.worktree, "commit", "-q", "-m", "docs: wo in progress");
    const ub = await makeUnit(sb, { ...B, base: sb.integration.branch });
    eq((await integrate(sb, ub)).outcome, "integrated", "outcome");
    eq(woStatusAt(sb, sb.integration.branch, B.frd, "WO-02-001"), "IN_REVIEW", "IN_REVIEW");
    assertMainUntouched(sb, "in-progress");
  } finally { await sb.done(); }
});

await test("integrateUnit: rebase conflict -> outcome conflict/rebase_conflict, integration branch + worktree unchanged, nothing mid-rebase, no WO/track side effects", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const ua = await makeUnit(sb, { id: "u-build-wo-01-001", frd: A.frd, wos: ["WO-01-001"], files: { "src/alpha/list.ts": "export const value = 2;\n" } });
    const ub = await makeUnit(sb, { id: "u-build-wo-01-002", frd: A.frd, wos: ["WO-01-002"], files: { "src/alpha/list.ts": "export const value = 3;\n" } });
    eq((await integrate(sb, ua)).outcome, "integrated", "first chain");
    const tip = tipOf(sb);
    const unitTip = sb.g(sb.fx.root, "rev-parse", branchOf(ub.id));
    const trackBefore = readAt(sb, tip, ".pandacorp/track.jsonl");
    let res; let threw = null;
    try { res = await integrate(sb, ub); } catch (e) { threw = e; }
    ok(!threw, `a rebase conflict must be an outcome, not a throw (${threw?.message})`);
    eq(res.outcome, "conflict", "outcome");
    eq(res.reason, "rebase_conflict", "reason");
    ok(Array.isArray(res.files) && res.files.includes("src/alpha/list.ts"), `conflicting file reported (${JSON.stringify(res.files)})`);
    eq(tipOf(sb), tip, "integration branch tip unchanged");
    wtClean(sb, "after conflict");
    eq(sb.g(sb.integration.worktree, "rev-parse", "HEAD"), tip, "integration worktree still at the tip");
    for (const wt of [sb.integration.worktree, ub.worktree]) {
      for (const d of ["rebase-merge", "rebase-apply"]) ok(!existsSync(path.resolve(wt, sb.g(wt, "rev-parse", "--git-path", d))), `${d} left behind in ${wt}`);
      ok(!existsSync(path.resolve(wt, sb.g(wt, "rev-parse", "--git-path", "MERGE_HEAD"))), `merge state left behind in ${wt}`);
    }
    eq(sb.g(sb.fx.root, "rev-parse", branchOf(ub.id)), unitTip, "unit branch left as the worker committed it");
    eq(woStatusAt(sb, tip, A.frd, "WO-01-002"), "PLANNED", "conflicting WO not transitioned");
    eq(readAt(sb, tip, ".pandacorp/track.jsonl"), trackBefore, "no track line for the conflicting chain");
    ok(!trackAt(sb, tip).some((l) => l.wo === "WO-01-002"), "no WO-01-002 track line");
    assertRegistryConsistent(sb, "after conflict");
    assertMainUntouched(sb, "after conflict");
  } finally { await sb.done(); }
});

await test("integrateUnit: idempotent for an already integrated unit (resume after a crash)", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const ua = await makeUnit(sb, A);
    eq((await integrate(sb, ua)).outcome, "integrated", "first call");
    const tip = tipOf(sb); const n = sb.g(sb.fx.root, "rev-list", "--count", sb.integration.branch);
    const again = await integrate(sb, ua);
    eq(again.outcome, "already", "second call outcome");
    eq(tipOf(sb), tip, "no new commit");
    eq(sb.g(sb.fx.root, "rev-list", "--count", sb.integration.branch), n, "commit count unchanged");
    eq(trackAt(sb, tip).filter((l) => l.kind === "wo_end" && l.wo === "WO-01-001").length, 1, "no duplicated track line");
  } finally { await sb.done(); }
});

await test("integrateUnit: missing unit branch fails loud (INVALID_STATE) and never moves the tip", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const tip = tipOf(sb);
    let res = null; let code = null;
    try { res = await integrate(sb, { id: "u-build-wo-01-001", kind: "build", frd: A.frd, wos: ["WO-01-001"], chain: "c-wo-01-001", attempt: 1, branch: null, state: "committed" }); } catch (e) { code = e.code; }
    ok(code === "INVALID_STATE" || (res && res.outcome !== "integrated"), `must not report integrated (code=${code}, outcome=${res?.outcome})`);
    eq(tipOf(sb), tip, "tip unchanged");
    eq(woStatusAt(sb, sb.integration.branch, A.frd, "WO-01-001"), "PLANNED", "WO untouched");
    assertMainUntouched(sb, "missing branch");
  } finally { await sb.done(); }
});

await test("integrateCommitted: integrates committed units in order, journals integrated/unit_state/safe_point, removes unit worktrees (branches kept), a conflict stays committed", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const ua = await makeUnit(sb, { id: "u-build-wo-01-001", frd: A.frd, wos: ["WO-01-001"], files: { "src/alpha/list.ts": "export const value = 2;\n" } });
    const ub = await makeUnit(sb, { id: "u-build-wo-02-001", frd: B.frd, wos: ["WO-02-001"], files: { "src/beta/view.ts": "export const value = 4;\n" } });
    const uc = await makeUnit(sb, { id: "u-build-wo-01-002", frd: A.frd, wos: ["WO-01-002"], files: { "src/alpha/list.ts": "export const value = 9;\n" } });
    const { newState, newUnit } = await import(pathToFileURL(path.join(HERE, "..", "runtime", "build", "state.mjs")).href);
    const state = newState({ run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "normal", scope: {}, integration: { ...sb.integration, base_sha: sb.before.head }, units: [ua, ub, uc].map((u) => newUnit({ ...u })) });
    const appended = [];
    const r = await api("integrateCommitted")({ state, runId: RUN, appendEvent: async (e) => { appended.push(e); } }, { ...sb.deps, project: sb.fx.root });
    const byId = (id) => r.state.units.find((u) => u.id === id);
    eq(byId(ua.id).state, "integrated", "first unit integrated");
    eq(byId(ub.id).state, "integrated", "second unit integrated");
    eq(byId(uc.id).state, "committed", "conflicting unit stays committed");
    eq(r.conflicts.length, 1, "one conflict reported");
    eq(state.units.find((u) => u.id === ua.id).state, "committed", "input state not mutated");
    const types = r.events.map((e) => e.type);
    for (const t of ["integrated", "unit_state", "safe_point"]) ok(types.includes(t), `event ${t} returned`);
    eq(appended.map((e) => e.type), types, "appendEvent received the same events in order");
    const ev = r.events.find((e) => e.type === "integrated");
    ok(/^[0-9a-f]{40}$/.test(ev.data.sha), "integrated event carries the sha");
    eq(r.state.last_safe_point?.kind, "integration-land", "last_safe_point is integration-land");
    ok(!existsSync(ua.worktree) && !existsSync(ub.worktree), "integrated units' worktrees removed");
    sb.g(sb.fx.root, "rev-parse", "--verify", branchOf(ua.id)); // branch kept
    assertRegistryConsistent(sb, "after integrateCommitted");
    assertMainUntouched(sb, "after integrateCommitted");
  } finally { await sb.done(); }
});

await test("transitionWorkOrders: IN_REVIEW -> IN_PROGRESS walks via PLANNED, reopen_count+1, one commit on the branch only, no status.yaml run keys", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const ua = await makeUnit(sb, { id: "u-build-wo-01-001", frd: A.frd, wos: ["WO-01-001"], files: { "src/alpha/list.ts": "export const value = 2;\n" } });
    eq((await integrate(sb, ua)).outcome, "integrated", "integrate");
    eq(woStatusAt(sb, sb.integration.branch, A.frd, "WO-01-001"), "IN_REVIEW", "precondition IN_REVIEW");
    const before = tipOf(sb);
    const r = await api("transitionWorkOrders")({ integration: sb.integration, runId: RUN, wos: ["WO-01-001"], to: "IN_PROGRESS", unitId: "u-patch-wo-01-001" }, sb.deps);
    eq(woStatusAt(sb, sb.integration.branch, A.frd, "WO-01-001"), "IN_PROGRESS", "reopened WO is IN_PROGRESS");
    eq(readAt(sb, sb.integration.branch, woFile(A.frd, "WO-01-001")).match(/^reopen_count:\s*(\d+)/m)?.[1], "1", "reopen_count bumped once");
    eq(r.steps.map((s) => s.to), ["PLANNED", "IN_PROGRESS"], "route via PLANNED");
    eq(sb.g(sb.fx.root, "rev-list", "--count", `${before}..${sb.integration.branch}`), "1", "exactly one commit");
    ok(trackAt(sb, sb.integration.branch).some((l) => l.kind === "wo_start" && l.wo === "WO-01-001"), "wo_start track line for the reopened WO");
    eq(woStatusAt(sb, "main", A.frd, "WO-01-001"), "PLANNED", "main WO untouched");
    const st = readAt(sb, sb.integration.branch, ".pandacorp/status.yaml");
    ok(!/^build_|^supervisor_heartbeat/m.test(st) && /^running:\s*false/m.test(st), "no running/build_* in status.yaml");
    wtClean(sb, "after reopen");
    // re-running is a no-op (a WO already at `to` is skipped)
    const again = await api("transitionWorkOrders")({ integration: sb.integration, runId: RUN, wos: ["WO-01-001"], to: "IN_PROGRESS", unitId: "u-patch-wo-01-001" }, sb.deps);
    eq(again.commit, null, "second run writes no commit");
    assertMainUntouched(sb, "reopen");
  } finally { await sb.done(); }
});

await test("transitionWorkOrders: an unknown work order fails loud and leaves the worktree clean", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const tip = tipOf(sb);
    let code = null;
    try { await api("transitionWorkOrders")({ integration: sb.integration, runId: RUN, wos: ["WO-09-999"], to: "IN_REVIEW" }, sb.deps); } catch (e) { code = e.code; }
    eq(code, "INVALID_STATE", "error code");
    eq(tipOf(sb), tip, "no commit");
    wtClean(sb, "after unknown wo");
    assertMainUntouched(sb, "unknown wo");
  } finally { await sb.done(); }
});

await test("writeProjectFile: force-tracked decisions.md is written + committed on the integration branch; main file and tree untouched", async () => {
  const sb = await sandbox("tracked-decisions");
  try {
    await ensure(sb);
    const relPath = ".pandacorp/inbox/decisions.md";
    const text = "\n- [pending] d-1: which colour?\n";
    const before = readFileSync(path.join(sb.fx.root, relPath), "utf8");
    const r = await api("writeProjectFile")({ project: sb.fx.root, integration: sb.integration, runId: RUN, relPath, text, mode: "append", subject: "chore(build): pending decision" }, sb.deps);
    eq(r.tracked, true, "reported as tracked");
    ok(/^[0-9a-f]{40}$/.test(r.commit), "returns the commit sha");
    eq(tipOf(sb), r.commit, "returned commit is the branch tip");
    ok(readAt(sb, sb.integration.branch, relPath).includes("d-1: which colour?") && readAt(sb, sb.integration.branch, relPath).startsWith(before.trimEnd()), "branch has the appended entry after the old content");
    eq(readFileSync(path.join(sb.fx.root, relPath), "utf8"), before, "main checkout file not modified");
    eq(readAt(sb, "main", relPath), before.trimEnd(), "main blob unchanged");
    wtClean(sb, "after tracked write");
    assertMainUntouched(sb, "tracked decisions");
  } finally { await sb.done(); }
});

await test("writeProjectFile: an untracked gitignored path is written in the main checkout without any commit (tracked:false)", async () => {
  const sb = await sandbox("basic");
  try {
    await ensure(sb);
    const relPath = ".pandacorp/inbox/decisions.md";
    const tip = tipOf(sb);
    const r = await api("writeProjectFile")({ project: sb.fx.root, integration: sb.integration, runId: RUN, relPath, text: "- [pending] d-2\n", mode: "append", subject: "chore(build): pending decision" }, sb.deps);
    eq([r.tracked, r.commit], [false, null], "untracked: no commit");
    ok(readFileSync(path.join(sb.fx.root, relPath), "utf8").includes("d-2"), "written in the main checkout (gitignored)");
    eq(tipOf(sb), tip, "integration branch not touched");
    eq(sb.g(sb.fx.root, "status", "--porcelain"), "", "main checkout still clean (ignored path)");
    eq(sb.g(sb.fx.root, "rev-parse", "main"), sb.before.head, "main head unchanged");
  } finally { await sb.done(); }
});

await test("writeProjectFile: refuses a path that escapes the root (INVALID_PATH), nothing written", async () => {
  const sb = await sandbox("tracked-decisions");
  try {
    await ensure(sb);
    let code = null;
    try { await api("writeProjectFile")({ project: sb.fx.root, integration: sb.integration, runId: RUN, relPath: "../escape.md", text: "x\n", subject: "m" }, sb.deps); } catch (e) { code = e.code; }
    eq(code, "INVALID_PATH", "error code");
    ok(!existsSync(path.join(sb.fx.root, ".pandacorp", "run", "build", "escape.md")) && !existsSync(path.join(sb.fx.root, ".pandacorp", "escape.md")) && !existsSync(path.join(sb.dir, "escape.md")), "nothing written outside the root");
    assertMainUntouched(sb, "escape");
  } finally { await sb.done(); }
});

await test("removeIntegrationWorktree: git worktree remove, branch kept, no prunable entry, `git worktree prune` has nothing to do, main untouched", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const ua = await makeUnit(sb, { id: "u-build-wo-01-001", frd: A.frd, wos: ["WO-01-001"], files: { "src/alpha/list.ts": "export const value = 2;\n" } });
    eq((await integrate(sb, ua)).outcome, "integrated", "integrate");
    const tip = tipOf(sb);
    const r = await api("removeIntegrationWorktree")({ project: sb.fx.root, runId: RUN, worktree: sb.integration.worktree }, sb.deps);
    eq(r.removed, true, "removed");
    ok(!existsSync(sb.integration.worktree), "integration worktree dir removed");
    ok(!worktrees(sb).some((w) => w.path.endsWith("/build/integration")), "no longer registered");
    eq(tipOf(sb), tip, "branch kept at its tip (the batch is not lost)");
    assertRegistryConsistent(sb, "after remove");
    eq(sb.g(sb.fx.root, "worktree", "prune", "--dry-run", "-v"), "", "git worktree prune has nothing left to prune");
    const again = await api("removeIntegrationWorktree")({ project: sb.fx.root, runId: RUN, worktree: sb.integration.worktree }, sb.deps);
    eq(again.removed, false, "removing an unregistered worktree is a no-op");
    assertMainUntouched(sb, "after remove");
  } finally { await sb.done(); }
});

// ---------------------------------------------------------------------------------------------
// built on assumption (BUILD-12, DG-5, RULINGS-C2 INT-M1; behaviour addendum C12). Names come from paths.mjs helpers only.
const DOUBT = "d-0042";
const OPTION = "opt-no";
const pathsOf = (sb) => buildPaths(sb.fx.root, { env: sb.deps.env });
const writeDoubt = async (sb, { decision = null, unit = "u-build-wo-01-001" } = {}) => {
  const P = pathsOf(sb);
  await mkdir(P.doubtsDir, { recursive: true });
  await writeFile(P.doubtFile(DOUBT), `${JSON.stringify({ schema: 1, id: DOUBT, unit, opened_at: "2026-11-11T12:00:00.000Z", question: "Paginate?", options: [{ id: "opt-yes", text: "yes" }, { id: OPTION, text: "no" }], preferred: OPTION, why: "silent", step: decision ? "decided" : "parked", consults: [], decision, assumption: { option: OPTION, branch: P.assumeBranch(RUN, DOUBT) } }, null, 2)}\n`);
};
const decided = (value) => ({ value, decided_by: "owner", at: "2026-11-11T12:05:00.000Z" });
const mkAssumeBranch = (sb) => { const b = pathsOf(sb).assumeBranch(RUN, DOUBT); sb.g(sb.fx.root, "branch", b, sb.integration.branch); return b; };
/** A committed unit built on the assumption branch (cut from it), flagged parked built_on_assumption. */
const assumedUnit = async (sb, assumeBranch, over = {}) => {
  const u = await makeUnit(sb, { id: "u-build-wo-01-001", frd: A.frd, wos: ["WO-01-001"], files: { "src/alpha/list.ts": "export const value = 2;\n" }, base: assumeBranch });
  return { ...u, parked: "built_on_assumption", pending_answer: DOUBT, doubt_id: DOUBT, ...over };
};
const stateOf = async (sb, units) => {
  const { newState, newUnit } = await import(pathToFileURL(path.join(HERE, "..", "runtime", "build", "state.mjs")).href);
  return newState({ run_id: RUN, epoch: 1, coordinator: "claude-session", label: "claude", size: "normal", scope: {}, integration: { ...sb.integration, base_sha: sb.before.head }, units: units.map((u) => newUnit({ ...u })) });
};
const runCommitted = (sb, state) => api("integrateCommitted")({ state, runId: RUN }, { ...sb.deps, project: sb.fx.root });
const isAncestor = (sb, a, b) => { try { sb.g(sb.fx.root, "merge-base", "--is-ancestor", a, b); return true; } catch { return false; } };

await test("assumption: a committed unit flagged built_on_assumption integrates CODE ONLY into lane/<run>/assume-<doubt>: integration tip, WO state and last_safe_point untouched, no safe_point", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb); await writeDoubt(sb);
    const ab = mkAssumeBranch(sb);
    const u = await assumedUnit(sb, ab);
    const tipBefore = tipOf(sb);
    const r = await runCommitted(sb, await stateOf(sb, [u]));
    eq(r.state.units.find((x) => x.id === u.id).state, "integrated", "unit integrated");
    eq(tipOf(sb), tipBefore, "the integration branch did not move");
    ok(sb.g(sb.fx.root, "log", "--format=%B", `${tipBefore}..${ab}`).includes(`Unit: ${u.id}`), "the unit commit landed on the assume branch");
    ok(woStatusAt(sb, ab, A.frd, "WO-01-001") !== "IN_REVIEW", "no WO transition on the assume branch (code only)");
    ok(woStatusAt(sb, sb.integration.branch, A.frd, "WO-01-001") !== "IN_REVIEW", "no WO transition on the integration branch");
    const ev = r.events.filter((e) => e.type === "integrated");
    ok(ev.length === 1 && ev[0].data.unit === u.id && ev[0].data.assumption === DOUBT, `one integrated event carrying assumption ${DOUBT}: ${JSON.stringify(ev)}`);
    ok(!r.events.some((e) => e.type === "safe_point"), "no safe_point for assumption work");
    ok(!r.state.last_safe_point, "last_safe_point stays unset");
    assertRegistryConsistent(sb, "assume integration"); assertMainUntouched(sb, "assume integration");
  } finally { await sb.done(); }
});

await test("assumption: a flagged committed unit without pending_answer fails loud (INVALID_STATE), nothing moves", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb); await writeDoubt(sb);
    const ab = mkAssumeBranch(sb);
    const u = await assumedUnit(sb, ab, { pending_answer: null, doubt_id: null });
    const tipBefore = tipOf(sb);
    let err = null; try { await runCommitted(sb, await stateOf(sb, [u])); } catch (e) { err = e; }
    ok(err && err.code === "INVALID_STATE", `expected INVALID_STATE, got ${err?.code ?? "no error"}`);
    eq(tipOf(sb), tipBefore, "integration tip unchanged");
  } finally { await sb.done(); }
});

await test("assumption: an unanswered or REJECTED doubt never merges its assume branch (and the branch is kept)", async () => {
  for (const decision of [null, decided("opt-yes")]) {
    const sb = await sandbox();
    try {
      await ensure(sb); await writeDoubt(sb, { decision });
      const ab = mkAssumeBranch(sb);
      const u = await assumedUnit(sb, ab);
      const r1 = await runCommitted(sb, await stateOf(sb, [u]));
      const tip = tipOf(sb);
      const r2 = await runCommitted(sb, { ...r1.state, units: r1.state.units.map((x) => ({ ...x, parked: null, pending_answer: null })) });
      eq(tipOf(sb), tip, `decision ${JSON.stringify(decision?.value ?? null)}: the integration tip does not move`);
      ok(!(r2.merged ?? []).length, "no merged[] entry");
      ok(!isAncestor(sb, ab, sb.integration.branch), "assume branch not an ancestor of the integration branch");
      sb.g(sb.fx.root, "rev-parse", "--verify", ab);
    } finally { await sb.done(); }
  }
});

await test("assumption ACCEPTED: the next pass merges the assume branch --no-ff into the integration branch (Doubt: trailer), WOs go to IN_REVIEW, integrated{unit:null,doubt}+safe_point, idempotent", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb); await writeDoubt(sb);
    const ab = mkAssumeBranch(sb);
    const u = await assumedUnit(sb, ab);
    const r1 = await runCommitted(sb, await stateOf(sb, [u]));
    await writeDoubt(sb, { decision: decided(OPTION) });
    const answered = { ...r1.state, units: r1.state.units.map((x) => ({ ...x, parked: null, pending_answer: null })) };
    const r2 = await runCommitted(sb, answered);
    const tip = tipOf(sb);
    const mergeSha = sb.g(sb.fx.root, "log", "--merges", "-1", "--format=%H", tip);
    ok(/^[0-9a-f]{40}$/.test(mergeSha), "the integration branch has a --no-ff merge commit");
    eq(sb.g(sb.fx.root, "rev-list", "--parents", "-n", "1", mergeSha).split(" ").length, 3, "the merge commit has two parents");
    ok(/^Doubt: d-0042$/m.test(sb.g(sb.fx.root, "log", "-1", "--format=%B", mergeSha)), "merge commit carries a Doubt: trailer");
    ok(isAncestor(sb, ab, sb.integration.branch), "assume branch is now an ancestor of the integration branch");
    eq(woStatusAt(sb, sb.integration.branch, A.frd, "WO-01-001"), "IN_REVIEW", "the WO of the assumed unit is IN_REVIEW on the integration branch");
    const merged = r2.events.find((e) => e.type === "integrated" && e.data.unit === null);
    ok(merged && merged.data.doubt === DOUBT && /^[0-9a-f]{40}$/.test(merged.data.sha), `integrated{unit:null,doubt,sha}: ${JSON.stringify(r2.events)}`);
    ok(r2.events.some((e) => e.type === "safe_point" && e.data.kind === "integration-land"), "safe_point integration-land recorded");
    eq(r2.state.last_safe_point?.kind, "integration-land", "last_safe_point updated");
    const r3 = await runCommitted(sb, r2.state);
    eq(tipOf(sb), tip, "second pass: nothing re-merged");
    ok(!r3.events.some((e) => e.type === "integrated"), "second pass records no integrated event");
    assertRegistryConsistent(sb, "after accept merge"); assertMainUntouched(sb, "after accept merge"); wtClean(sb, "after accept merge");
  } finally { await sb.done(); }
});

await test("assumption ACCEPTED: after the merge the flag is cleared, so a later committed unit integrates into the integration branch normally (WO IN_REVIEW, safe_point)", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb); await writeDoubt(sb);
    const ab = mkAssumeBranch(sb);
    const u = await assumedUnit(sb, ab);
    const r1 = await runCommitted(sb, await stateOf(sb, [u]));
    await writeDoubt(sb, { decision: decided(OPTION) });
    const later = await makeUnit(sb, { id: "u-build-wo-02-001", frd: B.frd, wos: ["WO-02-001"], files: { "src/beta/view.ts": "export const value = 4;\n" } });
    const st = { ...r1.state, units: [...r1.state.units.map((x) => ({ ...x, parked: null, pending_answer: null })), (await stateOf(sb, [later])).units[0]] };
    const r2 = await runCommitted(sb, st);
    eq(r2.state.units.find((x) => x.id === later.id).state, "integrated", "later unit integrated");
    eq(woStatusAt(sb, sb.integration.branch, B.frd, "WO-02-001"), "IN_REVIEW", "normal integration transitions its WO");
    ok(isAncestor(sb, ab, sb.integration.branch), "assume branch merged along the way");
  } finally { await sb.done(); }
});

await test("assumption ACCEPTED but the merge conflicts: reported as a conflict on the doubting unit with doubt set, integration branch unchanged, nothing left mid-merge", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb); await writeDoubt(sb);
    const ab = mkAssumeBranch(sb);
    const u = await assumedUnit(sb, ab);
    const r1 = await runCommitted(sb, await stateOf(sb, [u]));
    // the integration branch moves with a conflicting change to the same file
    await writeFile(path.join(sb.integration.worktree, "src/alpha/list.ts"), "export const value = 77;\n");
    sb.g(sb.integration.worktree, "add", "-A"); sb.g(sb.integration.worktree, "commit", "-q", "-m", "feat: conflicting");
    await writeDoubt(sb, { decision: decided(OPTION) });
    const tip = tipOf(sb);
    const r2 = await runCommitted(sb, { ...r1.state, units: r1.state.units.map((x) => ({ ...x, parked: null, pending_answer: null })) });
    eq(tipOf(sb), tip, "integration tip unchanged");
    const c = (r2.conflicts ?? []).find((x) => x.doubt === DOUBT);
    ok(c && c.outcome === "conflict" && c.unit === "u-build-wo-01-001", `conflict entry with doubt and unit: ${JSON.stringify(r2.conflicts)}`);
    wtClean(sb, "after conflicted merge");
    let mid = true; try { sb.g(sb.integration.worktree, "rev-parse", "-q", "--verify", "MERGE_HEAD"); } catch { mid = false; }
    ok(!mid, "no MERGE_HEAD left behind");
  } finally { await sb.done(); }
});

await test("assumption: frdsReadyForG2 skips an FRD while any of its units is built_on_assumption (G2 runs after acceptance)", async () => {
  const sb = await sandbox();
  try {
    await ensure(sb);
    const mk = (id, wo, over = {}) => ({ id, kind: "build", frd: A.frd, wos: [wo], chain: `c-${wo.toLowerCase()}`, attempt: 1, state: "integrated", ...over });
    const flagged = await stateOf(sb, [mk("u-build-wo-01-001", "WO-01-001", { parked: "built_on_assumption", pending_answer: DOUBT }), mk("u-build-wo-01-002", "WO-01-002")]);
    const plain = await stateOf(sb, [mk("u-build-wo-01-001", "WO-01-001"), mk("u-build-wo-01-002", "WO-01-002")]);
    const ready = (s) => api("frdsReadyForG2")(s).map((x) => (typeof x === "string" ? x : x.frd ?? x.id));
    ok(!ready(flagged).includes(A.frd), `FRD with an assumption unit must not be G2-ready: ${JSON.stringify(ready(flagged))}`);
    ok(ready(plain).includes(A.frd), `control: the same FRD without the flag is G2-ready: ${JSON.stringify(ready(plain))}`);
  } finally { await sb.done(); }
});

console.log(`RESULT ${passed} passed, ${failed} failed${failed ? ` (${fails.join("; ")})` : ""}`);
process.exit(failed ? 1 : 0);
