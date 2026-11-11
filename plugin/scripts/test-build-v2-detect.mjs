#!/usr/bin/env node
// test-build-v2-detect.mjs — engine v2 row B06: plugin/runtime/build/detect.mjs + card.mjs.
//
// Contracts pinned (from the docs only; the implementation was never read):
//   PLAN §3.10 + §3.16 A3/A4/A17, build-engine-cli.md §3.1 (`start --detect`), §3.5 (`card check`), §3.23 (legacy words),
//   build-engine.md BUILD-7 (7 detection rows, label precedence) and BUILD-8 (card shape), card-frontmatter.schema.json.
//
// ASSUMED INTERFACE (the docs give no export names; the orchestrator reconciles test and module afterwards):
//   plugin/runtime/build/detect.mjs
//     export async function detect(input, deps) -> the JSON of `start --detect` WITHOUT the envelope keys:
//       { signals{lease, lease_coordinator, run_status, args, card_session, wos_pending, first_impl, phase, launched,
//                 cards[], cards_half[], suspended[], suspendable_run}, row, scope{card,frds,wos}, size_provisional,
//         label, label_source, warnings[] }
//       input = { project:<abs root>, args:<raw string>, sessionCard:<abs path>|undefined, sessionId, sessionRuntime:"claude"|"codex",
//                 resume:<boolean> }            (resume = the `--resume` flag of the CLI)
//       deps  = { env }  (the clock comes from env.PANDACORP_NOW, the orchestrate flag dir from env.PANDACORP_ORCHESTRATE_DIR;
//                 the test also exports those variables into process.env for the duration of each call, in case the module
//                 reads process.env directly).
//   plugin/runtime/build/card.mjs
//     export async function checkCard(file, deps) -> { errors:string[], warnings:string[], fields:object }
//     export async function archiveCard(project, { slug, sha }, deps) -> any (never throws for a missing / already archived card)
//   Result shape tolerances: `errors`/`warnings` may be strings or objects (their JSON text is searched); `cards` /
//   `cards_half` items may be slugs or objects that contain the slug; WO ids are compared case-insensitively.
//   Facts assumed from the CLI doc's examples (lowercase ids): scope.wos / scope.frds are lowercase ids or prefixes
//   ("wo-01-001", "frd-01" or "frd-01-alpha"); scope.card is the card slug; the legacy warning text is exactly
//   "legacy mode word ignored"; `obsolete` is read as `discarded` in `fields.status`.
//   Exit codes / the CLI dispatcher are NOT exercised here (that is the dispatcher's own test).
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (a, b, message) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const txt = (v) => JSON.stringify(v ?? null);
const has = (v, re) => re.test(txt(v));
const lc = (list) => (Array.isArray(list) ? list.map((x) => String(typeof x === "object" && x ? x.id ?? x.slug ?? txt(x) : x).toLowerCase()) : []);

const RUNTIME = new URL("../runtime/build/", import.meta.url);
const load = async (name) => { try { return await import(new URL(name, RUNTIME)); } catch (e) { throw new Error(`module plugin/runtime/build/${name} cannot be loaded: ${e.message}`); } };
const fsx = await import(new URL("fsx.mjs", RUNTIME)).catch(() => null);
const cardSchema = JSON.parse(await readFile(fileURLToPath(new URL("schemas/card-frontmatter.schema.json", RUNTIME)), "utf8"));

const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

// ---- sandbox + fixture helpers -------------------------------------------------------------------------------------
const sandboxes = [];
const sandbox = async (preset = "basic") => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pc-detect-"));
  sandboxes.push(dir);
  const fx = await createFixture(preset, { dir });
  return fx;
};
const put = async (fx, rel, text) => { const f = path.join(fx.root, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text); return f; };
const CHANGES = ".pandacorp/inbox/changes";
const fm = (obj) => `---\n${Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`).join("\n")}\n---\n`;
const GOOD_BODY = `\n# Filtro por estado en la lista alpha\n\n## Dentro\n- Filtrar la lista por estado "quiero un filtro por estado"\n- Mostrar el contador "y que muestre cuántos hay"\n\n## Fuera\n- Orden por fecha, descartado "el orden lo dejamos para después"\n\n## Dudas\n- ninguna\n`;
const V2_FM = { type: "feature", class: "standard", status: "ready", date: "2026-11-11", frd: "frd-01-alpha", origin: "conversation", affected_frds: ["frd-01-alpha"], engine: "v2" };
const card = (over = {}, body = GOOD_BODY) => `${fm({ ...V2_FM, ...over })}${body}`;
const writeCard = (fx, slug, over, body, dir = CHANGES) => put(fx, `${dir}/${slug}.md`, card(over, body));
const writeLease = (fx, { runId = "r-live", ageSec = 30, coordinator, runtime = "claude", ttl = 1800 } = {}) =>
  put(fx, ".pandacorp/run/build.lease/lease.json", `${JSON.stringify({ version: 1, runtime, run_id: runId, token_hash: "x".repeat(64), epoch: 1, acquired_at: iso(NOW - 4 * 3600e3), renewed_at: iso(NOW - ageSec * 1000), ttl_seconds: ttl, project_phase: "implementation", ...(coordinator ? { coordinator } : {}) })}\n`);
const writeState = (fx, { runId = "r-run", status = "active", wos = ["wo-01-001", "wo-01-002"], frds = ["frd-01-alpha"], card: cardSlug = null } = {}) =>
  put(fx, ".pandacorp/run/build/state.json", `${JSON.stringify({ schema: 2, engine: "v2", run_id: runId, epoch: 1, coordinator: "claude-session", label: "claude", size: "feature", status, status_reason: null, tranche: null, scope: { card: cardSlug, frds, wos, out_of_scope: [] }, integration: { branch: `lane/${runId}`, worktree: ".pandacorp/run/build/integration", base_sha: "0".repeat(40) }, last_safe_point: null, units: [], jobs: [], handbacks_in_a_row: 0, doubts_consulted: 0, answers: {}, quota_at_unit: {} }, null, 2)}\n`);
const setWoStatus = async (fx, file, status) => { const f = path.join(fx.root, file); const t = await readFile(f, "utf8"); await writeFile(f, t.replace(/implementation_status: \w+/, `implementation_status: ${status}`)); };
const ALL_WOS = ["docs/frds/frd-01-alpha/work-orders/wo-01-001.md", "docs/frds/frd-01-alpha/work-orders/wo-01-002.md", "docs/frds/frd-02-beta/work-orders/wo-02-001.md", "docs/frds/frd-02-beta/work-orders/wo-02-002.md"];
const verifyAllWos = async (fx, except = []) => { for (const f of ALL_WOS) if (!except.includes(f)) await setWoStatus(fx, f, "VERIFIED"); };

// ---- read-only snapshot ---------------------------------------------------------------------------------------------
async function snapshot(root) {
  const out = {};
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const abs = path.join(dir, e.name); const rel = path.relative(root, abs);
      if (e.isDirectory()) { out[`${rel}/`] = "dir"; await walk(abs); } else if (e.isFile()) out[rel] = createHash("sha256").update(await readFile(abs)).digest("hex");
    }
  };
  await walk(root);
  return out;
}

// ---- adapters (the only place that knows the assumed signatures) ------------------------------------------------------
async function runDetect(fx, { args = "", sessionCard, sessionId = "sess-1", sessionRuntime = "claude", resume = false, env = {} } = {}) {
  const mod = await load("detect.mjs");
  if (typeof mod.detect !== "function") throw new Error("detect.mjs does not export detect(input, deps) (ASSUMED INTERFACE)");
  const e = fx.env({ PANDACORP_NOW: iso(NOW), ...env });
  const saved = {};
  for (const [k, v] of Object.entries(e)) if (k.startsWith("PANDACORP_")) { saved[k] = process.env[k]; process.env[k] = v; }
  try {
    const r = await mod.detect({ project: fx.root, args, sessionCard, sessionId, sessionRuntime, resume }, { env: e });
    ok(r && typeof r === "object", "detect returned no object");
    ok(r.signals && typeof r.signals === "object", `detect result has no signals: ${txt(r)}`);
    return r;
  } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
async function runCheck(fx, text, name = "check-me") {
  const mod = await load("card.mjs");
  if (typeof mod.checkCard !== "function") throw new Error("card.mjs does not export checkCard(file, deps) (ASSUMED INTERFACE)");
  const f = await put(fx, `${CHANGES}/${name}.md`, text);
  const r = await mod.checkCard(f, { env: fx.env() });
  ok(r && Array.isArray(r.errors) && Array.isArray(r.warnings) && r.fields && typeof r.fields === "object", `checkCard must return {errors[], warnings[], fields{}}: ${txt(r)}`);
  return r;
}
async function runArchive(fx, slug, sha) {
  const mod = await load("card.mjs");
  if (typeof mod.archiveCard !== "function") throw new Error("card.mjs does not export archiveCard(project, {slug, sha}, deps) (ASSUMED INTERFACE)");
  return mod.archiveCard(fx.root, { slug, sha }, { env: fx.env() });
}
const exists = async (f) => { try { await stat(f); return true; } catch { return false; } };

// ==== detect: the 7 rows ===============================================================================================
await test("row 6: no context + pending work orders builds the pending plan, size feature, nothing drained", async () => {
  const fx = await sandbox("card"); await setWoStatus(fx, ALL_WOS[3], "VERIFIED");
  const r = await runDetect(fx);
  eq(r.row, 6, "row");
  eq(lc(r.scope.wos).sort(), ["wo-01-001", "wo-01-002", "wo-02-001"], "scope.wos is the whole pending plan");
  ok(r.scope.card == null, "a ready card in the queue must NOT become the scope of the engine");
  eq(r.signals.wos_pending, 3, "signals.wos_pending");
  eq(r.signals.first_impl, false, "a VERIFIED WO means not the first implementation");
  eq(r.size_provisional, "feature", "2-15 WOs, not first implementation, is a feature");
  eq(r.signals.phase, "implementation", "signals.phase");
  eq(r.signals.launched, false, "signals.launched");
  ok(has(r.signals.cards, /add-filter/) && has(r.signals.cards, /fix-crash/), `signals.cards lists the ready cards: ${txt(r.signals.cards)}`);
});
await test("first implementation (no VERIFIED WO) => first_impl true and size giant", async () => {
  const fx = await sandbox("basic");
  const r = await runDetect(fx);
  eq(r.row, 6, "row"); eq(r.signals.first_impl, true, "first_impl"); eq(r.signals.wos_pending, 4, "wos_pending"); eq(r.size_provisional, "giant", "size");
});
await test("a ready card in the queue is NOT drained by the engine (no context, row 7 when no pending WOs)", async () => {
  const fx = await sandbox("card"); await verifyAllWos(fx);
  await writeCard(fx, "draft-idea", { status: "draft" });
  const r = await runDetect(fx);
  eq(r.row, 7, "row 7: nothing in scope");
  ok(r.scope.card == null && lc(r.scope.wos).length === 0, `row 7 has no scope: ${txt(r.scope)}`);
  for (const slug of ["add-filter", "fix-crash", "draft-idea"]) ok(has(r.signals.cards, new RegExp(slug)), `row 7 lists ${slug} (ready/draft cards): ${txt(r.signals.cards)}`);
});
await test("row 7 with nothing at all: empty scope, empty cards", async () => {
  const fx = await sandbox("basic"); await verifyAllWos(fx);
  const r = await runDetect(fx);
  eq(r.row, 7, "row"); eq(r.signals.wos_pending, 0, "wos_pending"); eq(r.signals.cards, [], "cards"); eq(r.signals.cards_half, [], "cards_half");
});
await test("row 6 excludes WOs whose source_change names an open card; a closed card does not exclude", async () => {
  const fx = await sandbox("card");
  const wo = (await readFile(path.join(fx.root, ALL_WOS[0]), "utf8")).replace("WO-01-001", "WO-01-003").replace("wo-01-001", "wo-01-003").replace("dependsOn: []", "dependsOn: []\nsource_change: [add-filter]");
  await put(fx, "docs/frds/frd-01-alpha/work-orders/wo-01-003.md", wo);
  let r = await runDetect(fx);
  eq(r.row, 6, "row"); ok(!lc(r.scope.wos).includes("wo-01-003"), `WO of an open card must be excluded: ${txt(r.scope.wos)}`);
  eq(r.signals.wos_pending, 4, "wos_pending counts only the plan WOs");
  await rm(path.join(fx.root, CHANGES, "add-filter.md")); await writeCard(fx, "add-filter", { status: "done" }, GOOD_BODY, `${CHANGES}/done`);
  r = await runDetect(fx);
  ok(lc(r.scope.wos).includes("wo-01-003"), `a WO whose card is done is part of the pending plan: ${txt(r.scope.wos)}`);
});
await test("row 3: card as change:<id>, change=<id> or bare slug; ready and draft", async () => {
  for (const arg of ["change:add-filter", "change=add-filter", "add-filter"]) {
    const fx = await sandbox("card");
    const r = await runDetect(fx, { args: arg });
    eq(r.row, 3, `row for "${arg}"`); eq(r.scope.card, "add-filter", `scope.card for "${arg}"`);
  }
  const fx = await sandbox("card"); await writeCard(fx, "later", { status: "draft" });
  const r = await runDetect(fx, { args: "change:later" });
  eq(r.row, 3, "draft card is a valid target"); eq(r.scope.card, "later", "scope.card");
});
await test("row 4: target FRDs gives their pending WOs; a cross-FRD dependency not VERIFIED is a hand-back, never pulled in", async () => {
  const fx = await sandbox("basic");
  let r = await runDetect(fx, { args: "frd-01" });
  eq(r.row, 4, "row"); eq(lc(r.scope.wos).sort(), ["wo-01-001", "wo-01-002"], "only the FRD's WOs");
  ok(lc(r.scope.frds).some((x) => x.startsWith("frd-01")), `scope.frds names frd-01: ${txt(r.scope.frds)}`);
  const dep = path.join(fx.root, "docs/frds/frd-02-beta/work-orders/wo-02-001.md");
  await writeFile(dep, (await readFile(dep, "utf8")).replace("dependsOn: []", "dependsOn: [WO-01-001]"));
  r = await runDetect(fx, { args: "frd-02" });
  ok(!lc(r.scope.wos).some((w) => w.startsWith("wo-01")), `cross-FRD dependency must not be pulled into the scope: ${txt(r.scope.wos)}`);
  const rest = { ...r, scope: null, signals: null };
  ok(has(rest, /01-001/i) || has(r.signals, /01-001/i), `the unmet dependency WO-01-001 is reported (hand-back / warnings): ${txt(r)}`);
  await setWoStatus(fx, ALL_WOS[0], "VERIFIED");
  r = await runDetect(fx, { args: "frd-02" });
  eq(r.row, 4, "row once the dependency is VERIFIED"); ok(lc(r.scope.wos).includes("wo-02-001"), "frd-02 WOs in scope");
});
await test("row 5: a session card gives the conversed scope only, never the pending plan", async () => {
  const fx = await sandbox("basic");
  const f = await writeCard(fx, "session-card", {});
  const r = await runDetect(fx, { sessionCard: f });
  eq(r.row, 5, "row"); eq(r.scope.card, "session-card", "scope.card");
  eq(lc(r.scope.wos).length, 0, "the pending plan is not the scope of a session card");
  ok(r.signals.card_session != null, "signals.card_session is set");
});
await test("fresh session without context lands only on 2, 6 or 7 (never 5, never infers a card)", async () => {
  const fx = await sandbox("card");
  for (const setup of [async () => {}, async () => verifyAllWos(fx)]) { await setup(); const r = await runDetect(fx); ok([2, 6, 7].includes(r.row), `row ${r.row} not allowed without context`); eq(r.signals.card_session, null, "card_session"); }
});

// ==== precedence ======================================================================================================
await test("row 1: live lease and no resume => no scope, even with a session card or a card argument", async () => {
  const fx = await sandbox("card"); await writeLease(fx, { runId: "r-other", ageSec: 30 });
  let r = await runDetect(fx);
  eq(r.row, 1, "row"); eq(r.signals.lease, "live", "signals.lease"); ok(r.scope.card == null && lc(r.scope.wos).length === 0, `row 1 has no scope: ${txt(r.scope)}`);
  const f = await writeCard(fx, "session-card", {});
  r = await runDetect(fx, { sessionCard: f }); eq(r.row, 1, "session card + live lease => row 1 (the card is saved ready by the session)");
  r = await runDetect(fx, { args: "change:add-filter" }); eq(r.row, 1, "card argument + live lease => row 1");
});
await test("row 1 vs row 2: --resume with a live lease reaches row 2", async () => {
  const fx = await sandbox("basic"); await writeLease(fx, { runId: "r-live", ageSec: 10 }); await writeState(fx, { runId: "r-live", status: "active" });
  eq((await runDetect(fx)).row, 1, "without resume"); eq((await runDetect(fx, { resume: true })).row, 2, "with resume");
});
await test("row 2: stale lease + non-terminal v2 state resumes that run's scope", async () => {
  const fx = await sandbox("basic"); await writeLease(fx, { runId: "r-run", ageSec: 3 * 3600 }); await writeState(fx, { runId: "r-run", status: "paused", wos: ["wo-01-001"], frds: ["frd-01-alpha"] });
  const r = await runDetect(fx);
  eq(r.row, 2, "row"); eq(r.signals.lease, "stale", "signals.lease"); eq(r.signals.run_status, "paused", "signals.run_status");
  eq(lc(r.scope.wos), ["wo-01-001"], "scope is the RUN's scope, not the pending plan");
});
await test("row 2: absent lease + resumable v2 state (incl. stopped) resumes; only finished does not", async () => {
  const fx = await sandbox("basic"); await writeState(fx, { runId: "r-run", status: "waiting_owner" });
  let r = await runDetect(fx);
  eq(r.row, 2, "row (waiting_owner is non-terminal)"); eq(r.signals.lease, "free", "signals.lease"); eq(r.signals.lease_coordinator, null, "lease_coordinator null when free");
  await writeState(fx, { runId: "r-run", status: "stopped" }); r = await runDetect(fx); eq(r.row, 2, "stopped is resumable (CLI doc 3.4)"); eq(r.signals.run_status, "stopped", "run_status");
  await writeState(fx, { runId: "r-run", status: "finished" }); r = await runDetect(fx); eq(r.row, 6, "finished is closed for good"); eq(r.signals.run_status, "finished", "run_status");
});
await test("row 2: a v2 building card of this project; a v1 building card is only a half-built card", async () => {
  const fx = await sandbox("basic"); await writeCard(fx, "half-v2", { status: "building", run_id: "r-gone" });
  let r = await runDetect(fx);
  eq(r.row, 2, "v2 building card => row 2"); ok(has(r.signals.cards_half, /half-v2/), `cards_half lists it: ${txt(r.signals.cards_half)}`);
  const fx1 = await sandbox("basic"); await put(fx1, `${CHANGES}/half-v1.md`, `${fm({ type: "feature", class: "standard", status: "building", date: "2026-11-01", integration_transaction: "tx-1", integration_paths: ["src/a.ts"] })}\n# Cambio v1\n`);
  r = await runDetect(fx1);
  ok(r.row !== 2, `a v1 building card must not resume as a v2 run (row ${r.row})`); ok(has(r.signals.cards_half, /half-v1/), `cards_half lists the v1 card: ${txt(r.signals.cards_half)}`);
});
await test("row 2: no current run but suspended runs exist; signals.suspended lists their ids", async () => {
  const fx = await sandbox("basic"); await mkdir(path.join(fx.root, ".pandacorp/run/build-suspended/r-old-1"), { recursive: true }); await mkdir(path.join(fx.root, ".pandacorp/run/build-suspended/r-old-2"), { recursive: true });
  const r = await runDetect(fx);
  eq(r.row, 2, "row"); eq([...r.signals.suspended].sort(), ["r-old-1", "r-old-2"], "signals.suspended");
});
await test("PRECEDENCE: session card + paused run => the conversed scope wins (row 5), the paused run is suspendable, never silently resumed", async () => {
  const fx = await sandbox("basic"); await writeLease(fx, { runId: "r-paused", ageSec: 3 * 3600 }); await writeState(fx, { runId: "r-paused", status: "paused" });
  const f = await writeCard(fx, "session-card", {});
  const r = await runDetect(fx, { sessionCard: f });
  eq(r.row, 5, "row 5, not 2"); eq(r.scope.card, "session-card", "scope is the card"); eq(r.signals.suspendable_run, "r-paused", "signals.suspendable_run");
  ok(!lc(r.scope.wos).includes("wo-01-002"), "the paused run's WOs are not in the conversed scope");
  const free = await runDetect(fx); eq(free.row, 2, "without the card the same tree resumes the paused run"); eq(free.signals.suspendable_run, null, "suspendable_run null without a session card");
});
await test("session card + a run with a lease already released (absent) and non-terminal state: still row 5 + suspendable_run", async () => {
  const fx = await sandbox("basic"); await writeState(fx, { runId: "r-waiting", status: "waiting_gate" });
  const f = await writeCard(fx, "session-card", {});
  const r = await runDetect(fx, { sessionCard: f });
  eq(r.row, 5, "row"); eq(r.signals.suspendable_run, "r-waiting", "suspendable_run");
});
await test("explicit target outranks the implicit resume: card argument + stale non-terminal run => row 3 with suspendable_run, run untouched", async () => {
  const fx = await sandbox("card"); await writeLease(fx, { runId: "r-run", ageSec: 3 * 3600 }); await writeState(fx, { runId: "r-run", status: "paused" });
  const before = await readFile(path.join(fx.root, ".pandacorp/run/build/state.json"), "utf8");
  const r = await runDetect(fx, { args: "change:add-filter" });
  eq([r.row, r.scope.card], [3, "add-filter"], "row 3 and the card"); eq(r.signals.suspendable_run, "r-run", "suspendable_run");
  eq(await readFile(path.join(fx.root, ".pandacorp/run/build/state.json"), "utf8"), before, "paused run untouched");
});
await test("explicit target outranks the implicit resume: FRD target + paused run => row 4 with suspendable_run", async () => {
  const fx = await sandbox("basic"); await writeState(fx, { runId: "r-run", status: "paused" });
  const r = await runDetect(fx, { args: "frd-02" });
  eq(r.row, 4, "row"); eq(r.signals.suspendable_run, "r-run", "suspendable_run");
  ok(lc(r.scope.wos).every((w) => w.startsWith("wo-02")), `scope is the FRD's WOs only: ${txt(r.scope.wos)}`);
});
await test("explicit target outranks implicit triggers: v2 building card or suspended runs + card argument => row 3", async () => {
  const fx = await sandbox("card"); await writeCard(fx, "half-v2", { status: "building", run_id: "r-gone" });
  eq((await runDetect(fx, { args: "change:add-filter" })).row, 3, "building card does not hijack the target");
  const fx2 = await sandbox("card"); await mkdir(path.join(fx2.root, ".pandacorp/run/build-suspended/r-old"), { recursive: true });
  eq((await runDetect(fx2, { args: "change:add-filter" })).row, 3, "suspended run does not hijack the target");
});
await test("session card + suspended run only (no current run) => row 5, suspended listed", async () => {
  const fx = await sandbox("basic"); await mkdir(path.join(fx.root, ".pandacorp/run/build-suspended/r-old"), { recursive: true });
  const f = await writeCard(fx, "session-card", {});
  const r = await runDetect(fx, { sessionCard: f });
  eq(r.row, 5, "row"); eq(r.signals.suspended, ["r-old"], "signals.suspended");
});
await test("explicit --resume + session card => row 2 (explicit resume keeps its position)", async () => {
  const fx = await sandbox("basic"); await writeLease(fx, { runId: "r-run", ageSec: 3 * 3600 }); await writeState(fx, { runId: "r-run", status: "paused" });
  const f = await writeCard(fx, "session-card", {});
  eq((await runDetect(fx, { sessionCard: f, resume: true })).row, 2, "row");
});
await test("live lease + anything => row 1 (FRD target too)", async () => {
  const fx = await sandbox("basic"); await writeLease(fx, { runId: "r-other", ageSec: 30 });
  eq((await runDetect(fx, { args: "frd-01" })).row, 1, "row");
});
await test("first match wins: pending WOs and ready cards => row 6, cards listed, none selected", async () => {
  const fx = await sandbox("card");
  const r = await runDetect(fx);
  eq(r.row, 6, "row"); ok(r.scope.card == null, "card not selected");
});

// ==== signals =========================================================================================================
await test("signals.lease free|live|stale, lease_coordinator, run_status", async () => {
  const fx = await sandbox("basic");
  let r = await runDetect(fx);
  eq(r.signals.lease, "free", "no lease"); eq(r.signals.lease_coordinator, null, "coordinator null"); eq(r.signals.run_status, null, "run_status null with no state");
  await writeLease(fx, { runId: "r-d", ageSec: 60, coordinator: "drive" }); await writeState(fx, { runId: "r-d", status: "active" });
  r = await runDetect(fx); eq(r.signals.lease, "live", "fresh lease"); eq(r.signals.lease_coordinator, "drive", "drive coordinates"); eq(r.signals.run_status, "active", "run_status");
  await writeLease(fx, { runId: "r-d", ageSec: 60, coordinator: "session" });
  r = await runDetect(fx); eq(r.signals.lease_coordinator, "session", "session coordinates");
  await writeLease(fx, { runId: "r-d", ageSec: 1801 + 3600, coordinator: "session" });
  r = await runDetect(fx); eq(r.signals.lease, "stale", "expired lease");
});
await test("signals.launched/phase come from status.yaml; first_impl is a boolean", async () => {
  const fx = await sandbox("launched");
  const r = await runDetect(fx);
  eq(r.signals.launched, true, "launched"); eq(r.signals.phase, "release", "phase"); eq(typeof r.signals.first_impl, "boolean", "first_impl is boolean");
});
await test("provisional size: touch (1 WO), feature (2-15 WOs), giant (first implementation with more than 4 FRDs)", async () => {
  const fx = await sandbox("basic"); await verifyAllWos(fx, [ALL_WOS[0]]);
  eq((await runDetect(fx)).size_provisional, "touch", "one pending WO");
  const fx2 = await sandbox("basic");
  for (const n of ["03", "04", "05"]) {
    const base = `docs/frds/frd-${n}-extra`;
    await put(fx2, `${base}/frd.md`, `---\nid: FRD-${n}\ntype: frd\nimplementation_status: PLANNED\n---\n# FRD-${n}\n`);
    await put(fx2, `${base}/work-orders/wo-${n}-001.md`, `---\nid: WO-${n}-001\ntype: work-order\nimplementation_status: PLANNED\nartifacts:\n  - 'src/x${n}.ts'\ndependsOn: []\n---\n# WO-${n}-001\n`);
  }
  const r = await runDetect(fx2);
  eq(r.row, 6, "row"); eq(r.size_provisional, "giant", "5 FRDs, first implementation");
});
await test("card scope size_provisional is one of the enum", async () => {
  const fx = await sandbox("card");
  const r = await runDetect(fx, { args: "change:fix-crash" });
  ok(["touch", "feature", "giant"].includes(r.size_provisional), `size ${r.size_provisional}`);
});

// ==== label precedence and legacy words ===============================================================================
await test("label precedence: explicit > orchestrate flag > session runtime; flag is read-only", async () => {
  const fx = await sandbox("basic"); const orch = path.join(fx.dir, "orchestrate"); await mkdir(orch, { recursive: true });
  let r = await runDetect(fx, { sessionRuntime: "claude" });
  eq([r.label, r.label_source], ["claude", "default"], "default = session runtime");
  r = await runDetect(fx, { sessionRuntime: "codex" }); eq([r.label, r.label_source], ["codex", "default"], "default codex in a Codex session");
  const flag = path.join(orch, "sess-1.on"); await writeFile(flag, "codex"); const past = new Date(NOW - 86400e3); await utimes(flag, past, past);
  r = await runDetect(fx, { sessionRuntime: "claude" }); eq([r.label, r.label_source], ["codex", "orchestrate"], "flag content codex");
  await writeFile(flag, "claude"); await utimes(flag, past, past);
  r = await runDetect(fx, { sessionRuntime: "claude" }); eq([r.label, r.label_source], ["claude", "orchestrate"], "flag content claude");
  await writeFile(flag, "codex"); await utimes(flag, past, past);
  r = await runDetect(fx, { sessionRuntime: "claude", args: "--label claude" }); eq([r.label, r.label_source], ["claude", "explicit"], "explicit beats the flag");
  r = await runDetect(fx, { sessionRuntime: "claude", args: "--label codex" }); eq([r.label, r.label_source], ["codex", "explicit"], "explicit codex");
  r = await runDetect(fx, { sessionRuntime: "claude", sessionId: "another-session" }); eq([r.label, r.label_source], ["claude", "default"], "the flag of another session does not apply");
  eq(await readFile(flag, "utf8"), "codex", "flag content unchanged"); eq((await stat(flag)).mtimeMs, past.getTime(), "flag mtime unchanged (never written)");
  eq(await readdir(orch), ["sess-1.on"], "no flag file created or deleted");
});
await test("label: a bare word codex in the arguments is explicit too", async () => {
  const fx = await sandbox("card");
  const r = await runDetect(fx, { args: "change:add-filter codex", sessionRuntime: "claude" });
  eq([r.row, r.scope.card, r.label, r.label_source], [3, "add-filter", "codex", "explicit"], "card + label word");
});
await test("legacy mode words pro|balanced|powerful|deep are ignored with a warning and change nothing else", async () => {
  const fx = await sandbox("card");
  const base = await runDetect(fx);
  for (const word of ["pro", "balanced", "powerful", "deep"]) {
    const r = await runDetect(fx, { args: word });
    eq(r.row, base.row, `row unchanged by ${word}`); eq(lc(r.scope.wos), lc(base.scope.wos), `scope unchanged by ${word}`);
    ok(has(r.warnings, /legacy mode word ignored/), `warning for ${word}: ${txt(r.warnings)}`);
    eq([r.label, r.label_source], [base.label, base.label_source], `label unchanged by ${word}`);
  }
  const r = await runDetect(fx, { args: "powerful change:add-filter" }); eq([r.row, r.scope.card], [3, "add-filter"], "legacy word + card");
  ok(!has(base.warnings, /legacy/), "no legacy warning without a legacy word");
});

// ==== read-only =======================================================================================================
await test("detect is read-only: tree, .pandacorp/run, cards and the git index are unchanged (rows 1,2,3,5,6,7)", async () => {
  const fx = await sandbox("card");
  const f = await writeCard(fx, "session-card", {}); await writeCard(fx, "half-v2", { status: "building", run_id: "r-gone" });
  await writeLease(fx, { runId: "r-paused", ageSec: 3 * 3600 }); await writeState(fx, { runId: "r-paused", status: "paused" });
  await mkdir(path.join(fx.dir, "orchestrate"), { recursive: true }); await writeFile(path.join(fx.dir, "orchestrate", "sess-1.on"), "codex");
  const head0 = fx.git("rev-parse", "HEAD");
  const calls = [{}, { args: "change:add-filter" }, { args: "frd-01" }, { sessionCard: f }, { resume: true }, { args: "powerful" }];
  const assertUntouched = async (label) => {
    const before = await snapshot(fx.root);
    for (const c of calls) await runDetect(fx, c);
    const after = await snapshot(fx.root);
    eq(Object.keys(after).sort(), Object.keys(before).sort(), `${label}: file set unchanged`);
    eq(after, before, `${label}: contents unchanged`);
  };
  await assertUntouched("stale lease + paused run");
  await rm(path.join(fx.root, ".pandacorp/run/build.lease"), { recursive: true });
  await assertUntouched("no lease");
  await writeLease(fx, { runId: "r-live", ageSec: 5 });
  await assertUntouched("live lease");
  ok(fx.git("rev-parse", "HEAD") === head0, "HEAD unchanged");
  ok(!(await exists(path.join(fx.root, ".pandacorp/run/scope.json"))), "detect does not write scope.json (the session does)");
  ok(!(await exists(path.join(fx.root, ".pandacorp/run/build/journal.jsonl"))), "detect wrote no journal");
  ok(!(await exists(path.join(fx.root, ".pandacorp/run/build/preflight.json"))), "detect wrote no preflight");
});
await test("detect on a directory that is not a project fails loud (no silent empty result)", async () => {
  const fx = await sandbox("basic"); await rm(path.join(fx.root, ".pandacorp/status.yaml"));
  await load("detect.mjs");
  let threw = false; let r = null;
  try { r = await runDetect(fx); } catch { threw = true; }
  ok(threw || r.ok === false || r.row == null || r.error, `a root without .pandacorp/status.yaml must not yield a normal detection: ${txt(r)}`);
});

// ==== card check ======================================================================================================
await test("card check: a valid v2 session card has no errors and passes its fields through", async () => {
  const fx = await sandbox("basic");
  const r = await runCheck(fx, card());
  eq(r.errors, [], "errors"); eq(r.fields.type, "feature", "fields.type"); eq(r.fields.status, "ready", "fields.status"); eq(r.fields.engine, "v2", "fields.engine");
  eq(r.fields.origin, "conversation", "fields.origin"); ok(has(r.fields.affected_frds, /frd-01-alpha/), "fields.affected_frds");
});
await test("card check: missing Dentro / missing Fuera / missing H1 title are errors naming the problem", async () => {
  const fx = await sandbox("basic");
  let r = await runCheck(fx, card({}, "\n# Titulo\n\n## Fuera\n- nada \"no\"\n\n## Dudas\n- ninguna\n"), "no-dentro");
  ok(r.errors.length > 0 && has(r.errors, /dentro/i), `missing Dentro: ${txt(r.errors)}`);
  r = await runCheck(fx, card({}, "\n# Titulo\n\n## Dentro\n- algo \"lo pedi\"\n\n## Dudas\n- ninguna\n"), "no-fuera");
  ok(r.errors.length > 0 && has(r.errors, /fuera/i), `missing Fuera: ${txt(r.errors)}`);
  r = await runCheck(fx, card({}, "\n## Dentro\n- algo \"lo pedi\"\n\n## Fuera\n- nada \"no\"\n"), "no-h1");
  ok(r.errors.length > 0 && has(r.errors, /h1|title|t[ií]tulo/i), `missing H1: ${txt(r.errors)}`);
});
await test("card check: a Dentro item without a citation of the owner's message is flagged", async () => {
  const fx = await sandbox("basic");
  const r = await runCheck(fx, card({}, "\n# Titulo\n\n## Dentro\n- Filtrar por estado sin ninguna cita\n\n## Fuera\n- nada \"no\"\n\n## Dudas\n- ninguna\n"));
  ok(r.errors.length + r.warnings.length > 0 && has([r.errors, r.warnings], /cita|citation|quote|cited/i), `no-citation item must be reported: ${txt(r)}`);
});
await test("card check: frontmatter enums (type, status, class), engine const and field types come from the schema", async () => {
  const fx = await sandbox("basic");
  const bad = [[{ type: "epic" }, /type/i], [{ status: "parked" }, /status/i], [{ class: "whenever" }, /class/i], [{ engine: "v1" }, /engine/i], [{ run_id: "[1]" }, /run_id/i]];
  for (const [over, re] of bad) { const r = await runCheck(fx, card(over), "bad"); ok(r.errors.length > 0 && has(r.errors, re), `${txt(over)} must be an error naming the field: ${txt(r.errors)}`); }
  let r = await runCheck(fx, `---\ntype: feature\n---\n${GOOD_BODY}`, "nostatus"); ok(has(r.errors, /status/i), `status is required: ${txt(r.errors)}`);
  r = await runCheck(fx, `---\nstatus: ready\n---\n${GOOD_BODY}`, "notype"); ok(has(r.errors, /type/i), `type is required: ${txt(r.errors)}`);
});
await test("card check: every type x status of Mission Control's enums is accepted, obsolete is a read alias of discarded", async () => {
  const fx = await sandbox("basic");
  for (const type of ["bug", "feature", "change"]) for (const status of ["ready", "draft", "building", "closing", "done", "discarded", "obsolete"]) {
    const r = await runCheck(fx, card({ type, status }), "enum");
    eq(r.errors, [], `${type}/${status} errors`);
    if (status === "obsolete") eq(r.fields.status, "discarded", "obsolete is read as discarded");
  }
});
await test("card check: schema parity (checkCard agrees with card-frontmatter.schema.json on a corpus of frontmatters)", async () => {
  ok(fsx && typeof fsx.validate === "function", "fsx.validate is available");
  const fx = await sandbox("basic");
  const corpus = [
    V2_FM, { ...V2_FM, status: "obsolete" }, { ...V2_FM, rigor: "normal", rigor_reasons: "S2", depends_on: "x", supersedes: "y" }, { ...V2_FM, run_id: "r-1", docs_sha: "abc", shipped_sha: "def" },
    { ...V2_FM, affected_frds: "frd-01-alpha" }, { ...V2_FM, unknown_extra: "tolerated" },
    { ...V2_FM, type: "epic" }, { ...V2_FM, status: "parked" }, { ...V2_FM, class: "x" }, { ...V2_FM, engine: "v3" }, { ...V2_FM, rigor: "huge" },
  ];
  for (const front of corpus) {
    const schemaOk = fsx.validate(cardSchema, JSON.parse(JSON.stringify(front))).ok;
    const r = await runCheck(fx, card(front), "parity");
    ok(schemaOk === (r.errors.length === 0), `parity for ${txt(front)}: schema ok=${schemaOk}, checkCard errors=${txt(r.errors)}`);
  }
});
await test("card check: v1-only fields on a v2 card are never accepted silently; extra fields are tolerated", async () => {
  const fx = await sandbox("basic");
  let r = await runCheck(fx, card({ integration_paths: ["src/a.ts"] }), "v1-field"); ok(r.errors.length + r.warnings.length > 0 && has([r.errors, r.warnings], /integration_paths/), `integration_paths on a v2 card is reported: ${txt(r)}`);
  r = await runCheck(fx, card({ integration_transaction: "tx-1" }), "v1-tx"); ok(r.errors.length + r.warnings.length > 0 && has([r.errors, r.warnings], /integration_transaction/), `integration_transaction on a v2 card is reported: ${txt(r)}`);
  r = await runCheck(fx, card({ my_note: "hola" }), "extra"); eq(r.errors, [], "extra field tolerated"); eq(r.fields.my_note, "hola", "extra field passed through in fields");
});
await test("card check: the status quo card shape of the fixture cards (MC consumers) parses, even though their body lacks Dentro/Fuera", async () => {
  const fx = await sandbox("card");
  const r = await runCheck(fx, await readFile(path.join(fx.root, CHANGES, "add-filter.md"), "utf8"), "legacy-shape");
  ok(!has(r.errors, /type|status/i), `the frontmatter of existing cards is valid (type/status/class enums): ${txt(r.errors)}`);
  ok(has(r.errors, /dentro/i) || has(r.warnings, /dentro/i), `a body without Dentro is reported: ${txt(r)}`);
});
await test("card check is read-only", async () => {
  const fx = await sandbox("basic"); const f = await writeCard(fx, "ro-card", {});
  const before = await snapshot(fx.root); const mod = await load("card.mjs"); await mod.checkCard(f, { env: fx.env() });
  eq(await snapshot(fx.root), before, "tree unchanged");
});

// ==== card archive (A3, D18) ============================================================================================
const SHA = "a".repeat(40); const SHA2 = "b".repeat(40);
const fmOf = (text) => Object.fromEntries([...(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").split("\n")].map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
await test("archiveCard: card in inbox/changes -> status done + shipped_sha, moved to done/", async () => {
  const fx = await sandbox("basic"); await writeCard(fx, "ship-me", { status: "building", run_id: "r-1" });
  await runArchive(fx, "ship-me", SHA);
  ok(!(await exists(path.join(fx.root, CHANGES, "ship-me.md"))), "removed from changes/");
  const f = path.join(fx.root, CHANGES, "done", "ship-me.md"); ok(await exists(f), "present in changes/done/");
  const t = await readFile(f, "utf8"); const front = fmOf(t);
  eq(front.status, "done", "status"); eq(front.shipped_sha, SHA, "shipped_sha"); ok(/# Filtro por estado/.test(t), "body preserved");
  eq(front.run_id, "r-1", "other fields preserved");
});
await test("archiveCard is idempotent: archiving again, or a card already moved by DR-147's reconciler, is never an error", async () => {
  const fx = await sandbox("basic"); await writeCard(fx, "ship-me", { status: "building" });
  await runArchive(fx, "ship-me", SHA); const f = path.join(fx.root, CHANGES, "done", "ship-me.md"); const once = await readFile(f, "utf8");
  await runArchive(fx, "ship-me", SHA2);
  const twice = await readFile(f, "utf8"); eq(twice, once, "a second archive changes nothing (shipped_sha already present is kept)");
  await writeCard(fx, "moved-already", { status: "done" }, GOOD_BODY, `${CHANGES}/done`);
  await runArchive(fx, "moved-already", SHA);
  const front = fmOf(await readFile(path.join(fx.root, CHANGES, "done", "moved-already.md"), "utf8"));
  eq(front.shipped_sha, SHA, "shipped_sha added only when missing"); eq(front.status, "done", "status stays done");
  ok(!(await exists(path.join(fx.root, CHANGES, "moved-already.md"))), "no copy left in changes/");
});
await test("archiveCard: in neither place is not an error and creates nothing", async () => {
  const fx = await sandbox("basic"); const before = await snapshot(fx.root);
  await runArchive(fx, "ghost-card", SHA);
  const after = await snapshot(fx.root);
  eq(Object.keys(after).filter((k) => /ghost-card/.test(k)), [], "no ghost card materialized"); eq(Object.keys(before).length, Object.keys(after).length, "nothing else created");
});
await test("archived cards still parse for the consumers: type/status/H1 intact, status done is in the enum", async () => {
  const fx = await sandbox("basic"); await writeCard(fx, "ship-me", { status: "building" });
  await runArchive(fx, "ship-me", SHA);
  const r = await runCheck(fx, await readFile(path.join(fx.root, CHANGES, "done", "ship-me.md"), "utf8"), "after-archive");
  eq(r.errors, [], "archived card has no errors"); eq(r.fields.status, "done", "status");
});

// ==== cleanup + result ==================================================================================================
for (const d of sandboxes) await rm(d, { recursive: true, force: true });
console.log(`RESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
