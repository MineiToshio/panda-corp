#!/usr/bin/env node
// make-fixture.mjs — deterministic fixtures for the engine v2 tests (plugin/runtime/build/**).
//
// WHAT IT BUILDS (everything under a caller-provided directory; nothing outside it, no network,
// no real ~/.claude, ~/.codex or host dir; git runs with an isolated config and fixed dates, so
// the same call yields the same commit SHAs):
//   project fixtures  createFixture(preset|options, {dir})  -> a throwaway git repo (branch main)
//     basic            .pandacorp/status.yaml (phase implementation), .gitignore (run/inbox/comms),
//                      docs/frds/frd-01-alpha (WO-01-001, WO-01-002) and frd-02-beta (WO-02-001,
//                      WO-02-002 = RISK PATH: touches src/lib/auth/session.ts), each FRD with frd.md,
//                      blueprint.md (## Build Plan table) and work-orders/*.md (all PLANNED), tiny src/,
//                      package.json, .pandacorp/verify.sh (exit 0 stub). One commit "fixture: initial".
//     card             basic + gitignored cards in .pandacorp/inbox/changes/: add-filter.md (feature,
//                      ready) and fix-crash.md (bug, ready); decisions.md untracked.
//     launched         basic + status phase release / deploy_target external / repo set, a BARE remote
//                      <dir>/remote.git as `origin` with main pushed (no pre-push hook installed).
//     tracked-decisions basic + .pandacorp/inbox/decisions.md force-tracked (Mission Control shape).
//   options object: {preset?, card?, launched?, trackedDecisions?, trackedHooksPath?, now?}
//     trackedHooksPath: set core.hooksPath to a tracked .githooks dir (pre-push install must refuse).
//   env samples       writeRolloutSample(codexHome, kind, {now}) kinds: normal | pct98 | stale |
//                     malformed | rate_limit_reached ; usageSample(kind) (get_usage shape);
//                     signalsSample(kind) kinds: clean | warn | critical | swap_rising | garbled
//                     (+ writeSignalsFile). Signals file = JSON of the RAW command outputs
//                     {sysctl_pressure, vm_stat, swapusage}; signalsExec(sample) is a fake `exec`.
//   fake binaries     fake-codex.mjs (PANDACORP_CODEX_BIN) and fake-worker.mjs (PANDACORP_FAKE_WORKER,
//                     A17); jobCommand(kind) argv for exit0 | exit1 | hang job commands.
//   testEnv(root, extra) -> an env object that points every hook at throwaway paths inside root.
//
// CREATE / CLEAN UP:   const fx = await createFixture("card", {dir: tmpDir});  ...  await fx.cleanup();
//   (cleanup removes only what the fixture created; the caller owns tmpDir: mkdtemp it, rm -rf it.)
// CLI:  node make-fixture.mjs <preset> --dir <abs dir> [--launched] [--card] [--tracked-decisions] [--nested]
//       node make-fixture.mjs --list | --selftest      (selftest uses its own temp dir and removes it)
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const FAKE_CODEX_BIN = path.join(FIXTURE_DIR, "fake-codex.mjs");
export const FAKE_WORKER_BIN = path.join(FIXTURE_DIR, "fake-worker.mjs");
export const DEFAULT_NOW = "2026-11-11T12:00:00.000Z";
export const PRESETS = ["basic", "card", "launched", "tracked-decisions"];

const GIT_ENV = (now) => ({
  PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir(), LANG: "C", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid", GIT_AUTHOR_DATE: now, GIT_COMMITTER_DATE: now,
});
/** Runs git in `cwd` with the isolated, deterministic environment; returns trimmed stdout. */
export const git = (cwd, args, now = DEFAULT_NOW) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: GIT_ENV(now), stdio: ["ignore", "pipe", "pipe"] }).trim();

const put = async (root, rel, text, mode) => { const f = path.join(root, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text); if (mode) await chmod(f, mode); };

const FRDS = [
  { id: "frd-01-alpha", n: "01", title: "Alpha list", wos: [
    { id: "WO-01-001", deps: [], art: ["src/alpha/list.ts"], ac: ["AC-01-001.1"] },
    { id: "WO-01-002", deps: ["WO-01-001"], art: ["src/alpha/filter.ts"], ac: ["AC-01-002.1"] } ] },
  { id: "frd-02-beta", n: "02", title: "Beta session", wos: [
    { id: "WO-02-001", deps: [], art: ["src/beta/view.ts"], ac: ["AC-02-001.1"] },
    { id: "WO-02-002", deps: ["WO-02-001"], art: ["src/lib/auth/session.ts"], ac: ["AC-02-002.1"] } ] },
];

const woFile = (frd, wo) => `---\nid: ${wo.id}\ntype: work-order\nslug: ${wo.id.toLowerCase()}\ntitle: ${wo.id} fixture work order\nstatus: ACTIVE\nparent: FRD-${frd.n}\nimplementation_status: PLANNED\nartifacts:\n${wo.art.map((a) => `  - '${a}'`).join("\n")}\nsource_requirements: [REQ-${frd.n}-001]\ndependsOn: [${wo.deps.join(", ")}]\nlast_updated: '2026-11-01'\n---\n# ${wo.id}\n\nImplement ${wo.art.join(", ")}.\n\n## Acceptance\n${wo.ac.map((a) => `- ${a}: WHEN the fixture runs, the system SHALL return its value.`).join("\n")}\n`;
const frdFile = (frd) => `---\nid: FRD-${frd.n}\ntype: frd\ntitle: FRD-${frd.n} ${frd.title}\nstatus: ACTIVE\nimplementation_status: PLANNED\nlast_updated: '2026-11-01'\nfloor: false\n---\n# FRD-${frd.n} ${frd.title}\n\n## Acceptance criteria (EARS)\n${frd.wos.flatMap((w) => w.ac).map((a) => `- ${a}: WHEN the fixture runs, the system SHALL return its value.`).join("\n")}\n`;
const blueprintFile = (frd) => `---\nid: BP-${frd.n}\ntype: blueprint\nimplementation_status: PLANNED\n---\n# Blueprint ${frd.title}\n\n## Build Plan\n\n| WO | Depends on | Artifacts | Foundation | Parallel with |\n|---|---|---|---|---|\n${frd.wos.map((w) => `| ${w.id} | ${w.deps.join(", ") || "—"} | ${w.art.map((a) => `\`${a}\``).join(", ")} | false | — |`).join("\n")}\n`;

const statusYaml = (o) => `# fixture status\nproject: "fixture"\nphase: ${o.launched ? "release" : "implementation"}\nversion: v1\noverlay_version: "8.114.4"\ndeploy_target: ${o.launched ? "external" : "internal"}\nrunning: false\nrepo: "${o.launched ? "https://example.invalid/fixture.git" : ""}"\nwork_orders_total: 4\nwork_orders_verified: 0\nwork_orders_in_review: 0\nwork_orders_planned: 4\nwork_orders_in_progress: 0\nwork_orders_blocked: 0\npending_decisions: 0\npending_bugs: 0\nupdated_at: "${o.now}"\n`;

const CARDS = {
  "add-filter": "---\ntype: feature\nclass: standard\nstatus: ready\ndate: 2026-11-10\nfrd: frd-01-alpha\nrigor: normal\n---\n\n# Add a status filter to the alpha list\n\nWHEN the owner picks a status, the list SHALL show only items with that status.\n",
  "fix-crash": "---\ntype: bug\nclass: expedite\nstatus: ready\ndate: 2026-11-10\nfrd: frd-02-beta\nrigor: normal\n---\n\n# Beta view crashes on an empty session\n\nOpening the beta view with no session throws; it SHALL render the empty state.\n",
};

/** Normalizes a preset name or options object into the option set (card, launched, trackedDecisions, trackedHooksPath, now). */
function resolveOptions(spec) {
  const o = typeof spec === "string" ? { preset: spec } : { ...spec };
  if (o.preset && !PRESETS.includes(o.preset)) throw new Error(`unknown fixture preset "${o.preset}" (known: ${PRESETS.join(", ")})`);
  return { card: o.preset === "card" || !!o.card, launched: o.preset === "launched" || !!o.launched, trackedDecisions: o.preset === "tracked-decisions" || !!o.trackedDecisions, nested: !!o.nested, trackedHooksPath: !!o.trackedHooksPath, now: o.now || DEFAULT_NOW, preset: o.preset || "custom" };
}

/**
 * Creates one throwaway project fixture inside `dir` (the caller's temp dir). Returns
 * {root, remote|null, dir, sha (HEAD of main), opts, env(extra), git(...args), cleanup()}.
 * Layout: <dir>/project (the repo), <dir>/remote.git (launched only).
 */
export async function createFixture(spec, { dir } = {}) {
  if (!dir || !path.isAbsolute(dir)) throw new Error("createFixture: {dir} must be an absolute caller-provided temp directory");
  const o = resolveOptions(spec);
  const repoRoot = path.join(dir, "project");
  const root = o.nested ? path.join(repoRoot, "nested") : repoRoot;
  await mkdir(root, { recursive: true });
  git(repoRoot, ["init", "-q", "-b", "main"], o.now);
  await put(root, ".gitignore", ".pandacorp/run/\n.pandacorp/inbox/\n.pandacorp/comms/\nnode_modules/\n");
  await put(root, ".pandacorp/status.yaml", statusYaml(o));
  await put(root, ".pandacorp/verify.sh", "#!/usr/bin/env bash\n# fixture gate stub: always green\nexit 0\n", 0o755);
  await put(root, "package.json", `${JSON.stringify({ name: "fixture", version: "0.0.0", private: true, type: "module", scripts: { test: "node --test" } }, null, 2)}\n`);
  await put(root, "README.md", "# fixture\n");
  for (const f of ["src/alpha/list.ts", "src/alpha/filter.ts", "src/beta/view.ts", "src/lib/auth/session.ts"]) await put(root, f, `// ${f} (fixture stub)\nexport const value = 1;\n`);
  for (const frd of FRDS) {
    const base = `docs/frds/${frd.id}`;
    await put(root, `${base}/frd.md`, frdFile(frd));
    await put(root, `${base}/blueprint.md`, blueprintFile(frd));
    for (const wo of frd.wos) await put(root, `${base}/work-orders/${wo.id.toLowerCase()}.md`, woFile(frd, wo));
  }
  await put(root, "docs/decision-log.md", "# Decision log\n");
  if (o.trackedHooksPath) { await put(root, ".githooks/pre-push", "#!/bin/sh\nexit 0\n", 0o755); }
  if (o.trackedDecisions) await put(root, ".pandacorp/inbox/decisions.md", "# Decisions (fixture, force-tracked)\n");
  git(root, ["add", "-A"], o.now);
  if (o.trackedDecisions) git(root, ["add", "-f", "--", ".pandacorp/inbox/decisions.md"], o.now);
  git(root, ["commit", "-q", "-m", "fixture: initial"], o.now);
  if (o.trackedHooksPath) git(root, ["config", "core.hooksPath", ".githooks"], o.now);
  if (o.card) for (const [slug, text] of Object.entries(CARDS)) await put(root, `.pandacorp/inbox/changes/${slug}.md`, text);
  let remote = null;
  if (o.launched) {
    remote = path.join(dir, "remote.git");
    git(dir, ["init", "-q", "--bare", "-b", "main", remote], o.now);
    git(root, ["remote", "add", "origin", remote], o.now);
    git(root, ["push", "-q", "origin", "main"], o.now);
  }
  const fx = {
    root, repoRoot, remote, dir, opts: o, sha: git(root, ["rev-parse", "HEAD"], o.now),
    git: (...args) => git(root, args, o.now),
    env: (extra = {}) => testEnv(dir, extra),
    cleanup: async () => { await rm(repoRoot, { recursive: true, force: true }); if (remote) await rm(remote, { recursive: true, force: true }); },
  };
  return fx;
}

/** Env object that points every engine test hook at throwaway paths under `dir` (the sandbox of one test). */
export function testEnv(dir, extra = {}) {
  return {
    PATH: process.env.PATH, HOME: path.join(dir, "home"), CODEX_HOME: path.join(dir, "codex-home"), PANDACORP_HOST_DIR: path.join(dir, "host"), PANDACORP_CAPACITY_DIR: path.join(dir, "host", "capacity"),
    PANDACORP_EVENTS_FILE: path.join(dir, "events.ndjson"), PANDACORP_CODEX_EVENTS_FILE: path.join(dir, "codex-events.ndjson"),
    PANDACORP_ORCHESTRATE_DIR: path.join(dir, "orchestrate"), PANDACORP_NOW: DEFAULT_NOW, PANDACORP_NOTIFY: "off",
    PANDACORP_CODEX_BIN: FAKE_CODEX_BIN, PANDACORP_FAKE_WORKER: FAKE_WORKER_BIN, PANDACORP_FAKE_WORKER_PLAN: path.join(dir, "fake-worker-plan.json"),
    PANDACORP_SIGNALS_FILE: path.join(dir, "signals.json"), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", ...extra,
  };
}

/** Writes the fake-worker plan file (unit id -> report object | mode string | {limit}|{hang}); returns its path. */
export async function writeWorkerPlan(file, plan) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(plan, null, 2)}\n`); return file; }

// ---------------------------------------------------------------------------------------------
// Codex rollout samples: <codexHome>/sessions/YYYY/MM/DD/rollout-<stamp>-<id>.jsonl (the engine reads the tail).
const epoch = (iso) => Math.floor(Date.parse(iso) / 1000);
const tokenCount = (ts, primary, secondary, extra = {}) => JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 } }, rate_limits: { primary, secondary, credits: null, plan_type: "plus", ...extra } } });
const win = (used, minutes, resetsIso) => ({ used_percent: used, window_minutes: minutes, resets_at: epoch(resetsIso) });
const noise = (ts) => [JSON.stringify({ timestamp: ts, type: "session_meta", payload: { id: "fixture-session", cwd: "/fixture" } }), JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "agent_message", message: "working" } })];

/** Expected quota.readCodexQuota() result per kind, for assertions: {used_percent, window_minutes, resets_at} or null (unknown). */
export const ROLLOUT_EXPECT = (now = DEFAULT_NOW) => {
  const t = Date.parse(now);
  const iso = (ms) => new Date(t + ms).toISOString();
  return { normal: { used_percent: 36, window_minutes: 300, resets_at: iso(2 * 3600e3) }, pct98: { used_percent: 98, window_minutes: 10080, resets_at: iso(26 * 3600e3) }, stale: null, malformed: null, rate_limit_reached: { used_percent: 100, window_minutes: 300, resets_at: iso(1 * 3600e3) } };
};

/**
 * Writes one rollout sample under codexHome and returns {file, kind, expect}.
 * normal: last token_count primary 36 % (300 min), secondary 12 % (10080) -> used 36.
 * pct98: primary 41, secondary 98 -> used 98 on the weekly window.  stale: a valid file dated 6 days
 * before `now` (the reader looks <= 3 days back) -> unknown.  malformed: truncated/garbage JSON lines and
 * no token_count -> unknown.  rate_limit_reached: primary 100 with rate_limit_reached_type "primary".
 */
export async function writeRolloutSample(codexHome, kind, { now = DEFAULT_NOW } = {}) {
  const t = Date.parse(now);
  const iso = (ms) => new Date(t + ms).toISOString();
  const ageDays = kind === "stale" ? 6 : 0;
  const stamp = new Date(t - ageDays * 86400e3 - 600e3);
  const dir = path.join(codexHome, "sessions", String(stamp.getUTCFullYear()), String(stamp.getUTCMonth() + 1).padStart(2, "0"), String(stamp.getUTCDate()).padStart(2, "0"));
  const ts = stamp.toISOString();
  const lines = noise(ts);
  if (kind === "normal" || kind === "stale") lines.push(tokenCount(new Date(stamp.getTime() - 1000).toISOString(), win(30, 300, iso(2 * 3600e3)), win(12, 10080, iso(5 * 86400e3))), tokenCount(ts, win(36, 300, iso(2 * 3600e3)), win(12, 10080, iso(5 * 86400e3))));
  else if (kind === "pct98") lines.push(tokenCount(ts, win(41, 300, iso(3 * 3600e3)), win(98, 10080, iso(26 * 3600e3))));
  else if (kind === "rate_limit_reached") lines.push(tokenCount(ts, win(100, 300, iso(1 * 3600e3)), win(40, 10080, iso(4 * 86400e3)), { rate_limit_reached_type: "primary" }));
  else if (kind === "malformed") lines.push('{"timestamp":"' + ts + '","type":"event_msg","payload":{"type":"token_count","rate_limits":{"primary":{"used_percent":', "not json at all", '{"type":"event_msg","payload":{"type":"token_count","rate_limits":"oops"}}');
  else throw new Error(`unknown rollout kind "${kind}"`);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `rollout-${ts.replace(/[:.]/g, "-")}-fixture${kind}.jsonl`);
  await writeFile(file, `${lines.join("\n")}\n`);
  await utimes(file, stamp, stamp);
  return { file, kind, expect: ROLLOUT_EXPECT(now)[kind] };
}

/** get_usage tool result samples (what the session reads before `quota record`): kinds ok | high | unavailable. */
export function usageSample(kind = "ok", { now = DEFAULT_NOW } = {}) {
  const t = Date.parse(now);
  const iso = (ms) => new Date(t + ms).toISOString();
  if (kind === "ok") return { five_hour: { utilization: 36, resets_at: iso(2 * 3600e3) }, seven_day: { utilization: 12, resets_at: iso(5 * 86400e3) } };
  if (kind === "high") return { five_hour: { utilization: 93, resets_at: iso(1.5 * 3600e3) }, seven_day: { utilization: 71, resets_at: iso(2 * 86400e3) } };
  if (kind === "unavailable") return { error: "usage unavailable" };
  throw new Error(`unknown usage kind "${kind}"`);
}

// ---------------------------------------------------------------------------------------------
// RAM signals: raw macOS command outputs. Expected readSignals() result (L, swapouts, swap_used_mb) in `expect`.
const PAGE = 16384;
const vmStat = (freeMb, inactiveMb, specMb, swapouts) => {
  const pg = (mb) => Math.round((mb * 1048576) / PAGE);
  return `Mach Virtual Memory Statistics: (page size of ${PAGE} bytes)\nPages free: ${pg(freeMb)}.\nPages active: ${pg(4000)}.\nPages inactive: ${pg(inactiveMb)}.\nPages speculative: ${pg(specMb)}.\nPages throttled: 0.\nPages wired down: ${pg(2500)}.\nPages purgeable: ${pg(300)}.\nPages stored in compressor: ${pg(1000)}.\nSwapouts: ${swapouts}.\n`;
};
const swap = (usedMb) => `vm.swapusage: total = 4096.00M  used = ${usedMb.toFixed(2)}M  free = ${(4096 - usedMb).toFixed(2)}M  (encrypted)\n`;
const SIGNALS = {
  clean: { sysctl_pressure: "1\n", vm_stat: vmStat(6000, 3000, 500, 100), swapusage: swap(0), expect: { L: 1, swapouts: 100, swap_used_mb: 0 } },
  warn: { sysctl_pressure: "2\n", vm_stat: vmStat(800, 600, 100, 100), swapusage: swap(300), expect: { L: 2, swapouts: 100, swap_used_mb: 300 } },
  critical: { sysctl_pressure: "4\n", vm_stat: vmStat(150, 100, 20, 9000), swapusage: swap(3500), expect: { L: 4, swapouts: 9000, swap_used_mb: 3500 } },
  swap_rising: { sysctl_pressure: "1\n", vm_stat: vmStat(5000, 2500, 400, 2600), swapusage: swap(1500), expect: { L: 1, swapouts: 2600, swap_used_mb: 1500 }, note: "pressure still 1 but swapouts grew by 2500 versus the clean sample: use clean then swap_rising as history" },
  garbled: { sysctl_pressure: "banana\n", vm_stat: "Mach Virtual Memory Statistics: ???\nPages free: lots.\n", swapusage: "vm.swapusage: total = ??", expect: null },
};
/** Returns {sysctl_pressure, vm_stat, swapusage, expect} for kind clean | warn | critical | swap_rising | garbled (expect null = SignalError). */
export function signalsSample(kind) { const s = SIGNALS[kind]; if (!s) throw new Error(`unknown signals kind "${kind}"`); return structuredClone(s); }
/** Writes the PANDACORP_SIGNALS_FILE JSON for `kind` (raw outputs only, no expect) and returns the path. */
export async function writeSignalsFile(file, kind) { const { sysctl_pressure, vm_stat, swapusage } = signalsSample(kind); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify({ sysctl_pressure, vm_stat, swapusage }, null, 2)}\n`); return file; }
/** Fake `exec(cmd, args)` for admission.readSignals({exec}): answers sysctl kern.memorystatus_vm_pressure_level, vm_stat and sysctl vm.swapusage from a sample. Returns stdout text. */
export function signalsExec(kindOrSample) {
  const s = typeof kindOrSample === "string" ? signalsSample(kindOrSample) : kindOrSample;
  return async (cmd, args = []) => {
    const line = [cmd, ...args].join(" ");
    if (/vm_stat/.test(line)) return s.vm_stat;
    if (/vm\.swapusage/.test(line)) return s.swapusage;
    if (/memorystatus_vm_pressure_level/.test(line)) return s.sysctl_pressure;
    throw new Error(`signalsExec: unexpected command ${line}`);
  };
}

/** argv for a job command fixture: exit0 (prints ok, exit 0), exit1 (prints boom on stderr, exit 1), hang (writes $FIXTURE_JOB_PIDFILE then sleeps until killed). */
export function jobCommand(kind) {
  if (!["exit0", "exit1", "hang"].includes(kind)) throw new Error(`unknown job kind "${kind}"`);
  return [process.execPath, path.join(FIXTURE_DIR, "job-command.mjs"), kind];
}

// ---------------------------------------------------------------------------------------------
async function selftest() {
  const results = []; let failed = 0;
  const check = async (name, fn) => { try { await fn(); results.push(`PASS  ${name}`); } catch (e) { failed++; results.push(`FAIL  ${name}: ${e.stack || e}`); } };
  const ok = (v, m) => { if (!v) throw new Error(m); };
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pc-fx-self-"));
  const sub = async (n) => { const d = path.join(tmp, n); await mkdir(d, { recursive: true }); return d; };
  const run = (cmd, args, env, cwd) => execFileSync(cmd, args, { cwd, env: { ...env }, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const homeBefore = existsSync(path.join(os.homedir(), ".codex")) ? (await stat(path.join(os.homedir(), ".codex"))).mtimeMs : null;
  try {
    await check("basic fixture is a clean repo with 2 FRDs, 4 WOs, 1 risk path", async () => {
      const fx = await createFixture("basic", { dir: await sub("a") });
      ok(fx.git("status", "--porcelain") === "", "tree not clean"); ok(fx.git("branch", "--show-current") === "main", "branch not main");
      const wos = (await Promise.all((await readdir(path.join(fx.root, "docs/frds"))).map((f) => readdir(path.join(fx.root, "docs/frds", f, "work-orders"))))).flat();
      ok(wos.length === 4, `expected 4 WOs, got ${wos.length}`); ok(/PLANNED/.test(await readFile(path.join(fx.root, "docs/frds/frd-02-beta/work-orders/wo-02-002.md"), "utf8")), "WO not PLANNED");
      ok(existsSync(path.join(fx.root, "src/lib/auth/session.ts")), "risk path missing"); ok(/## Build Plan/.test(await readFile(path.join(fx.root, "docs/frds/frd-01-alpha/blueprint.md"), "utf8")), "no Build Plan");
      ok(fx.git("check-ignore", ".pandacorp/inbox/changes/x.md") !== "", "inbox not ignored"); ok(!/^phase: release/m.test(await readFile(path.join(fx.root, ".pandacorp/status.yaml"), "utf8")), "basic is launched");
    });
    await check("fixtures are deterministic (same SHA across two builds)", async () => {
      const a = await createFixture("basic", { dir: await sub("d1") }); const b = await createFixture("basic", { dir: await sub("d2") });
      ok(a.sha === b.sha, `${a.sha} != ${b.sha}`);
    });
    await check("card preset has a feature and a bug card, gitignored", async () => {
      const fx = await createFixture("card", { dir: await sub("c") });
      const cards = await readdir(path.join(fx.root, ".pandacorp/inbox/changes")); ok(cards.sort().join() === "add-filter.md,fix-crash.md", cards.join());
      ok(fx.git("status", "--porcelain") === "", "cards leaked into git status");
    });
    await check("launched preset has a bare remote with main pushed", async () => {
      const fx = await createFixture("launched", { dir: await sub("l") });
      ok(fx.remote && existsSync(fx.remote), "no remote"); ok(git(fx.remote, ["rev-parse", "main"]) === fx.sha, "remote main != local main");
      ok(/^phase: release/m.test(await readFile(path.join(fx.root, ".pandacorp/status.yaml"), "utf8")), "status not release"); ok(fx.git("remote") === "origin", "no origin");
    });
    await check("tracked-decisions preset tracks .pandacorp/inbox/decisions.md", async () => {
      const fx = await createFixture("tracked-decisions", { dir: await sub("t") });
      ok(fx.git("ls-files", "--error-unmatch", ".pandacorp/inbox/decisions.md").length > 0, "decisions.md not tracked");
    });
    await check("trackedHooksPath option sets a tracked core.hooksPath", async () => {
      const fx = await createFixture({ preset: "basic", trackedHooksPath: true }, { dir: await sub("h") });
      ok(fx.git("config", "core.hooksPath") === ".githooks", "hooksPath not set"); ok(fx.git("ls-files", ".githooks/pre-push") !== "", "hook not tracked");
    });
    await check("rollout samples: shape, ages and malformed content", async () => {
      const home = await sub("codex");
      for (const k of ["normal", "pct98", "stale", "malformed", "rate_limit_reached"]) {
        const r = await writeRolloutSample(path.join(home, k), k); const text = await readFile(r.file, "utf8"); ok(text.endsWith("\n"), `${k} no trailing newline`);
        const lines = text.trim().split("\n"); const parsed = []; for (const l of lines) { try { parsed.push(JSON.parse(l)); } catch { /* malformed on purpose */ } }
        const counts = parsed.filter((e) => e.payload?.type === "token_count" && e.payload.rate_limits && typeof e.payload.rate_limits === "object" && e.payload.rate_limits.primary);
        if (k === "malformed") ok(counts.length === 0 && parsed.length < lines.length, "malformed sample parses as valid"); else ok(counts.length >= 1, `${k} has no token_count`);
        if (k === "pct98") ok(Math.max(counts.at(-1).payload.rate_limits.primary.used_percent, counts.at(-1).payload.rate_limits.secondary.used_percent) === 98, "pct98 wrong");
        if (k === "rate_limit_reached") ok(counts.at(-1).payload.rate_limits.rate_limit_reached_type === "primary", "reached type missing");
        if (k === "stale") ok(Date.parse(DEFAULT_NOW) - (await stat(r.file)).mtimeMs > 5 * 86400e3, "stale not old");
      }
    });
    await check("signals samples parse with real-text shapes; garbled has no expect", async () => {
      for (const k of ["clean", "warn", "critical", "swap_rising", "garbled"]) {
        const s = signalsSample(k); const exec = signalsExec(s);
        ok(/^\d|banana/.test(await exec("sysctl", ["-n", "kern.memorystatus_vm_pressure_level"])), `${k} pressure`);
        ok(/vm\.swapusage/.test(await exec("sysctl", ["vm.swapusage"])), `${k} swap`); ok(/Mach Virtual Memory/.test(await exec("vm_stat", [])), `${k} vm_stat`);
        ok(k === "garbled" ? s.expect === null : s.expect.L >= 1, `${k} expect`);
      }
      const f = await writeSignalsFile(path.join(tmp, "signals.json"), "warn"); ok(Object.keys(JSON.parse(await readFile(f, "utf8"))).join() === "sysctl_pressure,vm_stat,swapusage", "signals file keys");
      ok(usageSample("ok").five_hour.utilization === 36 && usageSample("unavailable").error, "usage samples");
    });
    await check("fake-worker: ok / red / doubt / limit / hang modes through the A17 plan", async () => {
      const d = await sub("w"); const fx = await createFixture("basic", { dir: d }); const env = fx.env();
      const plan = { "u-build-WO-01-001": "ok", "u-build-WO-01-002": "red", "u-build-WO-02-001": "doubt", "u-build-WO-02-002": { limit: "usage_limit" }, "u-hang": { hang: true }, "u-writes": { status: "done", summary: "wrote", _writes: { "src/new.ts": "export {};\n" } } };
      await writeWorkerPlan(env.PANDACORP_FAKE_WORKER_PLAN, plan);
      const call = (unit, extra = []) => run(process.execPath, [FAKE_WORKER_BIN, "run", "--direct", "--project", fx.root, "--id", `w-${unit}`, "--unit", unit, "--dir", fx.root, "--access", "sandbox", ...extra], env, fx.root);
      const payload = (out) => { const line = JSON.parse(out.trim().split("\n").at(-1)); ok(line.sum && typeof line.r === "string", "not a sealed line"); return JSON.parse(line.r); };
      const wdir = (u) => path.join(fx.root, ".pandacorp/run/codex-workers", `w-${u}`);
      const okP = payload(call("u-build-WO-01-001")); ok(okP.ok && okP.answer.status === "done" && okP.answer.unit === "u-build-WO-01-001" && okP.answer.authored_by && okP.answer.schema === 1, "ok report");
      for (const k of (await readFile(path.join(FIXTURE_DIR, "../../../runtime/build/schemas/report.schema.json"), "utf8").then((t) => JSON.parse(t).required))) ok(k in okP.answer, `report lacks ${k}`);
      ok(existsSync(path.join(wdir("u-build-WO-01-001"), "exit")) && JSON.parse(await readFile(path.join(wdir("u-build-WO-01-001"), "state.json"), "utf8")).pid > 0, "layout");
      ok(JSON.parse(await readFile(path.join(wdir("u-build-WO-01-001"), "last.md"), "utf8")).status === "done", "last.md");
      ok(payload(call("u-build-WO-01-002")).answer.verification[0].exit_code === 1, "red");
      const dp = payload(call("u-build-WO-02-001")); ok(dp.answer.status === "doubt" && dp.answer.doubt.options.length >= 2, "doubt");
      const lp = payload(call("u-build-WO-02-002")); ok(lp.ok === false && lp.kind === "limit" && /usage limit/i.test(await readFile(path.join(wdir("u-build-WO-02-002"), "codex.log"), "utf8")), "limit");
      ok((await readFile(path.join(wdir("u-build-WO-02-002"), "exit"), "utf8")).trim() === "1", "limit exit");
      payload(call("u-writes")); ok(existsSync(path.join(fx.root, "src/new.ts")), "_writes not applied");
      const again = payload(call("u-build-WO-01-001")); ok(again.ok, "idempotent rerun");
      const rd = run(process.execPath, [FAKE_WORKER_BIN, "read", "--project", fx.root, "--id", "w-u-build-WO-01-001"], env, fx.root); ok(payload(rd).ok, "read");
      const { spawn } = await import("node:child_process"); const child = spawn(process.execPath, [FAKE_WORKER_BIN, "run", "--project", fx.root, "--id", "w-u-hang", "--unit", "u-hang", "--dir", fx.root], { env, stdio: "ignore" });
      let tries = 0; while (!existsSync(path.join(wdir("u-hang"), "state.json")) && tries++ < 100) await new Promise((r) => setTimeout(r, 50));
      ok(existsSync(path.join(wdir("u-hang"), "state.json")) && !existsSync(path.join(wdir("u-hang"), "exit")), "hang wrote exit"); child.kill("SIGTERM");
      await new Promise((r) => child.once("exit", r));
    });
    await check("fake-codex: login, models, exec writes last.md and a rollout tail; limit mode", async () => {
      const d = await sub("x"); const env = testEnv(d, { PANDACORP_FAKE_CODEX_PCT: "64" });
      ok(/logged in/i.test(run(FAKE_CODEX_BIN, ["login", "status"], env, d)), "login");
      ok(JSON.parse(run(FAKE_CODEX_BIN, ["debug", "models"], env, d)).models.some((m) => m.slug === "gpt-6.1-sol"), "models");
      const lastMd = path.join(d, "last.md"); const out = execFileSync(FAKE_CODEX_BIN, ["exec", "--ignore-user-config", "--json", "-C", d, "-m", "gpt-6.1-sol", "-o", lastMd, "-"], { env, input: "do the task", cwd: d, encoding: "utf8" });
      ok(out.split("\n").filter(Boolean).every((l) => JSON.parse(l)), "events not jsonl"); ok(JSON.parse(await readFile(lastMd, "utf8")).status === "done", "last.md");
      const sess = path.join(env.CODEX_HOME, "sessions"); ok(existsSync(sess), "no rollout");
      const files = []; const walk = async (p) => { for (const e of await readdir(p, { withFileTypes: true })) e.isDirectory() ? await walk(path.join(p, e.name)) : files.push(path.join(p, e.name)); }; await walk(sess);
      ok(files.length === 1 && /"used_percent":64/.test(await readFile(files[0], "utf8")), "rollout pct");
      let code = 0; try { execFileSync(FAKE_CODEX_BIN, ["exec", "-o", lastMd, "-"], { env: { ...env, PANDACORP_FAKE_CODEX_MODE: "limit" }, input: "x", cwd: d, stdio: "pipe" }); } catch (e) { code = e.status; }
      ok(code === 1, `limit exit ${code}`);
    });
    await check("job commands: exit0 / exit1 / hang", async () => {
      const [c0, ...a0] = jobCommand("exit0"); ok(run(c0, a0, process.env, tmp).trim() === "ok", "exit0");
      const [c1, ...a1] = jobCommand("exit1"); let code = 0; try { run(c1, a1, process.env, tmp); } catch (e) { code = e.status; } ok(code === 1, "exit1");
      const { spawn } = await import("node:child_process"); const pf = path.join(tmp, "job.pid"); const [c2, ...a2] = jobCommand("hang");
      const child = spawn(c2, a2, { env: { ...process.env, FIXTURE_JOB_PIDFILE: pf }, stdio: "ignore" }); let n = 0; while (!existsSync(pf) && n++ < 100) await new Promise((r) => setTimeout(r, 50));
      ok(existsSync(pf), "hang pidfile"); child.kill("SIGKILL"); await new Promise((r) => child.once("exit", r));
    });
    await check("fixtures never touched the real ~/.codex", async () => {
      const after = existsSync(path.join(os.homedir(), ".codex")) ? (await stat(path.join(os.homedir(), ".codex"))).mtimeMs : null; ok(after === homeBefore, "~/.codex changed");
    });
    await check("cleanup removes the project", async () => { const fx = await createFixture("launched", { dir: await sub("z") }); await fx.cleanup(); ok(!existsSync(fx.root) && !existsSync(fx.remote), "left residue"); });
  } finally { await rm(tmp, { recursive: true, force: true }); }
  console.log(results.join("\n")); console.log(failed ? `\n${failed} FAILED` : `\nALL ${results.length} PASSED`);
  return failed ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(`--${n}`); const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (flag("selftest")) process.exit(await selftest());
  else if (flag("list")) console.log(PRESETS.join("\n"));
  else {
    const preset = argv.find((a) => !a.startsWith("--") && a !== val("dir"));
    if (!preset || !val("dir")) { console.error("usage: make-fixture.mjs <preset> --dir <abs dir> [--launched] [--card] [--tracked-decisions] [--nested] | --list | --selftest"); process.exit(2); }
    const fx = await createFixture({ preset, launched: flag("launched"), card: flag("card"), trackedDecisions: flag("tracked-decisions"), nested: flag("nested") }, { dir: val("dir") });
    console.log(JSON.stringify({ root: fx.root, remote: fx.remote, sha: fx.sha }));
  }
}
