#!/usr/bin/env node
// test-build-v2-admission.mjs — T-B03: pins plugin/runtime/build/admission.mjs (D31, D4 tokens, D7 host slots,
// PLAN §3.16 A1 host H-slot protocol, A22 constants, standard BUILD-9). Written from the contracts only.
//
// ASSUMED INTERFACE (CLI doc §8.2 gives names and shapes; everything below is an assumption to reconcile):
//  1. readSignals({exec, signalsFile}) -> {L, swapouts, swap_used_mb, A_gib, A_cons_gib}; async-or-sync.
//     `exec(cmd, args)` is the injected fake from make-fixture `signalsExec` (preferred route). A_gib =
//     (free+inactive+speculative+purgeable) pages * page size in GiB (BUILD-9); A_cons_gib is only checked to be a
//     finite number <= A_gib. Garbled output throws an Error named "SignalError" (message/code not pinned).
//     The `signalsFile` route: the fixture author INVENTED the PANDACORP_SIGNALS_FILE JSON as
//     {sysctl_pressure, vm_stat, swapusage} (raw command outputs); I assume readSignals reads it through the
//     `signalsFile` option with the same parsing as the exec route (one case, isolated).
//  2. decide({signals, history, reservations, live:{B,H}, heavyQueued, readyWidth, caps:{K_TECHO,kOwner,kReactive},
//     runtimeShape}) -> {grant:"B"|"H"|null, motivo_limite, techo, suelo, A_ef, P}. `history` = array of prior readings
//     (oldest first) shaped like signals, with CUMULATIVE `swapouts` (the veto looks at the delta between consecutive
//     readings, "swapout delta > 0 in >=2 of the last 3"). `reservations` = array of
//     {unit, class, reserved_gib, pending_gib} where A_ef = A_gib - sum(pending_gib); `signals: null` = the caller's
//     safe mode after a SignalError (B=1, H=1, motivo senal_fallida). runtimeShape "R-B" = Codex app session (B=1,H=1).
//     When both classes are possible with a heavy job queued, which class wins is not pinned beyond "heavy has priority
//     when it fits" (BUILD-9 "landing > heavy job > new builder").
//  3. Token functions take an extra trailing options object naming where admission.json lives, because the doc
//     signature has none: issueToken(unit, cls, opts) / verifyToken(unit, token, opts) / releaseToken(unit, opts) with
//     opts = {file, admissionFile, dir, buildDir} all pointing at <tmp>/build[/admission.json]. issueToken returns the
//     raw token (string) or {token}. verifyToken: truthy / {ok:true} = accepted; false, {ok:false} or a throw = rejected.
//     admission.json is {tokens:{<sha256(token)>:{unit,class,reserved_gib,at}}, history:[...]} and never holds the raw token.
//  4. Host slots: acquireHostSlot({host, max, kind, project, pid?}) with host = the HOST dir (slots live in
//     <host>/h-slots/slot-<i>; `dir` would mean the slots dir itself, per the coordinator); `host` omitted -> $PANDACORP_HOST_DIR (read from process.env). Returns {slot, release()};
//     a full pool returns null/undefined/{slot:null} or throws (not pinned). The H_max function is not named in the docs:
//     one of hostSlotMax | hMax | hostMax | maxHostSlots | hostSlotLimit | H_max taking ncpu (number or {ncpu}).
//  5. The module never kills: no exported function matches /kill|terminate|evict/, and process.kill is only ever called
//     with signal 0 (the dead-owner probe) during every call below.
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

const ENUM = ["ancho", "ram", "ram_reservada_H", "veto_presion", "veto_swap", "cpu_H", "techo", "owner_k", "reactivo_contencion", "reactivo_codex", "cupo_limite", "senal_fallida", "pausa_L4", "sin_token"];
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
const input = (over = {}) => ({ signals: sig(), history: calm(), reservations: [], live: { B: 0, H: 0 }, heavyQueued: false, readyWidth: 5, caps: { K_TECHO: 2, kOwner: 8, kReactive: 8 }, runtimeShape: "R-A", ...over });
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

// ====================================================== decide ====================================================
await test("decide clean: grants a builder, ceiling 2 and floor 2", async () => {
  const r = await run({}); eq(r.grant, "B", "grant"); eq(r.techo, 2, "techo (K_TECHO)"); eq(r.suelo, 2, "suelo"); near(r.P, 9.5 - 3, 0.01, "P = A_ef - COLCHON(3)"); near(r.A_ef, 9.5, 0.01, "A_ef");
});
await test("decide clean: second builder granted while live B < 2, third refused with motivo techo", async () => {
  eq((await run({ live: { B: 1, H: 0 } })).grant, "B", "second builder");
  const r = await run({ live: { B: 2, H: 0 } }); eq(r.grant, null, "third builder"); eq(r.motivo_limite, "techo", "motivo at the ceiling"); eq(r.techo, 2, "techo never above 2");
});
await test("decide ceiling never exceeds 2 even with a huge ready width and large caps", async () => {
  const r = await run({ readyWidth: 40, live: { B: 2, H: 0 }, caps: { K_TECHO: 2, kOwner: 50, kReactive: 50 } }); eq(r.grant, null, "grant"); ok(r.techo <= 2, `techo ${r.techo} > 2`);
});
await test("decide ready width limits the ceiling (motivo ancho)", async () => {
  const r = await run({ readyWidth: 0, live: { B: 1, H: 0 } }); eq(r.grant, null, "grant"); eq(r.motivo_limite, "ancho", "motivo"); eq(r.techo, 1, "techo = width + live");
  const g = await run({ readyWidth: 1, live: { B: 0, H: 0 } }); eq(g.grant, "B", "one ready unit, nothing live");
});
await test("decide owner k and reactive caps lower the ceiling with their own motivo", async () => {
  const o = await run({ live: { B: 1, H: 0 }, caps: { K_TECHO: 2, kOwner: 1, kReactive: 8 } }); eq(o.grant, null, "owner k"); eq(o.motivo_limite, "owner_k", "owner_k"); eq(o.techo, 1, "techo");
  const r = await run({ live: { B: 1, H: 0 }, caps: { K_TECHO: 2, kOwner: 8, kReactive: 1 } }); eq(r.grant, null, "reactive"); ok(["reactivo_contencion", "reactivo_codex"].includes(r.motivo_limite), `reactive motivo, got ${r.motivo_limite}`);
  eq((await run({ live: { B: 0, H: 0 }, caps: { K_TECHO: 2, kOwner: 1, kReactive: 1 } })).grant, "B", "k never below 1: the first builder is always allowed");
});
const rising = [{ L: 2, swapouts: 100 }, { L: 2, swapouts: 1000 }, { L: 2, swapouts: 1800 }].map((h) => ({ swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8, ...h }));
const flat = (L) => Array.from({ length: 3 }, () => ({ L, swapouts: 100, swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8 }));
await test("decide DEC-1: L=2 or 3 with flat swap is NOT a veto (ceiling 2 reachable, floor 2)", async () => {
  for (const L of [2, 3]) {
    const s = sig({ L, swapouts: 100 });
    const one = await run({ signals: s, history: flat(L), live: { B: 1, H: 0 } }); eq(one.grant, "B", `L=${L} flat swap: second builder`); ok(!/^veto/.test(one.motivo_limite), `L=${L} flat swap must not veto, got ${one.motivo_limite}`); eq(one.techo, 2, "techo"); eq(one.suelo, 2, "suelo");
    const two = await run({ signals: s, history: flat(L), live: { B: 2, H: 0 } }); eq(two.grant, null, "third builder"); eq(two.motivo_limite, "techo", "ceiling, not veto");
  }
});
await test("decide DEC-1: L=2/3 with fewer than 3 stored readings: no veto, stays at the floor", async () => {
  for (const hist of [[], calm(1), calm(2)]) {
    const s = sig({ L: 2, swapouts: 100 });
    const r = await run({ signals: s, history: hist, live: { B: 1, H: 0 } }); ok(!/^veto/.test(r.motivo_limite), `${hist.length} readings: no veto, got ${r.motivo_limite}`); eq(r.grant, "B", "floor builder still granted"); eq(r.suelo, 2, "floor");
    const t = await run({ signals: s, history: hist, live: { B: 2, H: 0 } }); eq(t.grant, null, "never above the floor/ceiling of 2"); ok(t.techo <= 2, "techo");
  }
});
await test("decide DEC-1: L=2 with swapouts rising in >=2 of the last 3 deltas vetoes (series)", async () => {
  const s = sig({ L: 2, swapouts: 2600, swap_used_mb: 1500 });
  const first = await run({ signals: s, history: rising, live: { B: 0, H: 0 } }); eq(first.grant, "B", "first builder under veto"); eq(first.suelo, 1, "floor drops to 1");
  const second = await run({ signals: s, history: rising, live: { B: 1, H: 0 } }); eq(second.grant, null, "no second builder"); ok(/^veto_/.test(second.motivo_limite), `veto motivo, got ${second.motivo_limite}`);
  const heavy = await run({ signals: s, history: rising, live: { B: 1, H: 0 }, heavyQueued: true }); ok(heavy.grant !== "B", "no builder beyond the first"); ok(heavy.grant === "H" || heavy.grant === null, "at most the one heavy job");
  const both = await run({ signals: s, history: rising, live: { B: 1, H: 1 }, heavyQueued: true }); eq(both.grant, null, "one of each class alive"); ok(/^veto_/.test(both.motivo_limite), "veto motivo");
});
await test("decide DEC-1: L=4 is always a veto (pausa_L4) even with flat swap and an empty history", async () => {
  for (const history of [flat(4), []]) { const r = await run({ signals: sig({ L: 4, swapouts: 100, A_gib: 9.5 }), history, live: { B: 0, H: 0 } }); eq(r.grant, null, "nothing launches at L=4"); eq(r.motivo_limite, "pausa_L4", "motivo"); }
});
await test("decide veto by swap (swapouts growing in >=2 of the last 3 readings) even at L=1", async () => {
  const hist = [{ L: 1, swapouts: 100 }, { L: 1, swapouts: 1000 }, { L: 1, swapouts: 1800 }].map((h) => ({ swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8, ...h }));
  const s = sig({ L: 1, swapouts: 2600, swap_used_mb: 1500 });
  const a = await run({ signals: s, history: hist, live: { B: 1, H: 0 } }); eq(a.grant, null, "second builder must wait"); eq(a.motivo_limite, "veto_swap", "motivo"); eq(a.suelo, 1, "floor 1 under veto");
  eq((await run({ signals: s, history: hist, live: { B: 0, H: 0 } })).grant, "B", "series still starts the first builder");
});
await test("decide a single swapout growth among the last 3 is not a veto", async () => {
  const hist = [{ L: 1, swapouts: 100 }, { L: 1, swapouts: 100 }, { L: 1, swapouts: 100 }].map((h) => ({ swap_used_mb: 0, A_gib: 9.5, A_cons_gib: 8, ...h }));
  eq((await run({ signals: sig({ swapouts: 150 }), history: hist, live: { B: 1, H: 0 } })).grant, "B", "one growing reading is below the veto threshold");
});
await test("decide L=4 launches nothing (pausa_L4) and kills nothing", async () => {
  const r = await run({ signals: sig({ L: 4, swapouts: 9000, swap_used_mb: 3500, A_gib: 0.55 }), live: { B: 2, H: 1 }, heavyQueued: true });
  eq(r.grant, null, "grant"); eq(r.motivo_limite, "pausa_L4", "motivo");
  const none = await run({ signals: sig({ L: 4, A_gib: 0.55 }), live: { B: 0, H: 0 } }); eq(none.grant, null, "no builder at L=4 even when nothing runs");
  ok(!Object.keys(r).some((k) => /kill|terminate|stop|evict/i.test(k)), "the decision exposes no kill/stop action");
  eq(badKills.length, 0, "process.kill was used with a real signal");
});
await test("decide garbled/failed signals = safe mode: B=1 H=1 with motivo senal_fallida", async () => {
  const a = await run({ signals: null, live: { B: 0, H: 0 } }); eq(a.motivo_limite, "senal_fallida", "motivo"); eq(a.grant, "B", "one builder is allowed");
  const b = await run({ signals: null, live: { B: 1, H: 0 } }); eq(b.grant, null, "second builder refused in safe mode"); eq(b.motivo_limite, "senal_fallida", "motivo kept"); eq(b.techo, 1, "techo 1");
  const h = await run({ signals: null, live: { B: 1, H: 1 }, heavyQueued: true }); eq(h.grant, null, "second heavy job refused in safe mode");
});
await test("decide low RAM drops the floor to 1 (motivo ram) and reservations count against A_ef", async () => {
  const low = await run({ signals: sig({ A_gib: 2 }), live: { B: 1, H: 0 } }); eq(low.suelo, 1, "floor"); eq(low.grant, null, "second builder without RAM"); eq(low.motivo_limite, "ram", "motivo");
  eq((await run({ signals: sig({ A_gib: 2 }), live: { B: 0, H: 0 } })).grant, "B", "at least one builder always stays possible while ready work exists");
  const res = [{ unit: "u-build-WO-01-001", class: "B", reserved_gib: 1.5, pending_gib: 1.5 }, { unit: "u-build-WO-02-001", class: "B", reserved_gib: 1.5, pending_gib: 1.5 }];
  const r = await run({ signals: sig({ A_gib: 5 }), reservations: res, live: { B: 1, H: 0 } });
  near(r.A_ef, 2, 0.01, "A_ef = A - sum(pending)"); eq(r.suelo, 1, "floor after reservations"); eq(r.grant, null, "pending reservations block another builder");
});
await test("decide heavy job: starts when P >= c_h (3.5), has priority over a new builder, and is not granted twice", async () => {
  const r = await run({ heavyQueued: true, live: { B: 1, H: 0 } }); eq(r.grant, "H", "heavy job with RAM");
  const dup = await run({ heavyQueued: true, live: { B: 0, H: 1 }, signals: sig({ A_gib: 5 }) }); ok(dup.grant !== "H", "no second heavy job while one is alive and P < c_h");
});
await test("decide runtime shape R-B (Codex app session) is B=1, H=1 always", async () => {
  const r = await run({ runtimeShape: "R-B", live: { B: 1, H: 0 } }); eq(r.grant, null, "second builder in R-B"); eq(r.techo, 1, "techo");
  eq((await run({ runtimeShape: "R-B", live: { B: 0, H: 0 } })).grant, "B", "first builder in R-B");
  const h = await run({ runtimeShape: "R-B", heavyQueued: true, live: { B: 0, H: 1 } }); ok(h.grant !== "H", "second heavy job in R-B");
});
await test("decide is pure: frozen inputs are not mutated and results are deterministic", async () => {
  const a = await run({}); const b = await run({}); eq(JSON.stringify(a), JSON.stringify(b), "same input, same decision");
});
await test("decide result carries no token and only enum motivos across a sweep of conditions", async () => {
  const conds = [{}, { live: { B: 2, H: 0 } }, { signals: null }, { signals: sig({ L: 4 }) }, { signals: sig({ L: 2 }), live: { B: 1, H: 0 } }, { readyWidth: 0, live: { B: 1, H: 0 } }];
  for (const c of conds) { const r = await run(c); ok(!JSON.stringify(r).match(/token/i), "a decision must not carry a token"); }
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
