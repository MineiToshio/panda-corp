#!/usr/bin/env node
// ADM: adaptive admission decisions, parsed real-shaped signals, single-use tokens and host heavy slots.
// The ladder evolves through recordReading (test-build-v2-perf.mjs); decide is pure and caps the current step
// by ready width, owner k and reactive quota. Critical pressure and unreadable signals keep 1+1 possible.
// RAM reservations estimate heavy jobs only. Tests isolate host state and permit process.kill only as a probe.
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(HERE, "..", "runtime", "build", "admission.mjs");
const FIX = await import(pathToFileURL(path.join(HERE, "fixtures", "build-v2", "make-fixture.mjs")).href);
const { signalsSample, signalsExec, writeSignalsFile, testEnv } = FIX;

let passed = 0; let failed = 0;
const stray = [];
process.on("unhandledRejection", (e) => { stray.push(e); console.error(`NOTE  unhandled rejection from a faked exec (the module did not await it): ${e && e.message}`); });
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (v, m) => { if (!v) throw new Error(m); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const near = (a, b, tol, m) => { if (typeof a !== "number" || Math.abs(a - b) > tol) throw new Error(`${m}: expected ~${b}, got ${a}`); };

let adm = null; let loadError = null;
try { adm = await import(pathToFileURL(MODULE).href); } catch (e) { loadError = e; }
const need = (name) => {
  if (loadError) throw new Error(`plugin/runtime/build/admission.mjs cannot be loaded: ${loadError.message}`);
  if (typeof adm[name] !== "function") throw new Error(`admission.mjs does not export function ${name}() (CLI doc 8.2)`);
  return adm[name];
};

const ENUM = ["ancho", "ram", "ram_reservada_H", "veto_presion", "veto_swap", "cpu_H", "techo", "owner_k", "reactivo_contencion", "reactivo_codex", "cupo_limite", "senal_fallida", "disco", "sin_token"];
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pc-adm-"));
let seq = 0;
const sandbox = async () => { const d = path.join(tmpRoot, `t${++seq}`); await mkdir(d, { recursive: true }); return d; };

// ---- never-kill guard: process.kill may only probe (signal 0) --------------------------------------------------
const realKill = process.kill; const badKills = [];
process.kill = (pid, sig) => { if (sig !== 0 && sig !== undefined) { badKills.push([pid, sig]); throw new Error(`process.kill(${pid}, ${sig}) called by the admission module`); } return realKill.call(process, pid, sig === undefined ? "SIGTERM" : sig); };

// ---- decide helpers ---------------------------------------------------------------------------------------------
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
const sig = (over = {}) => ({ L: 1, swapouts: 100, swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8, ...over });
const calm = (n = 3, swapouts = 100) => Array.from({ length: n }, () => ({ L: 1, swapouts, swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8 }));
const input = (over = {}) => ({ signals: sig(), history: calm(), reservations: [], live: { B: 0, H: 0 }, heavyQueued: false, readyWidth: 5, caps: { kOwner: 8, kReactive: 8 }, runtimeShape: "R-A", ...over });
const run = async (over) => { const decide = need("decide"); const r = await decide(deepFreeze(input(over))); ok(r && typeof r === "object", "decide returned no object"); ok(ENUM.includes(r.motivo_limite), `motivo_limite "${r.motivo_limite}" is not in the closed enum`); ok(r.grant === null || r.grant === "B" || r.grant === "H", `grant must be "B"|"H"|null, got ${JSON.stringify(r.grant)}`); return r; };

// =================================================== readSignals ==================================================
await test("readSignals clean: L=1, swapouts, swap used and available GiB from raw outputs", async () => {
  const readSignals = need("readSignals"); const s = signalsSample("clean");
  const r = await readSignals({ exec: signalsExec("clean") });
  eq(r.L, 1, "L"); eq(r.swapouts, s.expect.swapouts, "swapouts"); near(r.swap_used_mb, 0, 0.01, "swap_used_mb");
  near(r.A_gib, (6000 + 3000 + 500 + 300) / 1024, 0.03, "A_gib = free+inactive+speculative+purgeable");
  ok(Number.isFinite(r.A_cons_gib) && r.A_cons_gib <= r.A_gib + 1e-6, "A_cons_gib must be a finite number <= A_gib");
});
await test("readSignals warn / critical map levels 2 and 4 with their own counters", async () => {
  const readSignals = need("readSignals");
  const w = await readSignals({ exec: signalsExec("warn") }); eq(w.L, 2, "warn L"); near(w.swap_used_mb, 300, 0.01, "warn swap"); near(w.A_gib, (800 + 600 + 100 + 300) / 1024, 0.03, "warn A_gib");
  const c = await readSignals({ exec: signalsExec("critical") }); eq(c.L, 4, "critical L"); eq(c.swapouts, 9000, "critical swapouts"); near(c.swap_used_mb, 3500, 0.01, "critical swap"); near(c.A_gib, (150 + 100 + 20 + 300) / 1024, 0.03, "critical A_gib");
});
await test("readSignals swap_rising sample keeps L=1 but reports the larger swapouts counter", async () => {
  const r = await need("readSignals")({ exec: signalsExec("swap_rising") }); eq(r.L, 1, "L"); eq(r.swapouts, 2600, "swapouts"); near(r.swap_used_mb, 1500, 0.01, "swap used");
});
await test("readSignals garbled output fails loud with SignalError (never a default)", async () => {
  const readSignals = need("readSignals"); let threw = null; let value;
  try { value = await readSignals({ exec: signalsExec("garbled") }); } catch (e) { threw = e; }
  ok(threw, `garbled signals returned ${JSON.stringify(value)} instead of throwing`); eq(threw.name, "SignalError", "error name");
  const clean = signalsSample("clean");
  for (const field of ["sysctl_pressure", "vm_stat", "swapusage"]) {
    let t = null; try { await readSignals({ exec: signalsExec({ ...clean, [field]: signalsSample("garbled")[field] }) }); } catch (e) { t = e; }
    ok(t, `a garbled ${field} alone must fail loud`);
  }
  let t2 = null; try { await readSignals({ exec: signalsExec({ ...clean, sysctl_pressure: "9\n" }) }); } catch (e) { t2 = e; }
  ok(t2, "pressure level 9 is not a macOS level and must fail loud");
});
await test("readSignals does not use os.freemem and fails loud when the exec itself throws", async () => {
  const readSignals = need("readSignals"); let threw = false;
  try { await readSignals({ exec: async () => { throw new Error("sysctl: not found"); } }); } catch { threw = true; }
  ok(threw, "an exec failure must reject, not yield default numbers");
});
await test("readSignals {signalsFile} route reads the fixture's raw-output JSON (assumption 1)", async () => {
  const d = await sandbox(); const f = await writeSignalsFile(path.join(d, "signals.json"), "warn");
  const r = await need("readSignals")({ signalsFile: f }); eq(r.L, 2, "L from file"); near(r.swap_used_mb, 300, 0.01, "swap from file");
});

// Adaptive admission contract (ADM). Trend evolution is covered by test-build-v2-perf.mjs.
await test("default step 5 reaches five builders despite low available RAM or stable swap usage", async () => {
  for (const L of [1, 2, 3]) {
    const r = await run({ signals: sig({ L, A_gib: 0.1, swap_used_mb: 8000 }), live: { B: 4, H: 0 }, readyWidth: 10 });
    eq(r.grant, "B", "fifth builder"); eq(r.techo, 5, "default ceiling");
  }
  eq((await run({ live: { B: 5, H: 0 } })).grant, null, "sixth waits");
});
await test("ready width, explicit k and reactive quota each cap the current step", async () => {
  eq((await run({ readyWidth: 0, live: { B: 1, H: 0 } })).motivo_limite, "ancho", "ready width");
  const own = await run({ caps: { kOwner: 1 }, live: { B: 1, H: 0 } }); eq(own.grant, null, "owner cap"); eq(own.motivo_limite, "owner_k", "owner reason");
  const q = await run({ caps: { kReactive: 2, kReactiveReason: "reactivo_codex" }, live: { B: 2, H: 0 } }); eq(q.grant, null, "reactive cap"); eq(q.motivo_limite, "reactivo_codex", "reactive reason");
});
await test("a downshift never kills live workers; excess workers finish and a new worker waits", async () => {
  const r = await run({ step: 3, live: { B: 5, H: 1 } }); eq(r.grant, null, "wait for live workers"); eq(r.techo, 3, "lower ceiling"); eq(badKills.length, 0, "no signal");
  eq((await run({ step: 3, live: { B: 2, H: 0 } })).grant, "B", "one free slot");
});
await test("critical pressure always allows one builder and one heavy job, including with no RAM", async () => {
  const signals = sig({ L: 4, A_gib: 0.1 });
  eq((await run({ signals, live: { B: 0, H: 0 } })).grant, "B", "one builder");
  eq((await run({ signals, live: { B: 1, H: 0 } })).grant, null, "second builder waits");
  eq((await run({ signals, live: { B: 1, H: 0 }, heavyQueued: 1 })).grant, "H", "one heavy");
  eq((await run({ signals, live: { B: 1, H: 1 }, heavyQueued: 1 })).grant, null, "second heavy waits");
});
await test("unreadable signals stay at 1+1; k cannot lift safe mode", async () => {
  eq((await run({ signals: null })).grant, "B", "safe builder");
  const r = await run({ signals: null, live: { B: 1, H: 0 } }); eq(r.grant, null, "second waits"); eq(r.motivo_limite, "senal_fallida", "reason");
  eq((await run({ signals: null, live: { B: 1, H: 0 }, heavyQueued: 1 })).grant, "H", "safe heavy");
});
await test("reviewer sub-cap is 2 even when the adaptive step is 8", async () => {
  eq((await run({ step: 8, candidate: "reviewer", live: { B: 2, R: 2, H: 0 } })).grant, null, "third reviewer waits");
  eq((await run({ step: 8, candidate: "builder", live: { B: 2, R: 2, H: 0 } })).grant, "B", "builder can continue");
});
await test("heavy jobs use CPU cap but at most one at step 2 or lower; RAM estimates gate only the second heavy", async () => {
  for (const step of [1, 2]) eq((await run({ step, ncpu: 12, heavyQueued: 1, live: { B: 0, H: 1 }, want: "H" })).grant, null, "low step heavy cap");
  eq((await run({ step: 3, ncpu: 12, heavyQueued: 1, live: { B: 0, H: 1 }, want: "H" })).grant, "H", "second heavy with RAM");
  const low = { signals: sig({ A_gib: 1 }), heavyQueued: 1, live: { B: 1, H: 1 } };
  eq((await run({ ...low, want: "H" })).grant, null, "second heavy without estimated RAM");
  eq((await run({ ...low, want: "B", reservations: [{ pending_gib: 100 }] })).grant, "B", "builder ignores RAM reservations");
});
await test("decide is pure, deterministic and exposes no token", async () => {
  const a = await run({}), b = await run({}); eq(JSON.stringify(a), JSON.stringify(b), "deterministic"); ok(!JSON.stringify(a).includes("token"), "no token");
});

// ================================================= module-level guards =============================================
await test("the module exports no kill/terminate function (BL-0223: nothing is ever killed)", async () => {
  if (loadError) throw new Error(`module not loadable: ${loadError.message}`);
  const bad = Object.keys(adm).filter((k) => /kill|terminate|evict/i.test(k)); eq(bad.length, 0, `kill-like exports: ${bad.join(",")}`);
});

// ====================================================== tokens =====================================================
const tokenOpts = async () => { const d = await sandbox(); const buildDir = path.join(d, "build"); await mkdir(buildDir, { recursive: true }); const file = path.join(buildDir, "admission.json"); return { file, admissionFile: file, dir: buildDir, buildDir }; };
const raw = (t) => (typeof t === "string" ? t : t?.token);
const accepted = async (fn) => { try { const v = await fn(); if (v && typeof v === "object" && "ok" in v) return v.ok === true; return !!v; } catch { return false; } };
const sha = (s) => createHash("sha256").update(s).digest("hex");

await test("tokens: issued per unit, random and distinct, verified, rejected when wrong", async () => {
  const issue = need("issueToken"); const verify = need("verifyToken"); const o = await tokenOpts();
  const t1 = raw(await issue("u-build-WO-01-001", "B", o)); const t2 = raw(await issue("u-build-WO-02-001", "B", o)); const t3 = raw(await issue("u-build-WO-01-002", "B", { ...o }));
  ok(typeof t1 === "string" && t1.length >= 32, "token must be a string of at least 32 chars"); ok(t1 !== t2 && t2 !== t3 && t1 !== t3, "tokens must differ");
  ok(await accepted(() => verify("u-build-WO-01-001", t1, o)), "the issued token must verify for its unit");
  ok(!(await accepted(() => verify("u-build-WO-01-001", "not-the-token", o))), "a wrong token must be rejected");
  ok(!(await accepted(() => verify("u-build-WO-01-001", t2, o))), "another unit's token must be rejected");
  ok(!(await accepted(() => verify("u-never-issued", t1, o))), "an unissued unit must be rejected without crashing");
  ok(!(await accepted(() => verify("u-build-WO-01-001", "", o))), "an empty token must be rejected");
});
await test("tokens: single use, a released token never verifies again and release is idempotent", async () => {
  const issue = need("issueToken"); const verify = need("verifyToken"); const release = need("releaseToken"); const o = await tokenOpts();
  const t = raw(await issue("u-build-WO-01-001", "B", o)); ok(await accepted(() => verify("u-build-WO-01-001", t, o)), "verifies before release");
  await release("u-build-WO-01-001", o); ok(!(await accepted(() => verify("u-build-WO-01-001", t, o))), "released token must not verify (a unit lands once)");
  await release("u-build-WO-01-001", o); await release("u-unknown", o);
  const t2 = raw(await issue("u-build-WO-01-001", "B", o)); ok(t2 !== t, "a reissue produces a fresh token"); ok(!(await accepted(() => verify("u-build-WO-01-001", t, o))), "the old token stays dead after reissue");
  ok(await accepted(() => verify("u-build-WO-01-001", t2, o)), "the new token verifies");
});
await test("tokens: admission.json keys by sha256 and never stores the raw token (assumption 3 path)", async () => {
  const issue = need("issueToken"); const o = await tokenOpts(); const t = raw(await issue("u-build-WO-01-001", "B", o));
  let text = null; try { text = await readFile(o.file, "utf8"); } catch { /* handled below */ }
  ok(text !== null, `admission.json was not written at ${o.file}`);
  ok(!text.includes(t), "the raw token is stored in admission.json"); const j = JSON.parse(text);
  ok(j.tokens && j.tokens[sha(t)], "tokens must be keyed by sha256(token)"); eq(j.tokens[sha(t)].unit, "u-build-WO-01-001", "entry.unit"); eq(j.tokens[sha(t)].class, "B", "entry.class");
});
await test("tokens: class H tokens are issued too and unit identity is part of the check", async () => {
  const issue = need("issueToken"); const verify = need("verifyToken"); const o = await tokenOpts();
  const t = raw(await issue("u-g2-frd-01", "H", o)); ok(await accepted(() => verify("u-g2-frd-01", t, o)), "H token verifies");
  ok(!(await accepted(() => verify("u-g2-frd-02", t, o))), "token is bound to its unit");
});

// ===================================================== host slots =================================================
const hostFn = () => { for (const n of ["hostSlotMax", "hMax", "hostMax", "maxHostSlots", "hostSlotLimit", "H_max"]) if (typeof adm?.[n] === "function") return adm[n]; throw new Error("admission.mjs exports no H_max function (looked for hostSlotMax|hMax|hostMax|maxHostSlots|hostSlotLimit|H_max); assumption 4"); };
const hmax = (n) => { const f = hostFn(); const a = f(n); return typeof a === "number" ? a : f({ ncpu: n }); };
await test("H_max = max(1, min(2, floor(ncpu/4))) for 1, 2, 3, 4, 7, 8, 12, 16, 64 cpus", async () => {
  if (loadError) throw new Error(`module not loadable: ${loadError.message}`);
  const exp = new Map([[1, 1], [2, 1], [3, 1], [4, 1], [7, 1], [8, 2], [9, 2], [12, 2], [16, 2], [64, 2]]);
  for (const [n, e] of exp) eq(hmax(n), e, `H_max(ncpu=${n})`);
});
const slotsOf = async (host) => { try { return (await readdir(path.join(host, "h-slots"))).filter((n) => /^slot-\d+$/.test(n)).sort(); } catch { return []; } };
const acquireOpts = (host, extra = {}) => ({ host, max: 2, kind: "g2", project: "/tmp/proj", ...extra });
const full = async (acq) => { try { const r = await acq(); return !r || r.slot === null || r.slot === undefined; } catch { return true; } };

await test("acquireHostSlot: mkdir in index order under <host>/h-slots, owner.json {pid,kind,project,at}", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host");
  const a = await acq(acquireOpts(host)); ok(a && a.slot !== null && a.slot !== undefined, "first acquire returned no slot");
  eq((await slotsOf(host)).join(","), "slot-0", "first slot is slot-0");
  const oj = JSON.parse(await readFile(path.join(host, "h-slots", "slot-0", "owner.json"), "utf8"));
  eq(oj.pid, process.pid, "owner.pid"); eq(oj.kind, "g2", "owner.kind"); eq(oj.project, "/tmp/proj", "owner.project"); ok(typeof oj.at === "string" && !Number.isNaN(Date.parse(oj.at)), "owner.at must be an ISO instant");
  eq(Object.keys(oj).sort().join(","), "at,kind,pid,project", "owner.json has exactly the A1 keys");
  const b = await acq(acquireOpts(host, { kind: "merge-queue" })); ok(b && b.slot !== null, "second acquire"); eq((await slotsOf(host)).join(","), "slot-0,slot-1", "second slot is slot-1");
  eq(JSON.parse(await readFile(path.join(host, "h-slots", "slot-1", "owner.json"), "utf8")).kind, "merge-queue", "kind merge-queue accepted");
  await a.release(); await b.release();
});
await test("acquireHostSlot: respects max, then a release frees exactly that slot (rm -rf by owner)", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host");
  const a = await acq(acquireOpts(host)); const b = await acq(acquireOpts(host)); ok(a && b, "two slots acquired");
  ok(await full(() => acq(acquireOpts(host))), "a third acquire with max 2 must not get a slot");
  eq((await slotsOf(host)).length, 2, "no extra slot directory is left behind by the refused acquire");
  await a.release(); eq((await slotsOf(host)).join(","), "slot-1", "release removes only its own slot dir");
  const c = await acq(acquireOpts(host)); ok(c && c.slot !== null, "freed slot is acquirable"); eq((await slotsOf(host)).join(","), "slot-0,slot-1", "re-acquire takes the lowest free index (slot-0)");
  await c.release(); await b.release(); eq((await slotsOf(host)).length, 0, "all slots released");
  await a.release();
});
await test("acquireHostSlot: max 1 (cpu < 8) holds a single slot", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host"); const a = await acq(acquireOpts(host, { max: 1 }));
  ok(a && a.slot !== null, "first"); ok(await full(() => acq(acquireOpts(host, { max: 1 }))), "second must be refused at max 1"); await a.release();
});
await test("acquireHostSlot: reclaims a slot whose owner pid is dead (kill -0 fails)", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host"); const slot0 = path.join(host, "h-slots", "slot-0"); await mkdir(slot0, { recursive: true });
  const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }); const deadPid = Number(dead.stdout);
  let alive = true; try { realKill.call(process, deadPid, 0); } catch { alive = false; } ok(!alive, "test setup: the helper pid must be dead");
  await writeFile(path.join(slot0, "owner.json"), JSON.stringify({ pid: deadPid, kind: "g2", project: "/gone", at: "2026-11-10T00:00:00.000Z" }));
  const a = await acq(acquireOpts(host, { max: 1 })); ok(a && a.slot !== null, "a dead-owner slot must be reclaimed");
  eq(JSON.parse(await readFile(path.join(slot0, "owner.json"), "utf8")).pid, process.pid, "the new owner replaced the dead one"); await a.release();
});
await test("acquireHostSlot: a live owner's slot is never reclaimed", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host"); const slot0 = path.join(host, "h-slots", "slot-0"); await mkdir(slot0, { recursive: true });
  await writeFile(path.join(slot0, "owner.json"), JSON.stringify({ pid: process.ppid, kind: "merge-queue", project: "/live", at: "2026-11-10T00:00:00.000Z" }));
  ok(await full(() => acq(acquireOpts(host, { max: 1 }))), "slot held by a live pid must stay held");
  eq(JSON.parse(await readFile(path.join(slot0, "owner.json"), "utf8")).project, "/live", "the live owner's file is untouched");
  const two = await acq(acquireOpts(host, { max: 2 })); ok(two && two.slot !== null, "with max 2 the free slot-1 is used"); ok((await slotsOf(host)).includes("slot-1"), "slot-1 created"); await two.release();
});
await test("acquireHostSlot: no owner.json + mtime older than 60 s is reclaimed; a fresh one is not", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host"); const slot0 = path.join(host, "h-slots", "slot-0"); await mkdir(slot0, { recursive: true });
  ok(await full(() => acq(acquireOpts(host, { max: 1 }))), "a just-created slot without owner.json is mid-acquire by someone else: keep");
  const old = new Date(Date.now() - 120_000); await utimes(slot0, old, old);
  const a = await acq(acquireOpts(host, { max: 1 })); ok(a && a.slot !== null, "an owner-less slot older than 60 s is reclaimed"); ok((await stat(path.join(slot0, "owner.json"))).isFile(), "owner.json written by the new owner"); await a.release();
});
await test("acquireHostSlot: directory defaults to $PANDACORP_HOST_DIR (env hook)", async () => {
  const acq = need("acquireHostSlot"); const d = await sandbox(); const env = testEnv(d); const prev = process.env.PANDACORP_HOST_DIR; process.env.PANDACORP_HOST_DIR = env.PANDACORP_HOST_DIR;
  try {
    const a = await acq({ max: 1, kind: "g2", project: "/tmp/proj" }); ok(a && a.slot !== null, "acquire without dir");
    eq((await slotsOf(env.PANDACORP_HOST_DIR)).join(","), "slot-0", "slot created under $PANDACORP_HOST_DIR/h-slots"); await a.release();
  } finally { if (prev === undefined) delete process.env.PANDACORP_HOST_DIR; else process.env.PANDACORP_HOST_DIR = prev; }
});
await test("acquireHostSlot: concurrent acquirers never share a slot", async () => {
  const acq = need("acquireHostSlot"); const host = path.join(await sandbox(), "host");
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => acq(acquireOpts(host, { max: 2 }))));
  const got = results.filter((r) => r.status === "fulfilled" && r.value && r.value.slot !== null && r.value.slot !== undefined).map((r) => r.value);
  eq(got.length, 2, "exactly max slots granted"); eq((await slotsOf(host)).length, 2, "two slot dirs"); for (const g of got) await g.release();
});
await test("the whole run never signalled a process (only kill -0 probes)", async () => { eq(badKills.length, 0, `real signals sent: ${JSON.stringify(badKills)}`); });

process.kill = realKill;
await rm(tmpRoot, { recursive: true, force: true });
if (stray.length) { failed++; console.error(`FAIL  ${stray.length} unhandled rejection(s): the module must await/handle the (async) injected exec`); }
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
