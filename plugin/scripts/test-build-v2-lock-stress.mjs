#!/usr/bin/env node
// Stress test of the two cross-process locks the build engine reclaims from dead holders: build-state's lease-mutation
// mutex (`withFence`) and the journal append lock (`appendChainedJsonl`). Several processes race for the lock while
// "planters" keep installing locks owned by a dead pid (a holder killed with kill -9), so 2-3 reclaimers routinely judge
// the same dead instance at once. Asserted:
//   - never two holders: an O_EXCL probe file inside the mutex never already exists; the journal chain stays gap-free
//     and holds exactly the records the appenders reported written;
//   - a finished holder's lock never reappears at the lock path (a hand-back of a released lock), which would stall
//     every caller until the staleness bound.
// Guaranteed MIN_ROUNDS rounds per sub-test (hard cap 120 s), plus extra rounds within a time budget (default 11 s; PANDACORP_LOCK_STRESS_BUDGET_MS). PANDACORP_LOCK_STRESS_PLUGIN points the
// processes at another plugin root (e.g. an older revision, to show the test catches its races);
// PANDACORP_LOCK_STRESS_WORKERS / _ITERS / _PLANTERS size each round.
import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, unlinkSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const PLUGIN = path.resolve(process.env.PANDACORP_LOCK_STRESS_PLUGIN || path.join(path.dirname(SELF), ".."));
const BUILD_STATE = pathToFileURL(path.join(PLUGIN, "runtime", "build-state.mjs")).href;
const FSX = pathToFileURL(path.join(PLUGIN, "runtime", "build", "fsx.mjs")).href;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------- child roles
async function mutexWorker([project, token, epoch, iters]) {
  const m = await import(BUILD_STATE);
  const crit = path.join(project, "crit");
  const lock = path.join(project, ".pandacorp", "run", "lease-mutation.lock");
  const mine = () => { try { return Number.parseInt(String(JSON.parse(readFileSync(path.join(lock, "owner.json"), "utf8")).owner).split("-")[0], 10) === process.pid; } catch { return false; } };
  const r = { ok: 0, viol: 0, cont: 0, reappear: 0 };
  for (let i = 0; i < Number(iters); i++) {
    try {
      await m.withFence(project, token, Number(epoch), async () => {
        let fd;
        try { fd = openSync(crit, "wx"); } catch { r.viol++; return; }
        await sleep(1 + Math.random() * 3);
        closeSync(fd); unlinkSync(crit);
      });
      r.ok++;
    } catch (error) { if (error.code === "CONTENDED") r.cont++; else throw error; }
    if (mine()) r.reappear++;
    await sleep(Math.random() * 3);
    if (mine()) r.reappear++;
  }
  await sleep(30);
  if (mine()) r.reappear++;
  return r;
}

async function journalWorker([file, iters]) {
  const { appendChainedJsonl } = await import(FSX);
  const lock = `${file}.lock`;
  const mine = () => { try { return readFileSync(path.join(lock, "owner"), "utf8").startsWith(`${process.pid}-`); } catch { return false; } };
  const r = { ok: 0, cont: 0, reappear: 0 };
  for (let i = 0; i < Number(iters); i++) {
    try {
      await appendChainedJsonl(file, ({ seq, prev }) => ({ seq, prev, pid: process.pid, i }));
      r.ok++;
    } catch (error) { if (error.code === "CONTENDED") r.cont++; else throw error; }
    if (mine()) r.reappear++;
    await sleep(Math.random() * 3);
    if (mine()) r.reappear++;
  }
  await sleep(30);
  if (mine()) r.reappear++;
  return r;
}

// Installs, whenever the lock is free, a lock owned by a dead pid: the state a kill -9 inside the lock leaves.
async function planter([lock, ownerName, deadPid, iters]) {
  let planted = 0;
  for (let i = 0; i < Number(iters); i++) {
    const fresh = `${lock}.plant-${process.pid}-${i}`;
    await mkdir(fresh);
    const owner = `${deadPid}-plant${process.pid}x${i}`;
    await writeFile(path.join(fresh, ownerName), ownerName === "owner" ? owner : JSON.stringify({ owner, acquired_at: new Date().toISOString() }));
    try { await rename(fresh, lock); planted++; } catch { await rm(fresh, { recursive: true, force: true }); }
    await sleep(1 + Math.random() * 2);
  }
  return { planted };
}

const ROLES = { mutex: mutexWorker, journal: journalWorker, planter };
if (process.argv[2] === "--role") {
  const out = await ROLES[process.argv[3]](process.argv.slice(4));
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------- harness
let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.stack || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const child = (role, args) => new Promise((resolve, reject) => {
  const c = spawn(process.execPath, [SELF, "--role", role, ...args.map(String)], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; let errText = "";
  c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { errText += d; });
  c.on("close", (code) => { if (code !== 0) reject(new Error(`${role} exited ${code}: ${errText.trim().slice(0, 400)}`)); else resolve(JSON.parse(out.trim().split("\n").pop())); });
});
// A pid that is certainly dead: a child that already exited.
const deadPid = () => new Promise((resolve) => { const c = spawn(process.execPath, ["-e", ""], { stdio: "ignore" }); c.on("close", () => resolve(c.pid)); });

const budgetMs = Number(process.env.PANDACORP_LOCK_STRESS_BUDGET_MS) > 0 ? Number(process.env.PANDACORP_LOCK_STRESS_BUDGET_MS) : 11_000;
const knob = (name, dflt) => (Number(process.env[name]) > 0 ? Number(process.env[name]) : dflt);
// Per round: MW lock users x MI iterations against MP dead-holder planters (16/30/4 reliably exposes the pre-FIX-R3 ABA).
const MW = knob("PANDACORP_LOCK_STRESS_WORKERS", 16); const MI = knob("PANDACORP_LOCK_STRESS_ITERS", 30); const MP = knob("PANDACORP_LOCK_STRESS_PLANTERS", 4);
const roots = [];
const base = await mkdtemp(path.join(os.tmpdir(), "pc-lock-stress-"));
roots.push(base);
const started = Date.now();
// The budget only bounds EXTRA rounds: every sub-test first completes MIN_ROUNDS rounds whatever the wall clock (a loaded
// machine must not turn "slow" into "did not run"); only the hard cap fails loud, when even the minimum cannot finish.
const MIN_ROUNDS = knob("PANDACORP_LOCK_STRESS_MIN_ROUNDS", 1);
const hardCapMs = knob("PANDACORP_LOCK_STRESS_HARD_CAP_MS", 120_000);
const keepGoing = (testStart, share, total) => {
  const rounds = total.planted > 0 && total.ok > 0 ? total.rounds : Math.min(total.rounds, MIN_ROUNDS - 1);
  const elapsed = Date.now() - testStart;
  if (elapsed >= hardCapMs) return false;
  return rounds < MIN_ROUNDS || Date.now() - started < budgetMs * share;
};

await test("lease-mutation mutex: dead holders + racing reclaimers never give two holders, never resurrect a released lock", async () => {
  const { acquire } = await import(BUILD_STATE);
  const total = { ok: 0, viol: 0, cont: 0, reappear: 0, planted: 0, rounds: 0 };
  const testStart = Date.now();
  while (keepGoing(testStart, 0.55, total)) {
    const project = path.join(base, `m-${total.rounds}`);
    await mkdir(path.join(project, ".pandacorp", "run"), { recursive: true });
    await writeFile(path.join(project, ".pandacorp", "status.yaml"), "phase: implementation\nrunning: false\n");
    const lease = await acquire(project, { runtime: "codex", runId: `stress-${total.rounds}`, ttlSeconds: 3600, coordinator: "session", projectStatus: false });
    const lock = path.join(project, ".pandacorp", "run", "lease-mutation.lock");
    const dead = await deadPid();
    const outs = await Promise.all([
      ...Array.from({ length: MW }, () => child("mutex", [project, lease.token, lease.epoch, MI])),
      ...Array.from({ length: MP }, () => child("planter", [lock, "owner.json", dead, 250])),
    ]);
    for (const o of outs) for (const k of Object.keys(o)) total[k] += o[k];
    total.rounds++;
    if (total.viol || total.reappear) break;
  }
  console.log(`      mutex: ${JSON.stringify(total)}`);
  ok(total.rounds >= MIN_ROUNDS && total.planted > 0 && total.ok > 0, "the stress did not run (fewer than the minimum rounds within the hard cap, no round, no planted dead lock or no successful fence)");
  ok(total.viol === 0, `two processes were inside the mutex at once ${total.viol} time(s)`);
  ok(total.reappear === 0, `a released mutex reappeared at the lock path ${total.reappear} time(s)`);
});

await test("journal append lock: dead holders + racing reclaimers keep the chain gap-free and never resurrect a released lock", async () => {
  const { readChainedJsonl } = await import(FSX);
  const total = { ok: 0, cont: 0, reappear: 0, planted: 0, rounds: 0, records: 0 };
  let chainError = null;
  const testStart = Date.now();
  while (keepGoing(testStart, 1, total)) {
    const dir = path.join(base, `j-${total.rounds}`);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "journal.jsonl");
    const dead = await deadPid();
    const outs = await Promise.all([
      ...Array.from({ length: MW }, () => child("journal", [file, MI])),
      ...Array.from({ length: MP }, () => child("planter", [`${file}.lock`, "owner", dead, 250])),
    ]);
    let ok1 = 0;
    for (const o of outs) { for (const k of Object.keys(o)) if (k in total) total[k] += o[k]; ok1 += o.ok ?? 0; }
    total.rounds++;
    try {
      const { records } = await readChainedJsonl(file);
      total.records += records.length;
      if (records.length !== ok1) chainError = `round ${total.rounds}: ${records.length} records for ${ok1} reported appends`;
    } catch (error) { chainError = `round ${total.rounds}: ${error.code}: ${error.message}`; }
    if (chainError || total.reappear) break;
  }
  console.log(`      journal: ${JSON.stringify(total)}`);
  ok(total.rounds >= MIN_ROUNDS && total.planted > 0 && total.ok > 0, "the stress did not run (fewer than the minimum rounds within the hard cap)");
  ok(!chainError, `two appenders held the journal lock at once: ${chainError}`);
  ok(total.reappear === 0, `a released journal lock reappeared at the lock path ${total.reappear} time(s)`);
});

await test("lock litter is bounded: no private temp dir of a live acquirer survives a round", async () => {
  const leftovers = [];
  for (const d of await readdir(base)) {
    const dir = d.startsWith("m-") ? path.join(base, d, ".pandacorp", "run") : path.join(base, d);
    for (const n of await readdir(dir).catch(() => [])) if (/\.lock\.new-/.test(n)) leftovers.push(path.join(d, n));
  }
  ok(leftovers.length === 0, `acquirers left private lock dirs behind: ${leftovers.slice(0, 5).join(", ")}`);
});

for (const r of roots) await rm(r, { recursive: true, force: true }).catch(() => {});
console.log(`\n${passed} passed, ${failed} failed (${Math.round((Date.now() - started) / 100) / 10} s, plugin ${PLUGIN})`);
process.exit(failed ? 1 : 0);
