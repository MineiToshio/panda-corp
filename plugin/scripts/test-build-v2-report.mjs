#!/usr/bin/env node
// test-build-v2-report.mjs: T-C03, the official test of plugin/runtime/build/{units,report}.mjs.
// Written from the contracts only (PLAN 3.16 A2/A13/A16, RESOLUTIONS D7 G1/D16/D21/D28, plugin/docs/build-engine-cli.md
// 3.9, 5, 6, 7, 11, report.schema.json). Run: node plugin/scripts/test-build-v2-report.mjs
//
// CONTRACT CONFLICT: PLAN A13/D1 name the integration branch `lane/<run_id>` and unit branches `lane/<run_id>/<unit>`; git refuses to hold both
// ("cannot lock ref ... 'refs/heads/lane/<run>' exists"). This test therefore uses `integration/<run>` as the integration branch and the
// A13 names for unit branches. The contract needs one of the two names changed (e.g. integration `lane/<run>/integration`).
//
// ASSUMED INTERFACE (the docs fix no export names or signatures for these two modules; the orchestrator reconciles):
//   report.mjs  ingestReport({project, epoch, unit, token, file}, deps?) -> Promise<{outcome, commit?, g1?{exit,tail}, test_hashes?, next_attempt?}>
//               (alias accepted: export `report`). `deps.env` carries the PANDACORP_* hooks; deps-last convention.
//               A rejection is either the returned outcome "rejected" (CLI exit 6) or a thrown error whose code is one of
//               REJECT_CODES below; FENCE / QUIESCED are thrown (exit 3). Any other thrown error (a TypeError, ...) FAILS the test.
//               Outcomes: committed | rejected | doubt | blocked | failed | waiting_gate. Hand-back after exhausted or identical
//               evidence = outcome failed|blocked with next_attempt null and the unit NOT queued (state parked|blocked).
//   units.mjs   createUnitWorktree({project, runId, unit: {id, attempt, ...}, base?}, deps?) -> {worktree, branch}
//               (aliases: addUnitWorktree, prepareUnitWorktree); branch/worktree per A13/A16 (attempt 1: no suffix, n>=2: -a<n>).
//               writeBrief({project, runId, unit, token, cell, via?}, deps?) -> {file}|string (aliases: generateBrief, renderBrief);
//               it writes paths.briefFile(unit.id). Reads the run's state.json for scope.
//   State the report uses: state.units[] item {id, kind, wos, frd ("frd-01-alpha" = the folder id), state, attempt, token_hash,
//               test_hashes, probe_hashes, evidence_hash, worktree, branch}; the unit token is the admission token
//               (admission.issueToken(unit, "B", {file: paths.admissionFile})); the report commit lands on the UNIT branch in the
//               UNIT worktree (never main, never the integration branch). The tests unit's own state.units[].test_hashes = sha256 of
//               each test file's bytes. A rejected / failed attempt re-queues the SAME unit at attempt+1 (A13).
//   G1 oracle: the fixture's .pandacorp/verify.sh is replaced by a stub that logs its argv + cwd (git common dir, pc-g1-argv.log) and
//               runs `node --test <file>` per `--tests=<list, comma or space separated>` file (assertion failures print
//               "AssertionError", import errors "ERR_MODULE_NOT_FOUND", syntax errors "SyntaxError"). The assertion-vs-import
//               classification is therefore assumed to read that text.
//   Events: legacy wo_commit is read from the ndjson event files (PANDACORP_EVENTS_FILE / PANDACORP_CODEX_EVENTS_FILE).
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(HERE, "..", "runtime");
const BUILD = path.join(RUNTIME, "build");
const FIXTURES = path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs");
const SCRATCH_ROOT = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const REJECT_CODES = ["INVALID_INPUT", "INVALID_STATE", "INVALID_PATH", "REJECTED", "SCOPE", "SCOPE_VIOLATION", "TOKEN", "TOKEN_MISMATCH", "UNIT_TOKEN"];

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ---- loading: a missing module or export becomes a clear failure ---------------------------------------------------
const loaded = {};
const load = async (file) => {
  if (!(file in loaded)) { try { loaded[file] = await import(pathToFileURL(path.join(BUILD, file)).href); } catch (e) { loaded[file] = { __error: e }; } }
  return loaded[file];
};
const needAny = async (file, names) => {
  const mod = await load(file);
  if (mod.__error) throw new Error(`module plugin/runtime/build/${file} cannot be imported: ${mod.__error.message.split("\n")[0]}`);
  for (const n of names) if (typeof mod[n] === "function") return mod[n];
  throw new Error(`plugin/runtime/build/${file} exports none of ${names.join("|")} (ASSUMED INTERFACE; exports present: ${Object.keys(mod).join(", ") || "none"})`);
};
const fixturesMod = () => import(pathToFileURL(FIXTURES).href);
const buildMod = (f) => import(pathToFileURL(path.join(BUILD, f)).href);
const bsMod = () => import(pathToFileURL(path.join(RUNTIME, "build-state.mjs")).href);

// ---- environment: every hook points into the sandbox -----------------------------------------------------------------
const OWNED_ENV = ["HOME", "CODEX_HOME", "PANDACORP_HOST_DIR", "PANDACORP_EVENTS_FILE", "PANDACORP_CODEX_EVENTS_FILE", "PANDACORP_ORCHESTRATE_DIR", "PANDACORP_NOTIFY", "PANDACORP_CODEX_BIN", "PANDACORP_FAKE_WORKER", "PANDACORP_FAKE_WORKER_PLAN", "PANDACORP_SIGNALS_FILE"];
const withEnv = async (env, fn) => {
  const saved = Object.fromEntries(OWNED_ENV.map((k) => [k, process.env[k]]));
  for (const k of OWNED_ENV) if (env[k] !== undefined) process.env[k] = env[k];
  try { return await fn(); } finally { for (const k of OWNED_ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};

// ---- the G1 oracle stub + fixture tweaks -----------------------------------------------------------------------------
const VERIFY_SH = `#!/usr/bin/env bash
common="$(git rev-parse --git-common-dir)"
printf '%s\\t%s\\n' "$(pwd -P)" "$*" >> "$common/pc-g1-argv.log"
tests=""
for a in "$@"; do case "$a" in --tests=*) tests="\${a#--tests=}";; esac; done
[ -z "$tests" ] && exit 0
rc=0
for t in $(printf '%s' "$tests" | tr ',' ' '); do node --test "$t" || rc=1; done
exit $rc
`;
const TEST_PATH = "src/alpha/_tests/list.test.mjs";
const PROBE_PATH = "src/alpha/_tests/probe.test.mjs";
const mkTest = (title, body) => `import test from "node:test";\nimport assert from "node:assert/strict";\ntest(${JSON.stringify(title)}, () => { ${body} });\n`;
const RED = mkTest("filter keeps matching items (AC-01-002.1)", "assert.equal(1, 2);");
const RED_OTHER = mkTest("filter ignores case (AC-01-002.2)", "assert.equal(3, 4);");
const GREEN = mkTest("filter is a function (AC-01-002.3)", "assert.equal(1, 1);");
const IMPORT_ERR = `import test from "node:test";\nimport { nope } from "./does-not-exist.mjs";\ntest("never runs", () => { nope(); });\n`;
const SYNTAX_ERR = `import test from "node:test";\ntest("never parses", () => { const = ; });\n`;
const woText = (id, status, extra = "") => `---\nid: ${id}\ntype: work-order\nslug: ${id.toLowerCase()}\ntitle: ${id} new work order\nstatus: ACTIVE\nparent: FRD-01\nimplementation_status: ${status}\nartifacts:\n  - 'src/alpha/new.ts'\nsource_requirements: [REQ-01-001]\ndependsOn: []\nlast_updated: '2026-11-11'\n---\n# ${id}\n${extra}\n`;

const git1 = (c, argline) => c.git(c.root, argline.split(" "));
const realpath = async (p) => (await import("node:fs/promises")).realpath(p);

const RUN = "run-c03";
const FRD = "frd-01-alpha";
const WO_DIR = `docs/frds/${FRD}/work-orders`;
const AGENT = { runtime: "claude", model: "sonnet", effort: "medium" };

/** One sandbox: fixture + G1 stub + integration worktree + lease + state + journal. */
const withRun = async (fn, { card = null } = {}) => {
  const dir = await mkdtemp(path.join(SCRATCH_ROOT, "pc-c03-"));
  const { createFixture, testEnv, git } = await fixturesMod();
  const env = { ...testEnv(dir) }; delete env.PANDACORP_NOW;
  const fx = await createFixture("basic", { dir });
  try {
    return await withEnv(env, async () => {
      const root = fx.root;
      await writeFile(path.join(root, ".pandacorp", "verify.sh"), VERIFY_SH); await chmod(path.join(root, ".pandacorp", "verify.sh"), 0o755);
      const wo1 = path.join(root, WO_DIR, "wo-01-001.md");
      const before = await readFile(wo1, "utf8");
      const after = before.replace("  - 'src/alpha/list.ts'", `  - 'src/alpha/list.ts'\n  - '${TEST_PATH}'`);
      if (after === before) throw new Error("fixture changed shape: WO-01-001 artifacts line not found");
      await writeFile(wo1, after);
      git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "fixture: v2 report test setup"]);
      const baseSha = git(root, ["rev-parse", "HEAD"]);

      const { buildPaths, } = await buildMod("paths.mjs");
      const st = await buildMod("state.mjs");
      const adm = await buildMod("admission.mjs");
      const jr = await buildMod("journal.mjs");
      const bs = await bsMod();
      const paths = buildPaths(root);
      // CONTRACT CONFLICT (reported): git cannot hold refs `lane/<run>` AND `lane/<run>/<unit>` (D/F ref conflict), so the
      // integration branch of this sandbox is named integration/<run>; unit branches keep the A13 names.
      const branch = `integration/${RUN}`;
      git(root, ["worktree", "add", "-q", "-b", branch, paths.integrationWorktree, "main"]);
      const lease = await bs.acquire(root, { runtime: "claude", runId: RUN, ttlSeconds: 1800, projectStatus: false, coordinator: "session" });
      const epoch = lease.epoch;
      const state0 = st.newState({ run_id: RUN, epoch, coordinator: "claude-session", label: "claude", size: "feature",
        scope: { card, frds: [FRD], wos: ["WO-01-001", "WO-01-002"], out_of_scope: [] },
        integration: { branch, worktree: paths.integrationWorktree, base_sha: baseSha } });
      await st.writeState(root, state0);
      await jr.appendEvent(paths.journalFile, { run_id: RUN, epoch, actor: "cli", type: "run_started", data: { detect: {}, preflight: {}, state: state0 } });

      const mainSha = () => git(root, ["rev-parse", "main"]);
      const ctx = {
        dir, root, env, fx, git, paths, epoch, branch, baseSha, st, adm, jr, bs,
        mainShaAtStart: mainSha(), intTipAtStart: git(root, ["rev-parse", branch]),
        state: () => st.readState(root),
        unit: async (id) => (await st.readState(root)).units.find((u) => u.id === id),
        /** Create or re-dispatch a unit: token, unit worktree and branch from the integration branch, state `running`. */
        async dispatch(fields) {
          const cur = (await ctx.state()).units.find((u) => u.id === fields.id) ?? {};
          const attempt = fields.attempt ?? cur.attempt ?? 1;
          const tok = adm.issueToken(fields.id, "B", { file: paths.admissionFile });
          const wt = paths.unitWorktree(fields.id, attempt); const br = paths.unitBranch(RUN, fields.id, attempt);
          git(root, ["worktree", "add", "-q", "-b", br, wt, branch]);
          const unit = st.newUnit({ chain: null, ...cur, ...fields, attempt, state: "running", token_hash: tok.token_hash, worker: { ...AGENT, via: "agent", pid: null, worker_id: null }, worktree: wt, branch: br });
          const s = await ctx.state();
          await st.writeState(root, { ...s, units: [...s.units.filter((u) => u.id !== unit.id), unit] });
          return { id: unit.id, token: tok.token, wt, branch: br, attempt };
        },
        /** Commit a file on the integration branch (as an earlier integrated unit would have) and return its sha256. */
        async integrateFile(rel, text) {
          const f = path.join(paths.integrationWorktree, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text);
          git(paths.integrationWorktree, ["add", "--", rel]); git(paths.integrationWorktree, ["commit", "-q", "-m", `integrated ${rel}`]);
          ctx.intTipAtStart = git(root, ["rev-parse", branch]);
          return sha256(text);
        },
        async write(u, files) { for (const [rel, text] of Object.entries(files)) { const f = path.join(u.wt, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text); } },
        report(u, over = {}) {
          return { schema: 1, unit: u.id, token: u.token, status: "done", summary: "did the work", files: [], verification: [{ command: "node --test", exit_code: 0, tail: "ok" }],
            pending: [], doubt: null, diagnosis: null, gate: null, authored_by: AGENT, ...over };
        },
        /** Write report.json (validated against the real schema) and call report.mjs; normalizes rejection vs fence vs crash. */
        async submit(u, rep, { token = u.token, epoch: ep = epoch } = {}) {
          const schema = await (await buildMod("fsx.mjs")).loadSchema("report");
          const v = (await buildMod("fsx.mjs")).validate(schema, rep);
          if (!v.ok) throw new Error(`test bug: report fixture is invalid: ${JSON.stringify(v.errors)}`);
          const file = paths.reportFile(u.id); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(rep, null, 2)}\n`);
          const fn = await needAny("report.mjs", ["ingestReport", "report"]);
          try { const res = await fn({ project: root, epoch: ep, unit: u.id, ...(token === undefined ? {} : { token }), file }, { env }); return { ...res }; }
          catch (e) {
            if (e?.code === "FENCE" || e?.code === "QUIESCED") return { fence: true, error: e };
            if (REJECT_CODES.includes(e?.code)) return { outcome: "rejected", thrown: e };
            throw new Error(`report threw an unexpected error (${e?.code || e?.name}): ${e?.message}`);
          }
        },
        tip: (br) => git(root, ["rev-parse", br]),
        mainClean() {
          eq(git(root, ["status", "--porcelain"]), "", "main checkout has tracked/untracked changes after report");
          eq(mainSha(), ctx.mainShaAtStart, "main moved");
          eq(git(root, ["rev-parse", branch]), ctx.intTipAtStart, "integration branch moved (report must commit on the unit branch only)");
        },
        g1Log: async () => { const f = path.join(root, ".git", "pc-g1-argv.log"); return existsSync(f) ? (await readFile(f, "utf8")).trim().split("\n").filter(Boolean) : []; },
        events: async () => { let all = ""; for (const k of ["PANDACORP_EVENTS_FILE", "PANDACORP_CODEX_EVENTS_FILE"]) { try { all += await readFile(env[k], "utf8"); } catch { /* absent */ } } return all; },
        journal: async () => (await jr.readJournal(paths.journalFile)).events,
        trailers: (br) => git(root, ["log", "-1", "--format=%(trailers:only,unfold)", br]),
        body: (br) => git(root, ["log", "-1", "--format=%B", br]),
        files: (br) => git(root, ["show", "--name-only", "--format=", br]).split("\n").filter(Boolean).sort(),
      };
      return await fn(ctx);
    });
  } finally { await fx.cleanup().catch(() => {}); await rm(dir, { recursive: true, force: true }); }
};

const buildUnit = (over = {}) => ({ id: "u-build-wo-01-001", kind: "build", wos: ["WO-01-001"], frd: FRD, chain: "c-wo-01-001", ...over });
const testsUnit = (over = {}) => ({ id: "u-tests-wo-01-001", kind: "tests", wos: ["WO-01-001"], frd: FRD, ...over });
const docsUnit = (over = {}) => ({ id: "u-docs-add-filter", kind: "docs", wos: [], frd: FRD, ...over });

/** Asserts a rejection that consumed nothing in git: outcome rejected, no commit, no integration/main movement. */
const assertRejected = async (c, u, res, what) => {
  eq(res.outcome, "rejected", `${what}: outcome`);
  ok(!res.commit, `${what}: a rejected report must not carry a commit`);
  eq(c.tip(u.branch), c.integrationTip ?? c.tip(c.branch), `${what}: the unit branch must not have a commit`);
  c.mainClean();
};
const assertAttemptBumped = async (c, u, to, what) => {
  const unit = await c.unit(u.id);
  eq(unit.state, "queued", `${what}: unit state`); eq(unit.attempt, to, `${what}: attempt (the offender pays, A13)`);
};

// =====================================================================================================================
// report.mjs: happy path, trailers, pathspec-limited commit, nothing in the main checkout
// =====================================================================================================================
await test("report: a valid in-scope chain is committed once on the UNIT branch with Unit:/WO: trailers and never Change:", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit({ wos: ["WO-01-001", "WO-01-002"] }));
  await c.write(u, { "src/alpha/list.ts": "export const value = 2;\n", "src/alpha/filter.ts": "export const filter = 1;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/filter.ts", "src/alpha/list.ts"] }));
  eq(res.outcome, "committed", "outcome");
  ok(/^[0-9a-f]{40}$/.test(res.commit || ""), `commit sha missing: ${res.commit}`);
  eq(res.commit, c.tip(u.branch), "result.commit is the unit branch tip");
  eq(git1(c, `rev-list --count ${c.branch}..${u.branch}`), "1", "exactly one commit for the whole chain (D30)");
  const tr = c.trailers(u.branch);
  ok(/^Unit: u-build-wo-01-001$/m.test(tr), `Unit trailer missing: ${tr}`);
  ok(/^WO: WO-01-001$/m.test(tr) && /^WO: WO-01-002$/m.test(tr), `one WO trailer per WO expected: ${tr}`);
  ok(!/^Change:/m.test(c.body(u.branch)) && !/Supersedes-Change:/.test(c.body(u.branch)), "unit commits must never carry a Change: trailer (D28)");
  eq(c.files(u.branch), ["src/alpha/filter.ts", "src/alpha/list.ts"], "commit holds exactly the validated files (pathspec-limited)");
  c.mainClean();
}));

// BL-0318: funko-tracker br-2026-11-14-01 rejected 43 files of correct work because .claude/launch.json and
// e2e/server-env.json, rewritten by the worktree's own bootstrap (skip-worktree bit lost), looked like worker changes.
const LAUNCH = ".claude/launch.json";
const writeBootstrapManifest = async (c, u, files, { pathOverride = null } = {}) => {
  const { realpathSync, lstatSync, readFileSync } = await import("node:fs");
  const wt = realpathSync(u.wt);
  const common = realpathSync(c.git(wt, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const st = lstatSync(path.join(wt, ".git"));
  const generated = Object.fromEntries(files.map((f) => [f, sha256(readFileSync(path.join(wt, f)))]));
  const id = sha256(pathOverride ?? wt);
  const file = path.join(path.dirname(common), ".pandacorp/run/worktrees", `bootstrap-${id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ producer: "worktree-bootstrap", version: 1, path: pathOverride ?? wt, identity: `${st.dev}:${st.ino}:${st.birthtimeMs}`,
    gitdir: realpathSync(c.git(wt, ["rev-parse", "--absolute-git-dir"])), generated_files: generated }));
};
const bootstrapCase = async (c) => {
  await c.integrateFile(LAUNCH, `${JSON.stringify({ version: "0.0.1", configurations: [{ name: "app", port: 3000 }] })}\n`);
  c.integrationTip = c.tip(c.branch);
  const u = await c.dispatch(buildUnit());
  await c.write(u, { [LAUNCH]: `${JSON.stringify({ version: "0.0.1", configurations: [{ name: "app-wt", autoPort: true }] })}\n` });
  return u;
};
await test("BL-0318 report: a bootstrap-written file (manifest hash unchanged) is not a worker change: the work is committed without it", async () => withRun(async (c) => {
  const u = await bootstrapCase(c);
  await writeBootstrapManifest(c, u, [LAUNCH]);
  await c.write(u, { "src/alpha/list.ts": "export const value = 4;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  eq(res.outcome, "committed", `outcome (${JSON.stringify(res.reasons ?? res.thrown?.message ?? "")})`);
  eq(c.files(u.branch), ["src/alpha/list.ts"], "the bootstrap file is never committed");
}));
await test("BL-0318 adversarial: a worker edit AFTER the bootstrap (hash differs) is still rejected", async () => withRun(async (c) => {
  const u = await bootstrapCase(c);
  await writeBootstrapManifest(c, u, [LAUNCH]);
  await c.write(u, { [LAUNCH]: "{\"tampered\":true}\n", "src/alpha/list.ts": "export const value = 4;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  await assertRejected(c, u, res, "worker-edited bootstrap file");
}));
await test("BL-0318 adversarial: without a manifest, or with a manifest for another path, the change still counts", async () => {
  for (const variant of ["none", "foreign"]) {
    await withRun(async (c) => {
      const u = await bootstrapCase(c);
      if (variant === "foreign") await writeBootstrapManifest(c, u, [LAUNCH], { pathOverride: "/elsewhere/wt" });
      await c.write(u, { "src/alpha/list.ts": "export const value = 4;\n" });
      const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
      await assertRejected(c, u, res, `bootstrap file with ${variant} manifest`);
    });
  }
});
await test("BL-0318 adversarial: a file outside the bootstrap's own list (src/alpha/filter.ts) is never excused by a manifest", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/filter.ts": "export const filter = 9;\n", "src/alpha/list.ts": "export const value = 4;\n" });
  await writeBootstrapManifest(c, u, ["src/alpha/filter.ts"]);
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  await assertRejected(c, u, res, "non-bootstrap path in the manifest");
}));

await test("report: unit state committed, token released, journal report_received + wo_committed, legacy wo_commit event", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 3;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  eq(res.outcome, "committed", "outcome");
  const unit = await c.unit(u.id);
  eq(unit.state, "committed", "unit state"); eq(unit.attempt, 1, "attempt unchanged");
  eq(c.adm.verifyToken(u.id, u.token, { file: c.paths.admissionFile }).ok, false, "the unit token must be released after a committed report");
  const events = await c.journal();
  const rr = events.find((e) => e.type === "report_received");
  ok(rr, "journal report_received missing"); eq(rr.data.unit, u.id, "report_received.unit"); eq(rr.data.outcome, "committed", "report_received.outcome"); eq(rr.data.commit, res.commit, "report_received.commit");
  ok(events.some((e) => e.type === "wo_committed"), "journal wo_committed missing");
  const text = await c.events();
  ok(/wo_commit/.test(text) && text.includes(u.id) || /wo_commit/.test(text) && text.includes("WO-01-001"), `legacy wo_commit event not emitted (events: ${text.slice(0, 200) || "none"})`);
  c.mainClean();
}));

await test("report: G1 runs verify.sh --light --tests=<test files among report.files> inside the UNIT worktree", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 4;\n", [TEST_PATH]: GREEN });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts", TEST_PATH] }));
  eq(res.outcome, "committed", "outcome");
  const log = await c.g1Log();
  ok(log.length >= 1, "verify.sh was never run by report (G1 is mandatory)");
  const [cwd, argv] = log[log.length - 1].split("\t");
  eq(path.resolve(cwd), path.resolve(await realpath(u.wt)), "G1 cwd must be the unit worktree");
  ok(/(^|\s)--light(\s|$)/.test(argv), `G1 must pass --light: ${argv}`);
  ok(new RegExp(`--tests=\\S*${TEST_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(argv), `G1 must pass --tests=<the test files>: ${argv}`);
  ok(!argv.includes("src/alpha/list.ts"), `non-test files must not be in --tests: ${argv}`);
  eq(res.g1?.exit, 0, "result.g1.exit");
}));

await test("report: G1 red on a build unit is rejected (6), nothing committed, the attempt is consumed", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 5;\n", [TEST_PATH]: RED });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts", TEST_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "G1 red");
  ok(res.g1 === undefined || res.g1.exit !== 0, "g1.exit must be non-zero");
  await assertAttemptBumped(c, u, 2, "G1 red");
}));

await test("report: a fenced command with a wrong epoch is refused with FENCE and changes nothing", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 6;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }), { epoch: c.epoch + 5 });
  ok(res.fence, `expected FENCE, got ${JSON.stringify(res).slice(0, 200)}`);
  eq(c.tip(u.branch), c.tip(c.branch), "no commit on a fence failure"); eq((await c.unit(u.id)).state, "running", "unit untouched");
}));

// =====================================================================================================================
// Token (D4): tokenless / wrong token rejected
// =====================================================================================================================
await test("report: tokenless report is rejected (no --token, empty token in the file): no commit, no state change to committed", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 7;\n" });
  const res = await c.submit(u, c.report(u, { token: "", files: ["src/alpha/list.ts"] }), { token: undefined });
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "tokenless");
  ok((await c.unit(u.id)).state !== "committed", "unit must not be committed without a token");
}));
await test("report: a wrong token (not issued for this unit) is rejected", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 8;\n" });
  const res = await c.submit(u, c.report(u, { token: "f".repeat(64), files: ["src/alpha/list.ts"] }), { token: "f".repeat(64) });
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "wrong token");
  ok((await c.unit(u.id)).state !== "committed", "unit must not be committed with a foreign token");
}));
await test("report: a token issued for ANOTHER unit does not authorize this one", async () => withRun(async (c) => {
  const a = await c.dispatch(buildUnit()); const b = await c.dispatch(buildUnit({ id: "u-build-wo-02-001", wos: ["WO-02-001"], frd: "frd-02-beta", chain: "c-wo-02-001" }));
  await c.write(a, { "src/alpha/list.ts": "export const value = 9;\n" });
  const res = await c.submit(a, c.report(a, { token: b.token, files: ["src/alpha/list.ts"] }), { token: b.token });
  c.integrationTip = c.tip(c.branch); await assertRejected(c, a, res, "foreign unit token");
}));
await test("report: report.unit different from --unit is rejected", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 10;\n" });
  const res = await c.submit(u, c.report(u, { unit: "u-build-wo-99-999", files: ["src/alpha/list.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "unit mismatch");
}));

// =====================================================================================================================
// A2 write allowlists, files == worktree changes, snapshots, WO frontmatter
// =====================================================================================================================
await test("report: a file changed in the worktree but missing from report.files is rejected (files must equal the changes)", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 11;\n", "src/alpha/extra.ts": "export const extra = 1;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "unreported change"); await assertAttemptBumped(c, u, 2, "unreported change");
}));
await test("report: a file listed in report.files that the worktree did not change is rejected", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 12;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts", "src/alpha/filter.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "phantom file");
}));
await test("report: a build unit touching a file outside its WOs' artifacts is rejected (forbidden file), the attempt is consumed", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 13;\n", "src/beta/view.ts": "export const value = 99;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts", "src/beta/view.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "out-of-artifacts"); await assertAttemptBumped(c, u, 2, "out-of-artifacts");
}));
await test("report: a build unit may touch only the union of its chain's WOs' artifacts (WO-01-002 file is inside a chain of 001+002, outside a unit of 001 alone)", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/filter.ts": "export const filter = 2;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/filter.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "sibling WO artifact");
}));
await test("report: a path under **/*-snapshots/** is rejected even in a tests unit (blessed baselines are never written by workers)", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { "e2e/visual.spec.ts-snapshots/a.png": "png-bytes" });
  const res = await c.submit(u, c.report(u, { files: ["e2e/visual.spec.ts-snapshots/a.png"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "snapshot");
}));
await test("report: a tests unit may not touch production code or non-test helpers (A2 tests allowlist)", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [TEST_PATH]: RED, "src/alpha/list.ts": "export const value = 77;\n" });
  const res = await c.submit(u, c.report(u, { files: [TEST_PATH, "src/alpha/list.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "tests unit touching src");
  const u2 = await c.dispatch(testsUnit({ attempt: 2 }));
  await c.write(u2, { [TEST_PATH]: RED, "src/alpha/helper.mjs": "export const h = 1;\n" });
  const res2 = await c.submit(u2, c.report(u2, { files: [TEST_PATH, "src/alpha/helper.mjs"] }));
  eq(res2.outcome, "rejected", "tests unit touching a non-test helper");
}));
await test("report: a docs unit may edit docs/** and CREATE a new work-order file whose frontmatter is PLANNED (A2), committed with a Unit: trailer", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const newWo = `${WO_DIR}/wo-01-003.md`;
  await c.write(u, { [newWo]: woText("WO-01-003", "PLANNED"), [`docs/frds/${FRD}/frd.md`]: "# FRD-01 Alpha list\n\nUpdated by the docs unit.\n" });
  const res = await c.submit(u, c.report(u, { files: [`docs/frds/${FRD}/frd.md`, newWo] }));
  eq(res.outcome, "committed", "docs unit creating a PLANNED WO");
  ok(/^Unit: u-docs-add-filter$/m.test(c.trailers(u.branch)), "Unit trailer on a docs commit");
  ok(!/^Change:/m.test(c.body(u.branch)), "no Change: trailer on a docs commit");
  c.mainClean();
}));
// BL-0315: a card run plans only WOs whose source_change names the card; a docs unit that creates one without it would
// make the run land the docs and finish with zero build units (funko-tracker br-2026-11-13-02).
const CARD = "explore-home-alive";
await test("BL-0315 report: in a card run a docs unit's NEW WO without source_change naming the card is rejected (attempt consumed)", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const newWo = `${WO_DIR}/wo-01-003.md`;
  await c.write(u, { [newWo]: woText("WO-01-003", "PLANNED") });
  const res = await c.submit(u, c.report(u, { files: [newWo] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "new WO without source_change");
  ok(JSON.stringify(res).includes(`source_change: [${CARD}]`) || JSON.stringify(res.thrown?.message ?? "").includes(CARD), `the rejection names the card: ${JSON.stringify(res).slice(0, 400)}`);
  await assertAttemptBumped(c, u, 2, "new WO without source_change");
}, { card: CARD }));
await test("BL-0315 report: source_change naming ANOTHER card, or an empty list, is rejected too", async () => withRun(async (c) => {
  for (const [i, sc] of [["4", "source_change: [other-card]\n"], ["5", "source_change: []\n"]]) {
    const u = await c.dispatch(docsUnit({ id: `u-docs-x${i}` }));
    const newWo = `${WO_DIR}/wo-01-00${i}.md`;
    await c.write(u, { [newWo]: woText(`WO-01-00${i}`, "PLANNED").replace("dependsOn: []\n", `dependsOn: []\n${sc}`) });
    const res = await c.submit(u, c.report(u, { files: [newWo] }));
    c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, `new WO with ${sc.trim()}`);
  }
}, { card: CARD }));
await test("BL-0315 report: a card-run docs unit whose new WOs list the card (inline or block list, any case) is committed", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const a = `${WO_DIR}/wo-01-003.md`; const b = `${WO_DIR}/wo-01-004.md`;
  await c.write(u, {
    [a]: woText("WO-01-003", "PLANNED").replace("dependsOn: []\n", `dependsOn: []\nsource_change: [${CARD}]\n`),
    [b]: woText("WO-01-004", "PLANNED").replace("dependsOn: []\n", `dependsOn: []\nsource_change:\n  - ${CARD.toUpperCase()}\n`),
  });
  const res = await c.submit(u, c.report(u, { files: [a, b] }));
  eq(res.outcome, "committed", `card-bound WOs are accepted: ${JSON.stringify(res).slice(0, 300)}`);
}, { card: CARD }));
await test("BL-0315 report: without a card (FRD/plan scope) a new WO needs no source_change (unchanged)", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const newWo = `${WO_DIR}/wo-01-003.md`;
  await c.write(u, { [newWo]: woText("WO-01-003", "PLANNED") });
  eq((await c.submit(u, c.report(u, { files: [newWo] }))).outcome, "committed", "no card, no source_change requirement");
}));
await test("BL-0315 planner: a card-scope plan schedules a PLANNED WO only when its source_change names the card", async () => {
  const { plan } = await buildMod("planner.mjs");
  const wo = (id, sc) => ({ id, frd: FRD, file: `${WO_DIR}/${id.toLowerCase()}.md`, status: "PLANNED", deps: [], artifacts: [`src/alpha/${id}.ts`], acs: [], source_change: sc });
  const res = plan({ wos: [wo("WO-01-003", []), wo("WO-01-004", [CARD])], frd_acs: {}, scope: { card: CARD, frds: [FRD], wos: [], out_of_scope: [] }, units: [], label: "claude", size: "feature", questions: [], quota: null });
  const planned = (res.units ?? []).flatMap((u) => u.wos ?? []).map((w) => String(w).toUpperCase());
  ok(planned.includes("WO-01-004") && !planned.includes("WO-01-003"), `only the card-bound WO is planned: ${JSON.stringify(planned)}`);
});
await test("BL-0315 brief: a docs unit of a card run is told to set source_change: [<card>] on every new WO", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const st = await buildMod("state.mjs");
  const state = await st.readState(c.root ?? process.cwd());
  const { writeUnitBrief } = await buildMod("units.mjs");
  const unit = state.units.find((x) => x.id === u.id);
  const brief = await writeUnitBrief({ project: c.root, state, unit, cell: { runtime: "codex", model: "sol", effort: "high" }, agentType: "pandacorp:implementer", token: "t".repeat(64), schemaPath: "" });
  ok(brief.text.includes(`source_change: [${CARD}]`), "docs brief names the card's source_change rule");
}, { card: CARD }));
await test("report: a docs unit creating a new WO that is NOT PLANNED is rejected", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const newWo = `${WO_DIR}/wo-01-003.md`;
  await c.write(u, { [newWo]: woText("WO-01-003", "IN_PROGRESS") });
  const res = await c.submit(u, c.report(u, { files: [newWo] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "new WO not PLANNED");
}));
await test("report: a docs unit changing the frontmatter of an EXISTING work order is rejected (every kind, A2)", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  const wo = `${WO_DIR}/wo-01-001.md`;
  const cur = await readFile(path.join(u.wt, wo), "utf8");
  await c.write(u, { [wo]: cur.replace("implementation_status: PLANNED", "implementation_status: VERIFIED") });
  const res = await c.submit(u, c.report(u, { files: [wo] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "existing WO frontmatter edit");
  await assertAttemptBumped(c, u, 2, "existing WO frontmatter edit");
}));
await test("report: a docs unit touching src/** is rejected (docs allowlist is docs/**, README.md, .env.example)", async () => withRun(async (c) => {
  const u = await c.dispatch(docsUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 14;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "docs unit touching src");
}));

// =====================================================================================================================
// Hashed test files (D16, A13): edits rejected, positive control
// =====================================================================================================================
await test("report: a build unit that edits a hashed test file (a tests unit's test_hashes) is rejected; the same unit without that edit commits", async () => withRun(async (c) => {
  const hash = await c.integrateFile(TEST_PATH, GREEN);
  const s = await c.state();
  await c.st.writeState(c.root, { ...s, units: [...s.units, c.st.newUnit({ ...testsUnit(), state: "integrated", test_hashes: { [TEST_PATH]: hash } })] });
  const bad = await c.dispatch(buildUnit());
  await c.write(bad, { "src/alpha/list.ts": "export const value = 15;\n", [TEST_PATH]: `${GREEN}// tweaked by the implementer\n` });
  const res = await c.submit(bad, c.report(bad, { files: ["src/alpha/list.ts", TEST_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, bad, res, "hashed test edit"); await assertAttemptBumped(c, bad, 2, "hashed test edit");
  const good = await c.dispatch({ id: "u-build-wo-01-001", attempt: 2 });
  await c.write(good, { "src/alpha/list.ts": "export const value = 15;\n" });
  const ok2 = await c.submit(good, c.report(good, { files: ["src/alpha/list.ts"] }));
  eq(ok2.outcome, "committed", "positive control: the same unit leaving the hashed file alone commits");
}));
await test("report: probe_hashes (review units) are protected exactly like test_hashes", async () => withRun(async (c) => {
  const hash = await c.integrateFile(PROBE_PATH, GREEN);
  const s = await c.state();
  await c.st.writeState(c.root, { ...s, units: [...s.units, c.st.newUnit({ id: "u-review-frd-01-alpha", kind: "review", frd: FRD, state: "verified", probe_hashes: { [PROBE_PATH]: hash } })] });
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [PROBE_PATH]: RED });
  const res = await c.submit(u, c.report(u, { files: [PROBE_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "probe hash edit");
}));

// =====================================================================================================================
// Tests units (D16): RED by assertion accepted + hashed; import/syntax errors and not-RED rejected
// =====================================================================================================================
await test("report: tests unit RED by ASSERTION is accepted (committed) and its test files are hashed into the unit and the result", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [TEST_PATH]: RED });
  const res = await c.submit(u, c.report(u, { files: [TEST_PATH] }));
  eq(res.outcome, "committed", "outcome (G1 red by assertion is the expected state of a tests unit)");
  eq(res.test_hashes, { [TEST_PATH]: sha256(RED) }, "result.test_hashes (sha256 of the file bytes)");
  const unit = await c.unit(u.id);
  eq(unit.test_hashes, { [TEST_PATH]: sha256(RED) }, "state.units[].test_hashes"); eq(unit.state, "committed", "unit state");
  const rr = (await c.journal()).find((e) => e.type === "report_received");
  eq(rr?.data?.test_hashes, { [TEST_PATH]: sha256(RED) }, "report_received.data.test_hashes");
  eq(c.files(u.branch), [TEST_PATH], "only the test file is committed"); ok(/^Unit: u-tests-wo-01-001$/m.test(c.trailers(u.branch)), "Unit trailer");
  c.mainClean();
}));
await test("report: tests unit whose test fails on an IMPORT error is rejected (RED must be by assertion)", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [TEST_PATH]: IMPORT_ERR });
  const res = await c.submit(u, c.report(u, { files: [TEST_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "import error"); await assertAttemptBumped(c, u, 2, "import error");
  eq((await c.unit(u.id)).test_hashes, {}, "no hashes recorded for a rejected tests unit");
}));
await test("report: tests unit whose test fails on a SYNTAX error is rejected", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [TEST_PATH]: SYNTAX_ERR });
  const res = await c.submit(u, c.report(u, { files: [TEST_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "syntax error");
}));
await test("report: tests unit whose new tests PASS is rejected (tests-first means RED first)", async () => withRun(async (c) => {
  const u = await c.dispatch(testsUnit());
  await c.write(u, { [TEST_PATH]: GREEN });
  const res = await c.submit(u, c.report(u, { files: [TEST_PATH] }));
  c.integrationTip = c.tip(c.branch); await assertRejected(c, u, res, "tests unit not RED");
}));

// =====================================================================================================================
// Outcomes: gate, doubt, blocked
// =====================================================================================================================
await test("report: a non-null gate puts the unit in waiting_gate (exit 7), journals waiting_gate and emits WaitingGate", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  await c.write(u, { "src/alpha/list.ts": "export const value = 16;\n" });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"], gate: { kind: "money", detail: "needs a paid plan" } }));
  eq(res.outcome, "waiting_gate", "outcome");
  const unit = await c.unit(u.id);
  eq(unit.state, "waiting_gate", "unit state"); eq(unit.waiting_gate, "money", "unit.waiting_gate"); eq(unit.attempt, 1, "a gate consumes no attempt");
  const ev = (await c.journal()).find((e) => e.type === "waiting_gate");
  ok(ev && ev.data.unit === u.id && ev.data.kind === "money", `journal waiting_gate {unit, kind} missing: ${JSON.stringify(ev)}`);
  ok(/WaitingGate/.test(await c.events()), "WaitingGate event not emitted");
  c.mainClean();
}));
await test("report: status doubt leaves the unit reported, consumes NO attempt, releases the token, commits nothing", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  const res = await c.submit(u, c.report(u, { status: "doubt", doubt: { question: "Which sort order?", options: [{ id: "a", text: "asc" }, { id: "b", text: "desc" }], preferred: "a", why: "docs silent" } }));
  eq(res.outcome, "doubt", "outcome");
  const unit = await c.unit(u.id);
  eq(unit.state, "reported", "unit state"); eq(unit.attempt, 1, "attempt not consumed");
  eq(c.adm.verifyToken(u.id, u.token, { file: c.paths.admissionFile }).ok, false, "token released on a doubt");
  eq(c.tip(u.branch), c.tip(c.branch), "no commit on a doubt");
}));
await test("report: status blocked with a dependency diagnosis is an immediate hand-back: unit blocked, no commit on the unit branch (D21, R4)", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  const forkTip = c.tip(u.branch);
  const res = await c.submit(u, c.report(u, { status: "blocked", summary: "missing secret", diagnosis: { cause: "dependency", detail: "STRIPE key absent" } }));
  eq((await c.unit(u.id)).state, "blocked", "dependency => immediate hand-back, unit blocked (D21, R4)");
  eq(res.outcome, "blocked", "outcome"); ok(!res.commit, "no commit");
  ok((await c.unit(u.id)).state !== "committed", "unit must not be committed");
  eq(c.tip(u.branch), forkTip, "no commit on the unit branch on blocked");
}));
await test("report: a diff touching a deploy path (S8) opens an external gate (D28): commit kept on the unit branch, resumes to committed only after the owner's OK", async () => withRun(async (c) => {
  const u = await c.dispatch(buildUnit());
  const forkTip = c.tip(u.branch);
  const DEPLOY_LINE = ["// vercel", "deploy --prod"].join(" ");
  await c.write(u, { "src/alpha/list.ts": `export const value = 17;\n${DEPLOY_LINE}\n` });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts"] }));
  eq(res.outcome, "waiting_gate", "S8/deploy diff => waiting_gate");
  if (res.gate) eq(res.gate.kind, "external", "gate kind external for a deploy command");
  let unit = await c.unit(u.id);
  eq(unit.state, "waiting_gate", "unit state"); eq(unit.waiting_gate, "external", "unit.waiting_gate"); eq(unit.attempt, 1, "a gate consumes no attempt");
  ok(c.tip(u.branch) !== forkTip, "the unit commit is KEPT on the unit branch while the gate is open");
  const keptTip = c.tip(u.branch);
  const jr1 = await c.journal();
  ok(!jr1.some((e) => e.type === "wo_committed" && e.data?.unit === u.id), "no wo_committed before the owner's answer");
  ok(jr1.some((e) => e.type === "waiting_gate" && e.data?.unit === u.id && e.data?.kind === "external"), "journal waiting_gate {unit, kind: external}");
  c.mainClean();
  eq(c.tip(c.branch), c.intTipAtStart, "no answer: nothing lands on the integration branch");
  // the owner answers g-<unit> true: the unit is queued again (A13) and re-dispatched on the same worktree/branch
  const tok = c.adm.issueToken(u.id, "B", { file: c.paths.admissionFile });
  const s = await c.state();
  await c.st.writeState(c.root, { ...s, answers: { ...(s.answers ?? {}), [`g-${u.id}`]: true },
    units: s.units.map((x) => (x.id === u.id ? { ...x, state: "running", waiting_gate: null, token_hash: tok.token_hash } : x)) });
  const u2 = { ...u, token: tok.token };
  const res2 = await c.submit(u2, c.report(u2, { files: ["src/alpha/list.ts"] }));
  eq(res2.outcome, "committed", "after the owner's OK the same report resumes to committed");
  unit = await c.unit(u.id);
  eq(unit.state, "committed", "unit committed"); eq(c.tip(u.branch), keptTip, "resumed from the kept commit (no second commit)");
}));

// =====================================================================================================================
// D21 failure policy: attempts, automatic attempt 3, identical evidence -> hand-back
// =====================================================================================================================
const failG1 = async (c, id, attempt, testText, over = {}) => {
  const u = await c.dispatch(attempt === 1 ? buildUnit({ id }) : { id, attempt });
  await c.write(u, { "src/alpha/list.ts": "export const value = 20;\n", [TEST_PATH]: testText });
  const res = await c.submit(u, c.report(u, { files: ["src/alpha/list.ts", TEST_PATH], diagnosis: { cause: "code", detail: "the filter ignores status" }, ...over }));
  return { u, res };
};
await test("report: a failed attempt 2 WITH a diagnosis and NEW evidence queues attempt 3 automatically (next_attempt 3)", async () => withRun(async (c) => {
  const id = "u-build-wo-01-001";
  const a1 = await failG1(c, id, 1, RED); eq(a1.res.outcome, "rejected", "attempt 1 outcome (G1 red)"); await assertAttemptBumped(c, a1.u, 2, "after attempt 1");
  const a2 = await failG1(c, id, 2, RED_OTHER);
  ok(["rejected", "failed"].includes(a2.res.outcome), `attempt 2 outcome: ${a2.res.outcome}`);
  eq(a2.res.next_attempt, 3, "next_attempt"); await assertAttemptBumped(c, a2.u, 3, "after attempt 2");
  const unit = await c.unit(id); ok(unit.evidence_hash, "evidence_hash must be recorded for the next comparison (D21)");
}));
await test("report: attempt 2 failing with evidence IDENTICAL to attempt 1 is a hand-back, not an attempt 3 (D21)", async () => withRun(async (c) => {
  const id = "u-build-wo-01-001";
  const a1 = await failG1(c, id, 1, RED); eq(a1.res.outcome, "rejected", "attempt 1");
  const a2 = await failG1(c, id, 2, RED);
  ok(a2.res.next_attempt === null || a2.res.next_attempt === undefined, `identical evidence must not queue attempt 3 (next_attempt=${a2.res.next_attempt})`);
  const unit = await c.unit(id);
  ok(unit.state !== "queued", `identical evidence must hand back (park/block), unit is ${unit.state}`); eq(unit.attempt, 2, "no attempt 3 was started");
}));
await test("report: attempt 3 failing is final: no attempt 4, next_attempt null, the unit is not re-queued (hand-back)", async () => withRun(async (c) => {
  const id = "u-build-wo-01-001";
  await failG1(c, id, 1, RED); await failG1(c, id, 2, RED_OTHER);
  const a3 = await failG1(c, id, 3, RED_OTHER);
  ok(a3.res.next_attempt === null || a3.res.next_attempt === undefined, `no attempt 4 (next_attempt=${a3.res.next_attempt})`);
  const unit = await c.unit(id);
  ok(unit.state !== "queued" && unit.attempt <= 3, `attempt 3 evidence identical to attempt 2 must hand back; unit ${unit.state} attempt ${unit.attempt}`);
}));
await test("report: attempt 3 uses the branch/worktree suffix -a3 and a fresh token (A13/A16 through the dispatch the test performs)", async () => withRun(async (c) => {
  const id = "u-build-wo-01-001";
  await failG1(c, id, 1, RED); await failG1(c, id, 2, RED_OTHER);
  const u3 = await c.dispatch({ id, attempt: 3 });
  eq(u3.branch, `lane/${RUN}/${id}-a3`, "branch"); eq(path.basename(u3.wt), `${id}-a3`, "worktree dir");
}));

// =====================================================================================================================
// units.mjs: worktree/branch naming (A13/A16) and the brief (CLI doc 11.1)
// =====================================================================================================================
await test("units: createUnitWorktree makes a registered git worktree on lane/<run>/<unit> (attempt 1) and lane/<run>/<unit>-a<n> (n>=2), from the integration tip", async () => withRun(async (c) => {
  const create = await needAny("units.mjs", ["createUnitWorktree", "addUnitWorktree", "prepareUnitWorktree"]);
  const st = c.st; const s = await c.state();
  await st.writeState(c.root, { ...s, units: [st.newUnit(buildUnit())] });
  const r1 = await create({ project: c.root, runId: RUN, unit: { id: "u-build-wo-01-001", attempt: 1 }, base: c.branch }, { env: c.env });
  eq(r1.branch, `lane/${RUN}/u-build-wo-01-001`, "attempt 1 branch"); eq(path.resolve(r1.worktree), path.resolve(c.paths.unitWorktree("u-build-wo-01-001", 1)), "attempt 1 worktree (A16)");
  const registered1 = `worktree ${await realpath(r1.worktree)}`;
  ok(c.git(c.root, ["worktree", "list", "--porcelain"]).split("\n").includes(registered1), "attempt 1 is a registered worktree before retry");
  const r2 = await create({ project: c.root, runId: RUN, unit: { id: "u-build-wo-01-001", attempt: 2 }, base: c.branch }, { env: c.env });
  eq(r2.branch, `lane/${RUN}/u-build-wo-01-001-a2`, "attempt 2 branch"); eq(path.basename(r2.worktree), "u-build-wo-01-001-a2", "attempt 2 worktree dir");
  const list = c.git(c.root, ["worktree", "list", "--porcelain"]);
  // BUILD-15 reclaims the eligible previous checkout at retry, preserving its branch for recovery.
  ok(!existsSync(r1.worktree), "eligible attempt 1 checkout is reclaimed at retry");
  ok(!list.split("\n").includes(registered1) && list.split("\n").includes(`worktree ${await realpath(r2.worktree)}`), "only the current attempt remains registered");
  eq(c.tip(r1.branch), c.tip(c.branch), "unit branch starts at the integration tip");
  eq(c.tip(r2.branch), c.tip(c.branch), "retry branch starts at the integration tip");
  c.mainClean();
}));
await test("units: the brief holds the unit token, never the lease token, the unit's identity, the never-commit rules, the report path and the allowlist", async () => withRun(async (c) => {
  const write = await needAny("units.mjs", ["writeBrief", "generateBrief", "renderBrief"]);
  const s = await c.state(); const unit = c.st.newUnit({ ...buildUnit(), wos: ["WO-01-001"] });
  await c.st.writeState(c.root, { ...s, units: [unit] });
  const leaseTok = JSON.parse(await readFile(c.paths.tokenFile, "utf8")).token;
  const out = await write({ project: c.root, runId: RUN, unit, token: "unit-token-abc123", cell: { runtime: "claude", model: "sonnet", effort: "medium" }, via: "agent" }, { env: c.env });
  const text = existsSync(c.paths.briefFile(unit.id)) ? await readFile(c.paths.briefFile(unit.id), "utf8") : (typeof out === "string" ? out : "");
  ok(text.length > 200, "brief.md not written at paths.briefFile(unit)");
  ok(text.includes("unit-token-abc123"), "brief must carry the unit token (section 9 Identity)");
  ok(!text.includes(leaseTok), "brief must NEVER contain the lease token");
  ok(text.includes("u-build-wo-01-001") && text.includes("WO-01-001"), "brief names the unit and its WO");
  ok(/never run `?git commit/i.test(text) || /Never run `git commit`/.test(text), "brief must forbid git commit (the CLI commits)");
  ok(text.includes("PANDACORP_OWNER_RELEASE_OK"), "brief must forbid setting PANDACORP_OWNER_RELEASE_OK");
  ok(text.includes("src/alpha/list.ts"), "brief lists the write allowlist (the WO's artifacts)");
  ok(text.includes(c.paths.reportFile(unit.id)), "brief names the report path");
  ok(text.includes("-snapshots/"), "brief forbids snapshot paths");
}));
await test("units: a tests brief demands RED-first by assertion, no production code, and no hashes in the report", async () => withRun(async (c) => {
  const write = await needAny("units.mjs", ["writeBrief", "generateBrief", "renderBrief"]);
  const s = await c.state(); const unit = c.st.newUnit(testsUnit());
  await c.st.writeState(c.root, { ...s, units: [unit] });
  const out = await write({ project: c.root, runId: RUN, unit, token: "tok-tests-1", cell: { runtime: "codex", model: "sol", effort: "high" }, via: "cli" }, { env: c.env });
  const text = existsSync(c.paths.briefFile(unit.id)) ? await readFile(c.paths.briefFile(unit.id), "utf8") : (typeof out === "string" ? out : "");
  ok(/RED/.test(text) && /assertion/i.test(text), "tests brief must say RED-first / fail by assertion");
  ok(/import|syntax/i.test(text), "tests brief must exclude import/syntax failures");
  ok(/production code/i.test(text), "tests brief must forbid production code");
}));

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
