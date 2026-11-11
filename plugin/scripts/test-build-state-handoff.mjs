#!/usr/bin/env node
// test-build-state-handoff.mjs - T-B07: the engine v2 primitives of the lease library
// (plugin/runtime/build-state.mjs + plugin/scripts/pandacorp-build-state.mjs): `transfer`, `forceRelease`,
// `transitionWorkOrderAt`, the `projectStatus:false` option and the optional lease `coordinator`.
// Contracts: PLAN 3.16 A5 and A10, RESOLUTIONS D3 and D4, plugin/docs/build-engine-cli.md (2.3, 9),
// plugin/runtime/build-state-contract.md ("Same-run transfer and engine v2 primitives"), enforcement-policy.json.
// Run: node plugin/scripts/test-build-state-handoff.mjs   (offline, no sleeps beyond one 250 ms worker-survival check)
//
// ASSUMED INTERFACE (the orchestrator reconciles test and module afterwards):
//  1. Module `../runtime/build-state.mjs` exports (documented): transfer(project, {token, toRuntime, coordinator, epoch?}) -> {epoch, token};
//     forceRelease(project, {ownerConfirmed: true}); transitionWorkOrderAt(root, {file, to, reason}); acquire/renew/quiesce accept
//     `projectStatus:false`. The test imports the module as a namespace so a missing export fails one case with a clear message.
//  2. Option placement (the docs only say "an option on acquire/quiesce/renew"): acquire(project, {runtime, runId, ttlSeconds, coordinator?, projectStatus?}),
//     renew(project, token, epoch, {projectStatus}), quiesce(project, token, epoch, {projectStatus}); finalizeRelease(project, token, epoch) unchanged.
//  3. `transitionWorkOrderAt` `file` is relative to `root` (as the v1 `transitionWorkOrder` file argument is relative to the project).
//  4. Errors carry `.code`: FENCE (wrong token/epoch/run/no lease on transfer), CONTENDED (forceRelease on a lease that is not reclaimable),
//     USAGE (forceRelease without ownerConfirmed:true; invalid toRuntime/coordinator values), INVALID_PATH (WO symlink escape, as in v1).
//  5. `acquire` with projectStatus:false writes `.pandacorp/run/build/lease-token.json` ({epoch, token}, mode 0600); `transfer` rewrites it
//     (also when the original acquire was a v1 one with no token file); `finalizeRelease` and `forceRelease` remove it only while it still
//     holds the released epoch. A plain v1 `acquire` writes no token file and no `coordinator` key.
//  6. `.pandacorp/run/lease-epoch` is a decimal integer (possibly with a newline); `.pandacorp/run/build.lease/lease.json` is the lease with
//     `run_id, epoch, runtime, coordinator?, ttl_seconds, renewed_at, token_hash, quiesced_at?`; `.pandacorp/run/build/state.json` is only
//     read for its `run_id` (transfer compares it with the lease when the file exists).
//  7. WO transitions in a status.yaml keep the fixture key family `work_orders_*`; "all frd-01 WOs VERIFIED" shows as 2 in
//     `work_orders_done` OR `work_orders_verified`; `updated_at` is rewritten.
//  8. CLI (documented): `transfer --project P --token T [--epoch E] --to-runtime claude|codex --coordinator session|drive` and
//     `force-release --project P --owner-confirmed`; one JSON object on stdout, success exit 0 with an `epoch` key for transfer, stale fence or
//     contention exit 2, malformed invocation exit 3 (contract "CLI exit codes").
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAKE_WORKER_BIN, createFixture, testEnv, writeWorkerPlan } from "./fixtures/build-v2/make-fixture.mjs";

const S = await import("../runtime/build-state.mjs");
const { acquire, assertFence, currentLease, finalizeRelease, isFresh, isReclaimable, quiesce, release, renew, reserveDispatch, syncRollups, transitionWorkOrder, withFence } = S;
const buildStateCli = fileURLToPath(new URL("./pandacorp-build-state.mjs", import.meta.url));
const pluginRoot = fileURLToPath(new URL("..", import.meta.url));

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const need = (name) => { if (typeof S[name] !== "function") throw new Error(`build-state.mjs does not export ${name}() (row B07 not implemented or renamed)`); return S[name]; };
const rejects = async (fn, codes, what = "call") => {
  const wanted = Array.isArray(codes) ? codes : [codes];
  let error = null;
  try { await fn(); } catch (e) { error = e; }
  if (!error) throw new Error(`${what}: expected ${wanted.join("|")} but it resolved`);
  if (!wanted.includes(error.code)) throw new Error(`${what}: expected ${wanted.join("|")} but got ${error.code ?? "no code"}: ${error.message}`);
};
const rejectsAny = async (fn, what) => { let threw = false; try { await fn(); } catch { threw = true; } if (!threw) throw new Error(`${what}: expected a rejection but it resolved`); };

const roots = [];
const mk = async (prefix = "pc-handoff-") => { const d = await mkdtemp(path.join(os.tmpdir(), prefix)); roots.push(d); return d; };
const STATUS = 'phase: implementation\nrunning: false\nsupervisor_heartbeat: ""\nupdated_at: "2026-01-01T00:00:00.000Z"\n';
const fixture = async () => { const root = await mk(); await mkdir(path.join(root, ".pandacorp", "run"), { recursive: true }); await writeFile(path.join(root, ".pandacorp", "status.yaml"), STATUS); return root; };

const leaseFile = (p) => path.join(p, ".pandacorp/run/build.lease/lease.json");
const epochFile = (p) => path.join(p, ".pandacorp/run/lease-epoch");
const tokenFile = (p) => path.join(p, ".pandacorp/run/build/lease-token.json");
const stateFile = (p) => path.join(p, ".pandacorp/run/build/state.json");
const mutexDir = (p) => path.join(p, ".pandacorp/run/lease-mutation.lock");
const statusOf = (p) => readFile(path.join(p, ".pandacorp/status.yaml"), "utf8");
const rawLease = async (p) => JSON.parse(await readFile(leaseFile(p), "utf8"));
const epochOnDisk = async (p) => Number((await readFile(epochFile(p), "utf8")).match(/\d+/)[0]);
const tokenOnDisk = async (p) => JSON.parse(await readFile(tokenFile(p), "utf8"));
const backdate = async (p, ms) => { const l = await rawLease(p); l.renewed_at = new Date(Date.now() - ms).toISOString(); await writeFile(leaseFile(p), `${JSON.stringify(l)}\n`); };
const writeRunState = async (p, runId) => { await mkdir(path.dirname(stateFile(p)), { recursive: true }); await writeFile(stateFile(p), `${JSON.stringify({ run_id: runId })}\n`); };
const MIN = 60_000;
const cli = (...args) => { const r = spawnSync(process.execPath, [buildStateCli, ...args], { encoding: "utf8" }); return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" }; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const waitFor = async (cond, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { if (await cond()) return; await new Promise((r) => setTimeout(r, 25)); } throw new Error(`timeout waiting for ${what}`); };
const A = { runtime: "claude", runId: "run-a", ttlSeconds: 1800 };

// ------------------------------------------------------------------ module surface
await test("the v2 primitives are exported", async () => { for (const name of ["transfer", "forceRelease", "transitionWorkOrderAt"]) need(name); });

// ------------------------------------------------------------------ v1 behavior unchanged
await test("v1 unchanged: a plain acquire/renew/release has no coordinator, no token file and still projects status.yaml", async () => {
  const p = await fixture(); const l = await acquire(p, { runtime: "claude", runId: "v1-run", ttlSeconds: 30 });
  ok(l.epoch === 1 && typeof l.token === "string" && l.token.length >= 32, "acquire receipt changed");
  const lease = await rawLease(p); ok(lease.ttl_seconds === 30 && !("coordinator" in lease) && !("quiesced_at" in lease), `v1 lease shape changed: ${JSON.stringify(lease)}`);
  ok(!existsSync(tokenFile(p)), "a v1 acquire wrote a lease-token.json");
  let status = await statusOf(p);
  for (const re of [/^running: true$/m, /^build_run_id: "v1-run"$/m, /^build_runtime: "claude"$/m, /^build_lease_epoch: 1$/m]) ok(re.test(status), `v1 acquire did not project ${re}`);
  const r = await renew(p, l.token, l.epoch); ok(r.renewed_at >= l.renewed_at && /^supervisor_heartbeat: ["']?\d{4}-/m.test(await statusOf(p)), "v1 renew no longer projects the heartbeat");
  await release(p, l.token, l.epoch); status = await statusOf(p);
  ok(/^running: false$/m.test(status) && !(await currentLease(p)), "v1 release changed");
  ok((await epochOnDisk(p)) === 1, "epoch file lost on release");
});
await test("v1 unchanged: two-phase quiesce/finalize still projects and fences, then the epoch keeps growing", async () => {
  const p = await fixture(); const l = await acquire(p, { runtime: "codex", runId: "v1-two-phase", ttlSeconds: 30 });
  await quiesce(p, l.token, l.epoch); ok(/^running: false$/m.test(await statusOf(p)), "v1 quiesce no longer projects running:false");
  await rejects(() => renew(p, l.token, l.epoch), "QUIESCED", "renew after quiesce");
  await finalizeRelease(p, l.token, l.epoch); ok(!(await currentLease(p)), "finalize kept the lease");
  const n = await acquire(p, { runtime: "codex", runId: "v1-two-phase-2", ttlSeconds: 30 }); ok(n.epoch === 2, `epoch not monotonic after release: ${n.epoch}`);
});

// ------------------------------------------------------------------ projectStatus:false + coordinator + token file
await test("projectStatus:false on acquire/renew/quiesce never touches status.yaml (and leaves no rollback copy); token file mirrors the credential", async () => {
  const p = await fixture(); const before = await statusOf(p); const dirBefore = (await readdir(path.join(p, ".pandacorp"))).sort();
  const l = await acquire(p, { ...A, coordinator: "session", projectStatus: false });
  ok(await statusOf(p) === before, "acquire with projectStatus:false wrote status.yaml");
  const lease = await rawLease(p); ok(lease.coordinator === "session" && lease.ttl_seconds === 1800 && lease.run_id === "run-a", `lease shape: ${JSON.stringify(lease)}`);
  ok(!JSON.stringify(lease).includes(l.token) && /token_hash/.test(JSON.stringify(lease)), "raw token leaked into lease.json");
  ok((await currentLease(p)).coordinator === "session" && !(await currentLease(p)).token, "currentLease must expose coordinator and never the token");
  ok(((await stat(tokenFile(p))).mode & 0o777) === 0o600, "lease-token.json is not mode 0600");
  const tf = await tokenOnDisk(p); ok(tf.token === l.token && tf.epoch === l.epoch && Object.keys(tf).sort().join() === "epoch,token", `token file content ${JSON.stringify(Object.keys(tf))}`);
  await renew(p, l.token, l.epoch, { projectStatus: false }); ok(await statusOf(p) === before, "renew with projectStatus:false wrote status.yaml");
  await quiesce(p, l.token, l.epoch, { projectStatus: false }); ok(await statusOf(p) === before, "quiesce with projectStatus:false wrote status.yaml");
  ok(existsSync(tokenFile(p)), "quiesce must keep the token file (the lease still fences)");
  await finalizeRelease(p, l.token, l.epoch); ok(await statusOf(p) === before, "finalizeRelease after a projectStatus:false run wrote status.yaml");
  ok(!existsSync(tokenFile(p)), "finalizeRelease left the token file of the released epoch");
  ok((await readdir(path.join(p, ".pandacorp"))).sort().join() === dirBefore.join(), `stray entries under .pandacorp: ${(await readdir(path.join(p, ".pandacorp"))).join()}`);
  ok(!existsSync(mutexDir(p)), "mutex left behind");
});
await test("acquire rejects an unknown coordinator and accepts session and drive", async () => {
  const p = await fixture(); await rejects(() => acquire(p, { ...A, coordinator: "robot", projectStatus: false }), "USAGE", "acquire coordinator robot");
  ok(!(await currentLease(p)), "a rejected acquire left a lease");
  const l = await acquire(p, { ...A, coordinator: "drive", projectStatus: false }); ok((await rawLease(p)).coordinator === "drive", "drive coordinator not stored"); ok(l.epoch === 1, "epoch");
});

// ------------------------------------------------------------------ transfer
await test("transfer on a fresh lease: same run_id, epoch+1, new token, ttl 1800, no quiesce, no status write, ledger floors survive", async () => {
  const transfer = need("transfer");
  const p = await fixture(); const before = await statusOf(p);
  const l = await acquire(p, { ...A, ttlSeconds: 30, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a");
  await reserveDispatch(p, l.token, l.epoch, { id: "d1", units: 2, limit: 10 });
  const proof = (await tokenOnDisk(p)).token; ok(proof === l.token, "the token file must hold the acquire token");
  const t = await transfer(p, { token: proof, toRuntime: "codex", coordinator: "drive" });
  ok(t.epoch === l.epoch + 1, `epoch ${t.epoch} != ${l.epoch + 1}`); ok(typeof t.token === "string" && t.token.length >= 32 && t.token !== l.token, "no new token returned");
  const lease = await rawLease(p);
  ok(lease.run_id === "run-a" && lease.epoch === t.epoch && lease.runtime === "codex" && lease.coordinator === "drive", `lease after transfer: ${JSON.stringify(lease)}`);
  ok(lease.ttl_seconds === 1800, `ttl_seconds ${lease.ttl_seconds} != 1800`); ok(!("quiesced_at" in lease), "transfer wrote quiesced_at (it must not quiesce)");
  ok(Date.now() - Date.parse(lease.renewed_at) < MIN, "renewed_at is not now"); ok(isFresh(await currentLease(p)), "lease not fresh after transfer");
  ok(!JSON.stringify(lease).includes(t.token) && !JSON.stringify(lease).includes(l.token), "a raw token is in lease.json");
  ok((await epochOnDisk(p)) === t.epoch, "lease-epoch file not bumped");
  const tf = await tokenOnDisk(p); ok(tf.epoch === t.epoch && tf.token === t.token, "lease-token.json not rewritten with the new epoch and token"); ok(((await stat(tokenFile(p))).mode & 0o777) === 0o600, "token file mode");
  ok(await statusOf(p) === before, "transfer wrote status.yaml"); ok(!existsSync(mutexDir(p)), "transfer left the mutex");
  const next = await reserveDispatch(p, t.token, t.epoch, { id: "d2", units: 1, limit: 10 }); ok(next.spend_units === 3 && next.epoch === t.epoch, `ledger floors reset across transfer: ${JSON.stringify(next)}`);
  const r = await renew(p, t.token, t.epoch, { projectStatus: false }); ok(r.epoch === t.epoch, "the new holder cannot renew");
});
await test("transfer writes the token file and never projects status.yaml even for a lease acquired the v1 way", async () => {
  const transfer = need("transfer"); const p = await fixture();
  const l = await acquire(p, { runtime: "claude", runId: "v1-origin", ttlSeconds: 30 }); const projected = await statusOf(p); ok(/^build_lease_epoch: 1$/m.test(projected), "fixture: v1 projection missing");
  const t = await transfer(p, { token: l.token, toRuntime: "codex", coordinator: "drive" });
  ok(await statusOf(p) === projected, "transfer re-projected status.yaml (build_lease_epoch must stay the old value, nothing is written)");
  const tf = await tokenOnDisk(p); ok(tf.epoch === t.epoch && tf.token === t.token, "token file missing or stale after transfer");
  const lease = await rawLease(p); ok(lease.runtime === "codex" && lease.coordinator === "drive" && lease.ttl_seconds === 1800, `lease: ${JSON.stringify(lease)}`);
});
await test("the previous holder is fenced at its next mutating command (module and CLI) and can only observe", async () => {
  const transfer = need("transfer"); const p = await fixture();
  const old = await acquire(p, { ...A, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a");
  const t = await transfer(p, { token: old.token, toRuntime: "codex", coordinator: "drive" });
  const zombie = path.join(p, "zombie.txt"); const snapshot = await readFile(leaseFile(p), "utf8");
  await rejects(() => renew(p, old.token, old.epoch, { projectStatus: false }), "FENCE", "old renew");
  await rejects(() => reserveDispatch(p, old.token, old.epoch, { id: "z", units: 1, limit: 9 }), "FENCE", "old reserveDispatch");
  await rejects(() => syncRollups(p, old.token, old.epoch), "FENCE", "old syncRollups");
  await rejects(() => quiesce(p, old.token, old.epoch, { projectStatus: false }), "FENCE", "old quiesce");
  await rejects(() => finalizeRelease(p, old.token, old.epoch), "FENCE", "old finalizeRelease");
  await rejects(() => release(p, old.token, old.epoch), "FENCE", "old release");
  await rejects(() => assertFence(p, old.token, old.epoch), "FENCE", "old assertFence");
  await rejects(() => withFence(p, old.token, old.epoch, async () => writeFile(zombie, "bad")), "FENCE", "old withFence");
  await rejects(() => assertFence(p, old.token, t.epoch), "FENCE", "old token with the new epoch");
  await rejects(() => assertFence(p, t.token, old.epoch), "FENCE", "new token with the old epoch");
  ok(!existsSync(zombie), "the fenced writer still ran its body"); ok(await readFile(leaseFile(p), "utf8") === snapshot, "a fenced call altered the lease");
  const seen = await currentLease(p); ok(seen && seen.epoch === t.epoch && seen.coordinator === "drive", "the loser cannot observe the lease");
  const r = cli("quiesce", "--project", p, "--token", old.token, "--epoch", String(old.epoch));
  ok(r.status === 2, `CLI exit for a fenced loser: ${r.status} (documented stale fence = 2) ${r.stderr}`);
  ok(await readFile(leaseFile(p), "utf8") === snapshot, "the CLI loser altered the lease");
  await assertFence(p, t.token, t.epoch);
});
await test("transfer works on an expired (stale) lease and re-freshens it; the winner keeps the run", async () => {
  const transfer = need("transfer");
  for (const [label, age] of [["past ttl, inside the grace window", 40 * MIN], ["past the grace window (reclaimable)", 120 * MIN]]) {
    const p = await fixture(); const l = await acquire(p, { ...A, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a"); await backdate(p, age);
    ok(!isFresh(await currentLease(p)), `${label}: fixture lease still fresh`);
    const t = await transfer(p, { token: l.token, toRuntime: "codex", coordinator: "drive" });
    ok(t.epoch === l.epoch + 1, `${label}: epoch`); ok(isFresh(await currentLease(p)) && (await rawLease(p)).run_id === "run-a", `${label}: lease not fresh or run changed`);
    await rejects(() => renew(p, l.token, l.epoch, { projectStatus: false }), "FENCE", `${label}: stale holder`);
  }
});
await test("transfer refuses: wrong token, wrong epoch, no lease, another run_id, bad runtime, bad coordinator, replayed token; nothing is changed", async () => {
  const transfer = need("transfer"); const p = await fixture();
  await rejects(() => transfer(p, { token: "x".repeat(40), toRuntime: "codex", coordinator: "drive" }), "FENCE", "no lease");
  const l = await acquire(p, { ...A, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a");
  const snap = async () => `${await readFile(leaseFile(p), "utf8")}|${await readFile(tokenFile(p), "utf8")}|${await epochOnDisk(p)}`; const base = await snap();
  await rejects(() => transfer(p, { token: "not-the-token-0123456789abcdef0123456789", toRuntime: "codex", coordinator: "drive" }), "FENCE", "wrong token");
  await rejects(() => transfer(p, { token: l.token, epoch: l.epoch + 5, toRuntime: "codex", coordinator: "drive" }), "FENCE", "wrong epoch");
  await writeRunState(p, "another-run"); await rejects(() => transfer(p, { token: l.token, toRuntime: "codex", coordinator: "drive" }), "FENCE", "state.json run_id differs from the lease");
  await writeRunState(p, "run-a");
  await rejects(() => transfer(p, { token: l.token, toRuntime: "gemini", coordinator: "drive" }), "USAGE", "toRuntime gemini");
  await rejects(() => transfer(p, { token: l.token, toRuntime: "codex", coordinator: "robot" }), "USAGE", "coordinator robot");
  ok(await snap() === base, "a refused transfer changed lease, token file or epoch"); ok(!existsSync(mutexDir(p)), "mutex left behind after refusals");
  const t = await transfer(p, { token: l.token, epoch: l.epoch, toRuntime: "codex", coordinator: "drive" }); ok(t.epoch === l.epoch + 1, "a matching epoch must be accepted");
  await rejects(() => transfer(p, { token: l.token, toRuntime: "claude", coordinator: "session" }), "FENCE", "replay of the transferred-away token");
  await rm(stateFile(p)); const t2 = await transfer(p, { token: t.token, toRuntime: "claude", coordinator: "session" }); ok(t2.epoch === t.epoch + 1, "without state.json the transfer must proceed on the lease alone");
});
await test("two transfers with the same credential race: exactly one winner, epoch advances once", async () => {
  const transfer = need("transfer"); const p = await fixture(); const l = await acquire(p, { ...A, projectStatus: false }); await writeRunState(p, "run-a");
  const settled = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => transfer(p, { token: l.token, toRuntime: i % 2 ? "codex" : "claude", coordinator: i % 2 ? "drive" : "session" })));
  const won = settled.filter((s) => s.status === "fulfilled"); ok(won.length === 1, `winners: ${won.length}`);
  for (const s of settled.filter((x) => x.status === "rejected")) ok(["FENCE", "CONTENDED"].includes(s.reason.code), `loser error ${s.reason.code}: ${s.reason.message}`);
  ok((await rawLease(p)).epoch === l.epoch + 1 && (await epochOnDisk(p)) === l.epoch + 1, "epoch advanced more than once"); ok((await tokenOnDisk(p)).token === won[0].value.token, "token file does not belong to the winner");
});
await test("a transfer chain session -> drive -> session keeps bumping the epoch and fencing every earlier holder", async () => {
  const transfer = need("transfer"); const p = await fixture(); const a = await acquire(p, { ...A, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a");
  const b = await transfer(p, { token: a.token, toRuntime: "codex", coordinator: "drive" }); const c = await transfer(p, { token: b.token, toRuntime: "claude", coordinator: "session" });
  ok(b.epoch === a.epoch + 1 && c.epoch === b.epoch + 1, "epochs"); const lease = await rawLease(p); ok(lease.runtime === "claude" && lease.coordinator === "session" && lease.run_id === "run-a", "return transfer lease");
  for (const old of [a, b]) await rejects(() => renew(p, old.token, old.epoch, { projectStatus: false }), "FENCE", `holder of epoch ${old.epoch}`);
  await renew(p, c.token, c.epoch, { projectStatus: false });
});
await test("transfer never quiesces or kills a running worker (a fake Codex worker survives drive takeover and the owner's return)", async () => {
  const transfer = need("transfer"); const dir = await mk(); const p = path.join(dir, "proj"); await mkdir(path.join(p, ".pandacorp/run"), { recursive: true }); await writeFile(path.join(p, ".pandacorp/status.yaml"), STATUS);
  const plan = await writeWorkerPlan(path.join(dir, "plan.json"), { "*": "hang" });
  const child = spawn(process.execPath, [FAKE_WORKER_BIN, "run", "--project", p, "--id", "w-alive", "--unit", "u-build-wo-01-001", "--dir", p], { env: { ...testEnv(dir), PANDACORP_FAKE_WORKER_PLAN: plan }, stdio: "ignore" });
  const exited = new Promise((r) => child.once("exit", r));
  try {
    const wdir = path.join(p, ".pandacorp/run/codex-workers/w-alive"); await waitFor(() => existsSync(path.join(wdir, "state.json")), 8000, "the fake worker to start");
    const pid = JSON.parse(await readFile(path.join(wdir, "state.json"), "utf8")).pid; ok(pid === child.pid && alive(pid), "fixture worker is not running");
    const l = await acquire(p, { ...A, coordinator: "session" }); const projected = await statusOf(p);
    const t = await transfer(p, { token: l.token, toRuntime: "codex", coordinator: "drive" });
    const back = await transfer(p, { token: t.token, toRuntime: "claude", coordinator: "session" });
    await new Promise((r) => setTimeout(r, 250));
    ok(alive(pid) && child.exitCode === null, "the running worker was killed by transfer"); ok(!existsSync(path.join(wdir, "exit")), "the worker was stopped (exit file written)");
    ok(existsSync(path.join(wdir, "state.json")), "worker state removed");
    ok(!("quiesced_at" in (await rawLease(p))), "transfer quiesced the lease"); ok(await statusOf(p) === projected, "transfer touched status.yaml");
    await renew(p, back.token, back.epoch); // not QUIESCED
  } finally { child.kill("SIGTERM"); await exited; }
});

// ------------------------------------------------------------------ ttl, renewal and expiry
await test("ttl 1800: an expired lease is detectable, a coordinator renew re-freshens it without bumping the epoch", async () => {
  const p = await fixture(); const l = await acquire(p, { ...A, coordinator: "drive", projectStatus: false }); ok((await rawLease(p)).ttl_seconds === 1800, "ttl");
  ok(isFresh(await currentLease(p)) && !isReclaimable(await currentLease(p)), "a new lease must be fresh and not reclaimable");
  await backdate(p, 31 * MIN); let cur = await currentLease(p); ok(!isFresh(cur), "31 min of silence on ttl 1800 must read as expired"); ok(!isReclaimable(cur), "31 min is inside the grace window, not reclaimable");
  await backdate(p, 121 * MIN); cur = await currentLease(p); ok(!isFresh(cur) && isReclaimable(cur), "121 min of silence must be reclaimable");
  await backdate(p, 31 * MIN); const stale = Date.parse((await rawLease(p)).renewed_at);
  const r = await renew(p, l.token, l.epoch, { projectStatus: false }); cur = await currentLease(p);
  ok(Date.parse(r.renewed_at) > stale + 30 * MIN && isFresh(cur), "renew did not bring renewed_at to now"); ok(cur.epoch === l.epoch && cur.ttl_seconds === 1800, "renew changed the epoch or the ttl");
});

// ------------------------------------------------------------------ forceRelease
const deadLease = async (p, extra = {}) => { const l = await acquire(p, { ...A, coordinator: "session", projectStatus: false, ...extra }); await backdate(p, 120 * MIN); return l; };
await test("forceRelease is refused (CONTENDED) on a fresh lease, a freshly transferred lease and a stale lease inside the grace window", async () => {
  const forceRelease = need("forceRelease"); const transfer = need("transfer");
  const p = await fixture(); const l = await acquire(p, { ...A, projectStatus: false }); await writeRunState(p, "run-a"); const snap = await readFile(leaseFile(p), "utf8");
  await rejects(() => forceRelease(p, { ownerConfirmed: true }), "CONTENDED", "fresh lease"); ok(await readFile(leaseFile(p), "utf8") === snap, "lease changed by a refused forceRelease");
  const t = await transfer(p, { token: l.token, toRuntime: "codex", coordinator: "drive" }); await rejects(() => forceRelease(p, { ownerConfirmed: true }), "CONTENDED", "fresh transferred lease");
  await backdate(p, 40 * MIN); await rejects(() => forceRelease(p, { ownerConfirmed: true }), "CONTENDED", "stale but graced lease");
  ok((await currentLease(p)).epoch === t.epoch && existsSync(tokenFile(p)), "refused forceRelease removed lease or token file"); ok(!existsSync(mutexDir(p)), "mutex left behind");
});
await test("forceRelease requires an explicit ownerConfirmed:true even on a dead lease (USAGE) and changes nothing without it", async () => {
  const forceRelease = need("forceRelease"); const p = await fixture(); await deadLease(p); const snap = await readFile(leaseFile(p), "utf8");
  await rejects(() => forceRelease(p, {}), "USAGE", "no ownerConfirmed"); await rejects(() => forceRelease(p, { ownerConfirmed: false }), "USAGE", "ownerConfirmed false"); await rejects(() => forceRelease(p), "USAGE", "no options");
  ok(await readFile(leaseFile(p), "utf8") === snap && existsSync(tokenFile(p)), "an unconfirmed forceRelease removed state"); ok(!existsSync(mutexDir(p)), "mutex left behind");
});
await test("forceRelease on a reclaimable lease removes lease and own token file, keeps the epoch monotonic, never projects status, fences the dead holder", async () => {
  const forceRelease = need("forceRelease"); const p = await fixture(); const l = await acquire(p, { ...A, coordinator: "session" }); await reserveDispatch(p, l.token, l.epoch, { id: "d1", units: 1, limit: 5 });
  const projected = await statusOf(p); ok(/^running: true$/m.test(projected), "fixture projection"); await backdate(p, 120 * MIN); ok(isReclaimable(await currentLease(p)), "fixture lease is not reclaimable");
  await mkdir(path.dirname(tokenFile(p)), { recursive: true }); await writeFile(tokenFile(p), `${JSON.stringify({ epoch: l.epoch, token: l.token })}\n`, { mode: 0o600 });
  await forceRelease(p, { ownerConfirmed: true });
  ok(!(await currentLease(p)) && !existsSync(path.dirname(leaseFile(p))), "lease dir still present"); ok(!existsSync(tokenFile(p)), "token file of the released epoch not removed");
  ok(await statusOf(p) === projected, "forceRelease projected status.yaml (it must never touch it)"); ok(!existsSync(mutexDir(p)), "mutex left behind"); ok((await epochOnDisk(p)) === l.epoch, "epoch file changed or lowered");
  await rejectsAny(() => renew(p, l.token, l.epoch), "dead holder renew after forceRelease");
  const n = await acquire(p, { runtime: "codex", runId: "run-b", ttlSeconds: 30, projectStatus: false }); ok(n.epoch === l.epoch + 1, `a later acquire must continue the epoch (${n.epoch})`);
});
await test("forceRelease leaves a token file that belongs to a different epoch", async () => {
  const forceRelease = need("forceRelease"); const p = await fixture(); const l = await deadLease(p);
  await writeFile(tokenFile(p), `${JSON.stringify({ epoch: l.epoch + 40, token: "someone-elses-token" })}\n`, { mode: 0o600 });
  await forceRelease(p, { ownerConfirmed: true }); ok(!(await currentLease(p)), "lease not removed"); ok(existsSync(tokenFile(p)) && (await tokenOnDisk(p)).epoch === l.epoch + 40, "removed a token file of another epoch");
});

// ------------------------------------------------------------------ transitionWorkOrderAt
const WO1 = "docs/frds/frd-01-alpha/work-orders/wo-01-001.md"; const WO2 = "docs/frds/frd-01-alpha/work-orders/wo-01-002.md"; const WOB = "docs/frds/frd-02-beta/work-orders/wo-02-001.md";
const frontStatus = (text) => text.match(/^implementation_status:\s*["']?(\w+)["']?\s*$/m)?.[1];
const norm = (text) => text.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<ts>");
const addWorktree = async (fx, name) => { const dir = path.join(fx.dir, name); fx.git("worktree", "add", "-q", "-b", `lane/${name}`, dir); return dir; };
const FORBIDDEN = /^(running|build_run_id|build_runtime|build_lease_epoch|supervisor_heartbeat|run_started_at|last_event_at):/m;
await test("transitionWorkOrderAt: writes the WO in the given worktree only, rolls up FRD docs, writes no projection keys, takes no lease", async () => {
  const at = need("transitionWorkOrderAt"); const dir = await mk(); const fx = await createFixture("basic", { dir }); const wt = await addWorktree(fx, "wt");
  const sp = path.join(wt, ".pandacorp/status.yaml"); const original = await readFile(sp, "utf8"); await writeFile(sp, original.split("\n").filter((l) => !/^running:/.test(l)).join("\n"));
  const phaseLine = (await readFile(sp, "utf8")).match(/^phase:.*$/m)[0];
  const lock = await acquire(fx.root, { runtime: "claude", runId: "main-run", ttlSeconds: 1800, projectStatus: false }); const leaseSnap = await readFile(leaseFile(fx.root), "utf8"); // someone else holds the main fence
  await at(wt, { file: WO1, to: "IN_PROGRESS", reason: "unit started" }); ok(frontStatus(await readFile(path.join(wt, WO1), "utf8")) === "IN_PROGRESS", "WO not IN_PROGRESS in the worktree");
  ok(frontStatus(await readFile(path.join(fx.root, WO1), "utf8")) === "PLANNED", "the main checkout WO changed"); ok(fx.git("status", "--porcelain") === "", `main checkout dirty: ${fx.git("status", "--porcelain")}`);
  for (const [file, steps] of [[WO1, ["IN_REVIEW", "VERIFIED"]], [WO2, ["IN_PROGRESS", "IN_REVIEW", "VERIFIED"]]]) for (const to of steps) await at(wt, { file, to, reason: `to ${to}` });
  ok(frontStatus(await readFile(path.join(wt, WO1), "utf8")) === "VERIFIED" && frontStatus(await readFile(path.join(wt, WO2), "utf8")) === "VERIFIED", "WOs not VERIFIED");
  ok(frontStatus(await readFile(path.join(wt, "docs/frds/frd-01-alpha/frd.md"), "utf8")) === "VERIFIED" && frontStatus(await readFile(path.join(wt, "docs/frds/frd-01-alpha/blueprint.md"), "utf8")) === "VERIFIED", "frd.md/blueprint.md rollups not VERIFIED when every WO is");
  ok(frontStatus(await readFile(path.join(wt, "docs/frds/frd-02-beta/frd.md"), "utf8")) === "PLANNED", "an untouched FRD changed");
  const status = await readFile(sp, "utf8"); ok(!FORBIDDEN.test(status), `projection keys appeared in status.yaml:\n${status}`); ok(!/^running\b/m.test(status), "running appeared");
  ok(status.match(/^phase:.*$/m)[0] === phaseLine, "phase changed"); ok(/^work_orders_total: 4$/m.test(status), "work_orders_total");
  ok(/^work_orders_(done|verified): 2$/m.test(status), `verified counter is not 2:\n${status}`); ok(!/^updated_at: "2026-11-11T12:00:00.000Z"$/m.test(status), "updated_at not rewritten");
  ok(!existsSync(path.join(wt, ".pandacorp/run/build.lease")) && !existsSync(epochFile(wt)) && !existsSync(mutexDir(wt)), "transitionWorkOrderAt created lease state in the worktree");
  ok(await readFile(leaseFile(fx.root), "utf8") === leaseSnap && (await currentLease(fx.root)).epoch === lock.epoch, "the main lease was touched (the call is not fenced and holds no lease)");
});
await test("transitionWorkOrderAt: only work_orders_* counters and updated_at may differ in status.yaml; running/heartbeat keep their values", async () => {
  const at = need("transitionWorkOrderAt"); const dir = await mk(); const fx = await createFixture("basic", { dir }); const wt = await addWorktree(fx, "wt2"); const sp = path.join(wt, ".pandacorp/status.yaml");
  await writeFile(sp, `${(await readFile(sp, "utf8"))}supervisor_heartbeat: "2026-11-01T00:00:00.000Z"\nbuild_run_id: "kept"\n`); const before = (await readFile(sp, "utf8")).split("\n");
  for (const to of ["IN_PROGRESS", "IN_REVIEW"]) await at(wt, { file: WOB, to, reason: "t" });
  const after = (await readFile(sp, "utf8")).split("\n"); const keep = (l) => !/^(work_orders_\w+|updated_at):/.test(l);
  ok(JSON.stringify(before.filter(keep)) === JSON.stringify(after.filter(keep)), `status.yaml changed outside work_orders_* and updated_at:\n${before.filter(keep).join("|")}\n${after.filter(keep).join("|")}`);
});
await test("transitionWorkOrderAt applies the same file transform and rollups as the fenced transitionWorkOrder (golden comparison)", async () => {
  const at = need("transitionWorkOrderAt"); const a = await createFixture("basic", { dir: await mk() }); const b = await createFixture("basic", { dir: await mk() }); const wt = await addWorktree(a, "gold");
  const l = await acquire(b.root, { runtime: "codex", runId: "gold", ttlSeconds: 30 });
  for (const [file, steps] of [[WO1, ["IN_PROGRESS", "IN_REVIEW", "VERIFIED"]], [WO2, ["IN_PROGRESS", "IN_REVIEW", "VERIFIED"]], [WOB, ["IN_PROGRESS", "IN_REVIEW"]]]) for (const to of steps) { await at(wt, { file, to, reason: "golden" }); await transitionWorkOrder(b.root, l.token, l.epoch, { file, to }); }
  for (const f of [WO1, WO2, WOB, "docs/frds/frd-01-alpha/frd.md", "docs/frds/frd-01-alpha/blueprint.md", "docs/frds/frd-02-beta/frd.md", "docs/frds/frd-02-beta/blueprint.md"]) ok(norm(await readFile(path.join(wt, f), "utf8")) === norm(await readFile(path.join(b.root, f), "utf8")), `${f} differs between transitionWorkOrderAt and transitionWorkOrder`);
});
await test("transitionWorkOrderAt keeps the v1 path discipline: symlink escapes, paths outside the root and unknown states are rejected without writing", async () => {
  const at = need("transitionWorkOrderAt"); const dir = await mk(); const fx = await createFixture("basic", { dir }); const wt = await addWorktree(fx, "wt3");
  const outside = path.join(dir, "outside.md"); await writeFile(outside, "---\nimplementation_status: PLANNED\n---\n"); const woDir = path.join(wt, "docs/frds/frd-01-alpha/work-orders");
  await symlink(outside, path.join(woDir, "wo-link.md")); await rejects(() => at(wt, { file: "docs/frds/frd-01-alpha/work-orders/wo-link.md", to: "IN_PROGRESS", reason: "x" }), "INVALID_PATH", "symlinked WO");
  await rejectsAny(() => at(wt, { file: path.relative(wt, outside), to: "IN_PROGRESS", reason: "x" }), "a path outside the root"); ok(/PLANNED/.test(await readFile(outside, "utf8")), "an out-of-tree file was mutated");
  const before = await readFile(path.join(wt, WO1), "utf8"); await rejectsAny(() => at(wt, { file: WO1, to: "DONE", reason: "x" }), "an unknown target state"); ok(await readFile(path.join(wt, WO1), "utf8") === before, "WO changed by a rejected transition");
});

// ------------------------------------------------------------------ CLI
await test("CLI transfer: one JSON object, epoch+1, new token file, loser exit 2; malformed invocation exit 3", async () => {
  const p = await fixture(); const l = await acquire(p, { ...A, coordinator: "session", projectStatus: false }); await writeRunState(p, "run-a");
  const bad = cli("transfer", "--project", p, "--token", l.token, "--epoch", String(l.epoch), "--to-runtime", "codex"); ok(bad.status === 3, `missing --coordinator exit ${bad.status} (expected 3)`);
  const bad2 = cli("transfer", "--project", p, "--token", l.token, "--epoch", String(l.epoch), "--to-runtime", "gemini", "--coordinator", "drive"); ok(bad2.status === 3, `bad --to-runtime exit ${bad2.status} (expected 3)`);
  const wrong = cli("transfer", "--project", p, "--token", "wrong-token-0123456789abcdef0123456789", "--epoch", String(l.epoch), "--to-runtime", "codex", "--coordinator", "drive"); ok(wrong.status === 2, `wrong token exit ${wrong.status} (expected 2): ${wrong.stderr}`);
  ok((await rawLease(p)).epoch === l.epoch, "refused CLI transfers changed the epoch");
  const r = cli("transfer", "--project", p, "--token", l.token, "--epoch", String(l.epoch), "--to-runtime", "codex", "--coordinator", "drive"); ok(r.status === 0, `exit ${r.status}: ${r.stderr}`);
  ok(r.stdout.trim().split("\n").length === 1, `stdout must be one JSON line: ${r.stdout}`); const out = JSON.parse(r.stdout); ok(out.epoch === l.epoch + 1, `reported epoch ${out.epoch}`);
  ok(!r.stdout.includes(l.token), "the CLI echoed the previous credential");
  const lease = await rawLease(p); ok(lease.epoch === l.epoch + 1 && lease.runtime === "codex" && lease.coordinator === "drive" && lease.ttl_seconds === 1800, `lease: ${JSON.stringify(lease)}`);
  const tf = await tokenOnDisk(p); ok(tf.epoch === l.epoch + 1 && tf.token !== l.token, "CLI transfer did not rewrite the token file");
  await renew(p, tf.token, tf.epoch, { projectStatus: false }); const again = cli("transfer", "--project", p, "--token", l.token, "--to-runtime", "codex", "--coordinator", "drive"); ok(again.status === 2, `replayed token exit ${again.status}`);
});
await test("CLI force-release: needs --owner-confirmed (exit 3), refuses a live lease (exit 2), releases a dead one (exit 0, JSON)", async () => {
  const p = await fixture(); const l = await acquire(p, { ...A, projectStatus: false });
  const noFlag = cli("force-release", "--project", p); ok(noFlag.status === 3, `without --owner-confirmed exit ${noFlag.status} (expected 3)`);
  const live = cli("force-release", "--project", p, "--owner-confirmed"); ok(live.status === 2, `live lease exit ${live.status} (expected 2)`); ok((await currentLease(p))?.epoch === l.epoch, "a refused force-release removed the lease");
  await backdate(p, 120 * MIN); const dead = cli("force-release", "--project", p, "--owner-confirmed"); ok(dead.status === 0, `dead lease exit ${dead.status}: ${dead.stderr}`);
  JSON.parse(dead.stdout.trim().split("\n").pop()); ok(!(await currentLease(p)), "lease still present after CLI force-release");
});

// ------------------------------------------------------------------ policy and schema pins
await test("enforcement-policy lists transfer and force-release as fenced CLI commands; the lease schema allows coordinator session|drive", async () => {
  const policy = JSON.parse(await readFile(path.join(pluginRoot, "runtime/enforcement-policy.json"), "utf8")); const cmds = policy.fenced_cli?.fenced_commands || [];
  for (const c of ["transfer", "force-release"]) ok(cmds.includes(c), `fenced_cli.fenced_commands lacks ${c}`);
  const schema = JSON.parse(await readFile(path.join(pluginRoot, "runtime/build-state.schema.json"), "utf8"));
  const find = (node) => { if (!node || typeof node !== "object") return null; if (node.coordinator?.enum) return node.coordinator.enum; for (const v of Object.values(node)) { const r = find(v); if (r) return r; } return null; };
  const enumValues = find(schema); ok(enumValues && enumValues.slice().sort().join() === "drive,session", `schema coordinator enum: ${JSON.stringify(enumValues)}`);
});

for (const d of roots) await rm(d, { recursive: true, force: true }).catch(() => {});
console.log(`RESULT: ${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
