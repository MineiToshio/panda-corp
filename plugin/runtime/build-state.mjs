import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const iso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
const tokenHash = (token) => createHash("sha256").update(String(token)).digest("hex");
const paths = (project) => {
  const run = path.join(project, ".pandacorp", "run");
  return { run, leaseDir: path.join(run, "build.lease"), lease: path.join(run, "build.lease", "lease.json"), epoch: path.join(run, "lease-epoch"), mutex: path.join(run, "lease-mutation.lock"), ledger: path.join(run, "run-ledger.json"), audit: path.join(run, "run-ledger.jsonl"), status: path.join(project, ".pandacorp", "status.yaml") };
};
const assertSafeLayout = async (project, { allowMissingRun = false } = {}) => {
  const p = paths(project);
  for (const [label, target, optional] of [[".pandacorp", path.dirname(p.status), false], ["status.yaml", p.status, false], ["run", p.run, allowMissingRun]]) {
    let entry;
    try { entry = await lstat(target); } catch (error) { if (optional && error.code === "ENOENT") continue; throw Object.assign(new Error(`${label} is unavailable`), { code: "INVALID_PATH" }); }
    if (entry.isSymbolicLink() || (label === "status.yaml" ? !entry.isFile() : !entry.isDirectory())) throw Object.assign(new Error(`${label} must be a real ${label === "status.yaml" ? "file" : "directory"}, not a symlink`), { code: "INVALID_PATH" });
  }
  return p;
};
const parseJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const atomicJson = async (file, value) => {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
};
const atomicText = async (file, value) => {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, value, { mode: 0o600 }); await rename(tmp, file);
};
const withMutex = async (p, fn, attempts = 100) => {
  const owner = `${process.pid}-${randomBytes(12).toString("hex")}`;
  const ownerFile = path.join(p, "owner.json");
  for (let i = 0; i < attempts; i++) {
    try {
      await mkdir(p);
      await atomicJson(ownerFile, { owner, acquired_at: iso() });
      try { return await fn(); }
      finally {
        const current = await parseJson(ownerFile).catch(() => null);
        if (current?.owner === owner) await rm(p, { recursive: true, force: true });
      }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const age = Date.now() - Number((await stat(p).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs);
      if (age > 60_000) {
        const tomb = `${p}.stale-${owner}`;
        try { await rename(p, tomb); await rm(tomb, { recursive: true, force: true }); } catch (reclaimError) { if (!new Set(["ENOENT", "EEXIST"]).has(reclaimError.code)) throw reclaimError; }
      }
      await sleep(10);
    }
  }
  throw Object.assign(new Error("lease mutation mutex busy"), { code: "CONTENDED" });
};
const yamlSet = async (file, updates) => {
  let body = await readFile(file, "utf8");
  for (const [key, raw] of Object.entries(updates)) {
    const value = typeof raw === "boolean" || typeof raw === "number" || key === "phase" && new Set(["implementation", "release"]).has(raw) ? String(raw) : JSON.stringify(raw);
    const line = `${key}: ${value}`;
    const re = new RegExp(`^${key}:.*$`, "gm");
    let first = true; let found = false;
    body = body.replace(re, () => { found = true; if (first) { first = false; return line; } return ""; });
    if (!found) body = `${body.replace(/\s*$/, "")}\n${line}\n`;
  }
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, body); await rename(tmp, file);
};
async function reassertActiveProjection(project, lease, { running = true } = {}) {
  if (!lease || !new Set(["claude", "codex"]).has(lease.runtime) || typeof lease.run_id !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(lease.run_id) || !Number.isSafeInteger(lease.epoch) || lease.epoch < 1 || !Number.isFinite(Date.parse(lease.acquired_at)) || !Number.isFinite(Date.parse(lease.renewed_at))) {
    throw Object.assign(new Error("active lease cannot project canonical build state"), { code: "INVALID_STATE" });
  }
  const phase = lease.project_phase || "implementation";
  if (!new Set(["implementation", "release"]).has(phase)) throw Object.assign(new Error("active lease has invalid project phase"), { code: "INVALID_STATE" });
  await yamlSet(paths(project).status, {
    phase,
    running,
    run_started_at: lease.acquired_at,
    build_run_id: lease.run_id,
    build_runtime: lease.runtime,
    build_lease_epoch: lease.epoch,
    supervisor_heartbeat: running ? lease.renewed_at : "",
  });
}
export const currentLease = async (project) => { try { return await parseJson(paths(project).lease); } catch { return null; } };
export const isFresh = (lease, now = Date.now()) => Boolean(lease && Number.isFinite(Date.parse(lease.renewed_at)) && now - Date.parse(lease.renewed_at) < lease.ttl_seconds * 1000);
export const assertFence = async (project, token, epoch, { allowQuiesced = false } = {}) => {
  const lease = await currentLease(project);
  if (!lease || typeof token !== "string" || lease.token_hash !== tokenHash(token) || lease.epoch !== Number(epoch)) throw Object.assign(new Error("stale or foreign lease fence"), { code: "FENCE" });
  if (lease.quiesced_at && !allowQuiesced) throw Object.assign(new Error("lease is quiesced and accepts only finalization"), { code: "QUIESCED" });
  return lease;
};
export const withFence = async (project, token, epoch, mutation) => { const p = await assertSafeLayout(project); return withMutex(p.mutex, async () => { const lease = await assertFence(project, token, epoch); return mutation(lease); }); };
async function acquireUnlocked(project, { runtime, runId, ttlSeconds = 600, token = randomBytes(24).toString("hex") }) {
  if (!new Set(["claude", "codex"]).has(runtime) || typeof runId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(runId) || !Number.isInteger(ttlSeconds) || ttlSeconds < 3) throw Object.assign(new Error("invalid acquire arguments"), { code: "USAGE" });
  const p = paths(project); await mkdir(p.run, { recursive: true }); const priorStatus = await readFile(p.status, "utf8");
  try { await mkdir(p.leaseDir); } catch (error) { if (error.code === "EEXIST") throw Object.assign(new Error("lease already held"), { code: "CONTENDED" }); throw error; }
  try {
    const previous = Number.parseInt((await readFile(p.epoch, "utf8").catch(() => "0")).trim(), 10) || 0;
    const epoch = previous + 1; await atomicText(p.epoch, `${epoch}\n`);
    const now = iso(); const lease = { version: 1, runtime, run_id: runId, token_hash: tokenHash(token), epoch, acquired_at: now, renewed_at: now, ttl_seconds: ttlSeconds, project_phase: "implementation" };
    await atomicJson(p.lease, lease); await reassertActiveProjection(project, lease);
    return { ...lease, token };
  } catch (error) {
    try { await atomicText(p.status, priorStatus); }
    catch (rollbackError) { throw Object.assign(new Error(`lease projection failed and status rollback failed: ${rollbackError.message}`), { code: "ROLLBACK_FAILED", cause: error }); }
    await rm(p.leaseDir, { recursive: true, force: true }); throw error;
  }
}
export async function acquire(project, options) { const p = await assertSafeLayout(project, { allowMissingRun: true }); await mkdir(p.run, { recursive: true }); await assertSafeLayout(project); return withMutex(p.mutex, () => acquireUnlocked(project, options)); }
export async function renew(project, token, epoch) { return withFence(project, token, epoch, async (lease) => { const next = { ...lease, renewed_at: iso() }; await atomicJson(paths(project).lease, next); await reassertActiveProjection(project, next); return next; }); }
export async function quiesce(project, token, epoch) { return withFence(project, token, epoch, async (lease) => { const next = { ...lease, quiesced_at: iso() }; await atomicJson(paths(project).lease, next); await reassertActiveProjection(project, next, { running: false }); return next; }); }
export async function finalizeRelease(project, token, epoch) { const p = await assertSafeLayout(project); return withMutex(p.mutex, async () => { const lease = await assertFence(project, token, epoch, { allowQuiesced: true }); if (!lease.quiesced_at) throw Object.assign(new Error("lease must be quiesced before final release"), { code: "INVALID_STATE" }); const tomb = `${p.leaseDir}.released-${lease.epoch}-${process.pid}`; await rename(p.leaseDir, tomb); await rm(tomb, { recursive: true, force: true }); return lease; }); }
// Compatibility wrapper for callers that do not own a git commit boundary. Certified executors use
// quiesce -> commit the running:false projection -> finalizeRelease, so no writer-free commit window
// exists. This wrapper remains fenced but does not provide that stronger commit guarantee.
export async function release(project, token, epoch) { await quiesce(project, token, epoch); return finalizeRelease(project, token, epoch); }
export async function reclaim(project, { runtime, runId, ttlSeconds = 600 }) {
  const p = await assertSafeLayout(project);
  return withMutex(p.mutex, async () => {
    const old = await currentLease(project); if (!old) throw Object.assign(new Error("no lease to reclaim"), { code: "FENCE" });
    if (isFresh(old)) throw Object.assign(new Error("lease is still fresh"), { code: "CONTENDED" });
    const tomb = `${p.leaseDir}.stale-${old.epoch}-${process.pid}`; await rename(p.leaseDir, tomb); await rm(tomb, { recursive: true, force: true });
    return acquireUnlocked(project, { runtime, runId, ttlSeconds });
  });
}
const blankLedger = (lease) => ({ version: 1, run_id: lease.run_id, epoch: lease.epoch, dispatch_count: 0, spend_units: 0, consecutive_blocks: 0, dispatches: {}, updated_at: iso() });
export const readLedger = async (project, lease) => {
  try {
    const value = await parseJson(paths(project).ledger);
    return value.run_id === lease.run_id ? { ...value, epoch: lease.epoch } : blankLedger(lease);
  } catch (error) {
    if (error.code === "ENOENT") return blankLedger(lease);
    throw Object.assign(new Error("durable run ledger is corrupt"), { code: "LEDGER_CORRUPT" });
  }
};
const audit = async (project, event) => { const h = await open(paths(project).audit, "a", 0o600); try { await h.appendFile(`${JSON.stringify({ at: iso(), ...event })}\n`); await h.sync(); } finally { await h.close(); } };
export async function reserveDispatch(project, token, epoch, { id, units, limit }) {
  if (typeof id !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(id) || !Number.isSafeInteger(units) || units < 1 || !Number.isSafeInteger(limit) || limit < 0) throw Object.assign(new Error("invalid dispatch reservation"), { code: "USAGE" });
  return withFence(project, token, epoch, async (lease) => { const ledger = await readLedger(project, lease); if (ledger.dispatches[id]) return ledger; if (ledger.spend_units + units > limit) throw Object.assign(new Error("durable spend limit exceeded"), { code: "SPEND" }); ledger.dispatches[id] = { units, reserved_at: iso() }; ledger.dispatch_count++; ledger.spend_units += units; ledger.updated_at = iso(); await atomicJson(paths(project).ledger, ledger); await audit(project, { event: "dispatch_reserved", run_id: lease.run_id, epoch: lease.epoch, dispatch_id: id, units }); return ledger; });
}
export async function setHealth(project, token, epoch, consecutiveBlocks) {
  if (!Number.isSafeInteger(consecutiveBlocks) || consecutiveBlocks < 0) throw Object.assign(new Error("invalid health value"), { code: "USAGE" });
  return withFence(project, token, epoch, async (lease) => { const ledger = await readLedger(project, lease); ledger.consecutive_blocks = consecutiveBlocks; ledger.updated_at = iso(); await atomicJson(paths(project).ledger, ledger); await audit(project, { event: "health_set", run_id: lease.run_id, epoch: lease.epoch, consecutive_blocks: consecutiveBlocks }); return ledger; });
}

const fmStatus = (body) => body.match(/^implementation_status:\s*(PLANNED|IN_PROGRESS|IN_REVIEW|VERIFIED|BLOCKED)\s*$/m)?.[1] || null;
const setFmStatus = (body, status) => /^implementation_status:/m.test(body) ? body.replace(/^implementation_status:.*$/m, `implementation_status: ${status}`) : body.replace(/^---\s*$/m, `---\nimplementation_status: ${status}`);
const setFmKey = (body, key, value) => { const line = `${key}: ${value}`; const re = new RegExp(`^${key}:.*$`, "m"); return re.test(body) ? body.replace(re, line) : body.replace(/^---\s*$/m, `---\n${line}`); };
const rollup = (states) => states.every((s) => s === "VERIFIED") ? "VERIFIED" : states.some((s) => s === "BLOCKED") ? "BLOCKED" : states.some((s) => s === "PLANNED") ? "PLANNED" : states.some((s) => s === "IN_PROGRESS") ? "IN_PROGRESS" : "IN_REVIEW";
async function syncRollupsUnlocked(project, lease) {
    const root = path.join(project, "docs", "frds"); const folders = (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const counts = { PLANNED: 0, IN_PROGRESS: 0, IN_REVIEW: 0, VERIFIED: 0, BLOCKED: 0 }; let corrected = 0;
    for (const folder of folders) {
      const woDir = path.join(root, folder, "work-orders"); let names; try { names = (await readdir(woDir)).filter((n) => /^wo-.*\.md$/.test(n)).sort(); } catch { continue; }
      const states = [];
      for (const name of names) { const state = fmStatus(await readFile(path.join(woDir, name), "utf8")); if (!state) throw Object.assign(new Error(`missing implementation_status: ${folder}/${name}`), { code: "INVALID_STATE" }); states.push(state); counts[state]++; }
      if (!states.length) continue; const desired = rollup(states);
      for (const doc of ["frd.md", "blueprint.md"]) { const file = path.join(root, folder, doc); const body = await readFile(file, "utf8"); if (fmStatus(body) !== desired) { await atomicText(file, setFmStatus(body, desired)); corrected++; } }
    }
    const now = iso(); const total = Object.values(counts).reduce((a, b) => a + b, 0);
    await yamlSet(paths(project).status, { work_orders_total: total, work_orders_done: counts.VERIFIED, work_orders_planned: counts.PLANNED, work_orders_in_progress: counts.IN_PROGRESS, work_orders_in_review: counts.IN_REVIEW, work_orders_blocked: counts.BLOCKED, work_orders_verified: counts.VERIFIED, last_event_at: now, updated_at: now });
    await reassertActiveProjection(project, lease);
    return { corrected, total, counts, at: now };
}
export async function syncRollups(project, token, epoch) { return withFence(project, token, epoch, (lease) => syncRollupsUnlocked(project, lease)); }
export async function transitionWorkOrder(project, token, epoch, { file, to, reason = "" }) {
  const allowed = new Set(["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"]);
  return withFence(project, token, epoch, async (lease) => {
    const absolute = path.resolve(project, file); const root = path.resolve(project, "docs/frds");
    if (!absolute.startsWith(`${root}${path.sep}`) || !/\/work-orders\/wo-[^/]+\.md$/.test(absolute) || !allowed.has(to)) throw Object.assign(new Error("invalid governed WO transition"), { code: "INVALID_STATE" });
    const [actual, actualRoot, entry] = await Promise.all([realpath(absolute), realpath(root), lstat(absolute)]).catch(() => { throw Object.assign(new Error("governed WO path is unavailable"), { code: "INVALID_PATH" }); });
    const expectedReal = path.join(actualRoot, path.relative(root, absolute));
    if (entry.isSymbolicLink() || !entry.isFile() || !actual.startsWith(`${actualRoot}${path.sep}`) || actual !== expectedReal) throw Object.assign(new Error("governed WO path must be a real in-tree file"), { code: "INVALID_PATH" });
    let body = await readFile(actual, "utf8"); const from = fmStatus(body); if (!from) throw Object.assign(new Error("source WO status missing"), { code: "INVALID_STATE" });
    const transitions = { PLANNED: ["IN_PROGRESS", "BLOCKED"], IN_PROGRESS: ["IN_REVIEW", "BLOCKED", "PLANNED"], IN_REVIEW: ["VERIFIED", "PLANNED", "BLOCKED"], BLOCKED: ["PLANNED"], VERIFIED: [] };
    if (from !== to && !transitions[from].includes(to)) throw Object.assign(new Error(`illegal WO transition ${from}->${to}`), { code: "INVALID_STATE" });
    body = setFmStatus(body, to); if (to === "BLOCKED") body = setFmKey(body, "blocked_reason", reason || "error"); else if (/^blocked_reason:/m.test(body)) body = body.replace(/^blocked_reason:.*\n?/m, "");
    if (to === "PLANNED" && from === "IN_REVIEW") { const current = Number(body.match(/^reopen_count:\s*(\d+)/m)?.[1] || 0); body = setFmKey(body, "reopen_count", current + 1); }
    if (to === "VERIFIED") body = setFmKey(body, "reopen_count", 0);
    await atomicText(actual, body); const derived = await syncRollupsUnlocked(project, lease); return { file, from, to, derived };
  });
}
export async function stampLastGreen(project, token, epoch, sha) {
  return withFence(project, token, epoch, async (lease) => {
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw Object.assign(new Error("invalid git sha"), { code: "INVALID_STATE" });
    try {
      await execFileAsync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: project });
      await execFileAsync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: project });
    } catch {
      throw Object.assign(new Error("last green commit must exist and be an ancestor of HEAD"), { code: "EVIDENCE" });
    }
    const now = iso();
    await yamlSet(paths(project).status, { last_green_sha: sha, safe_to_test: true, last_event_at: now, updated_at: now }); await reassertActiveProjection(project, lease);
    return { sha, safe_to_test: true };
  });
}
export async function setProjectPhase(project, token, epoch, phase) {
  return withFence(project, token, epoch, async (lease) => { if (!new Set(["implementation", "release"]).has(phase)) throw Object.assign(new Error("invalid phase"), { code: "INVALID_STATE" }); if (phase === "release") { const dirs = await readdir(path.join(project, "docs/frds"), { withFileTypes: true }); for (const d of dirs.filter((x) => x.isDirectory())) { const body = await readFile(path.join(project, "docs/frds", d.name, "frd.md"), "utf8"); if (fmStatus(body) !== "VERIFIED") throw Object.assign(new Error(`release blocked by ${d.name}`), { code: "INVALID_STATE" }); } const day=new Date().toISOString().slice(0,10); try { await readFile(path.join(project,"docs/reviews",`security-${day}.md`),"utf8"); const analytics=await readFile(path.join(project,"docs/analytics/events.md"),"utf8"); if(!/^## Verification/m.test(analytics)) throw new Error("telemetry evidence missing"); } catch(error){ throw Object.assign(new Error(`release evidence missing: ${error.message}`),{code:"INVALID_STATE"}); } } const next = { ...lease, project_phase: phase }; await atomicJson(paths(project).lease, next); await reassertActiveProjection(project, next); await yamlSet(paths(project).status, { updated_at: iso() }); return { phase }; });
}
export async function pauseForOwner(project, token, epoch, { subject, summary }) {
  return withFence(project, token, epoch, async (lease) => { const now=iso(); const decision=path.join(project,".pandacorp/inbox/decisions.md"); const progress=path.join(project,".pandacorp/comms/progress.md"); await mkdir(path.dirname(decision),{recursive:true}); await mkdir(path.dirname(progress),{recursive:true}); await appendFileSafe(decision,`\n## ${now} — ${subject}\n\n${summary}\n\nStatus: pending\n`); await appendFileSafe(progress,`\n- ${now}: detenido en punto seguro — ${subject}: ${summary}\n`); await yamlSet(paths(project).status,{pending_decisions:1,last_event_at:now,updated_at:now}); await reassertActiveProjection(project,lease); return {paused:true}; });
}
async function appendFileSafe(file,text){const h=await open(file,"a",0o600);try{await h.appendFile(text);await h.sync();}finally{await h.close();}}

const changeStatus = (body) => body.match(/^status:\s*(draft|ready|building|done)\s*$/m)?.[1] || null;
const frontmatterValue = (body, key) => body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
const listScalar = (value = "") => value.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter((item) => item && item !== "—" && item !== "-");
const parsePlanRows = (body) => { const heading = /^##(?:\s+\d+\.)?\s+Build Plan[^\n]*$/mi.exec(body); if (!heading) return null; const rest = body.slice(heading.index + heading[0].length); const end = rest.search(/^##\s/m); const section = end < 0 ? rest : rest.slice(0, end); const rows = new Map(); for (const line of section.split("\n")) { if (!/^\|\s*WO-[A-Za-z0-9-]+\s*\|/.test(line)) continue; const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/`/g, "")); rows.set(cells[0], listScalar(cells[1])); } return rows; };
const invalidPath = (message) => Object.assign(new Error(message), { code: "INVALID_PATH" });
async function assertRealEntry(project, absolute, { type, allowMissing = false } = {}) {
  const projectAbsolute = path.resolve(project); const target = path.resolve(absolute);
  if (target !== projectAbsolute && !target.startsWith(`${projectAbsolute}${path.sep}`)) throw invalidPath("path escapes project");
  const projectReal = await realpath(projectAbsolute).catch(() => { throw invalidPath("project root is unavailable"); });
  let entry;
  try { entry = await lstat(target); }
  catch (error) {
    if (!allowMissing || error.code !== "ENOENT") throw invalidPath("governed path is unavailable");
    const parent = path.dirname(target); const parentEntry = await lstat(parent).catch(() => { throw invalidPath("governed parent is unavailable"); });
    const parentReal = await realpath(parent).catch(() => { throw invalidPath("governed parent is unavailable"); });
    const expectedParent = path.join(projectReal, path.relative(projectAbsolute, parent));
    if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory() || parentReal !== expectedParent) throw invalidPath("governed parent must be a real in-tree directory");
    return { absolute: target, exists: false, real: path.join(parentReal, path.basename(target)) };
  }
  const actual = await realpath(target).catch(() => { throw invalidPath("governed path is unavailable"); });
  const expected = path.join(projectReal, path.relative(projectAbsolute, target));
  const rightType = type === "directory" ? entry.isDirectory() : type === "file" ? entry.isFile() : true;
  if (entry.isSymbolicLink() || !rightType || actual !== expected) throw invalidPath(`governed ${type || "entry"} must be real and in-tree`);
  return { absolute: target, exists: true, real: actual };
}
async function safeChangeRoot(project, { createDone = false } = {}) {
  const root = path.resolve(project, ".pandacorp/inbox/changes"); await assertRealEntry(project, root, { type: "directory" });
  const done = path.join(root, "done");
  if (createDone) { try { await assertRealEntry(project, done, { type: "directory" }); } catch (error) { if (error.code !== "INVALID_PATH" || await lstat(done).then(() => true).catch(() => false)) throw error; await mkdir(done); await assertRealEntry(project, done, { type: "directory" }); } }
  return { root, done };
}
const safeChangeFile = async (project, file) => { const { root } = await safeChangeRoot(project); const absolute = path.resolve(project, file); if (!absolute.startsWith(`${root}${path.sep}`) || path.dirname(absolute) !== root || !/^[a-z0-9-]+\.md$/.test(path.basename(absolute)) || path.basename(absolute) === "README.md") throw invalidPath("invalid active change card path"); await assertRealEntry(project, absolute, { type: "file" }); return absolute; };
const validateFrd = (value) => { if (typeof value !== "string" || !/^frd-[a-z0-9-]+$/.test(value)) throw Object.assign(new Error(`invalid affected FRD ${value}`), { code: "INVALID_STATE" }); return value; };
const assertCanonicalCommit = async (project, sha, frds, { requiredPaths = [], requireHead = false, compareContent = false } = {}) => { if (!/^[0-9a-f]{7,40}$/.test(sha)) throw Object.assign(new Error("invalid integration sha"), { code: "EVIDENCE" }); try { await execFileAsync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: project }); await execFileAsync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: project }); if (requireHead) { const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: project }); const { stdout: full } = await execFileAsync("git", ["rev-parse", sha], { cwd: project }); if (head.trim() !== full.trim()) throw new Error("integration commit is not current HEAD"); } const { stdout } = await execFileAsync("git", ["show", "--pretty=", "--name-only", sha], { cwd: project }); const files = stdout.split("\n").filter(Boolean); for (const frd of frds) if (!files.some((file) => file.startsWith(`docs/frds/${frd}/`))) throw new Error(`commit does not touch affected ${frd}`); for (const file of requiredPaths) { if (!files.includes(file)) throw new Error(`commit omits planned mutation ${file}`); if (compareContent) { const [{ stdout: committed }, current] = await Promise.all([execFileAsync("git", ["show", `${sha}:${file}`], { cwd: project }), readFile(path.join(project, file), "utf8")]); if (committed !== current) throw new Error(`commit content differs from planned mutation ${file}`); } } return true; } catch (error) { throw Object.assign(new Error(`integration commit evidence failed: ${error.message}`), { code: "EVIDENCE" }); } };
const normalizeGovernedProgress = (body) => {
  if (!body.startsWith("---\n")) return body;
  const close = body.indexOf("\n---", 4);
  if (close < 0) return body;
  const frontmatter = body.slice(0, close).replace(/^(implementation_status|blocked_reason|reopen_count):.*\n?/gm, "");
  return `${frontmatter}${body.slice(close)}`;
};
const assertCurrentIntegration = async (project, sha, requiredPaths) => { try { for (const file of requiredPaths) { const absolute = path.join(project, file); await assertRealEntry(project, absolute, { type: "file" }); const [{ stdout: committed }, current] = await Promise.all([execFileAsync("git", ["show", `${sha}:${file}`], { cwd: project }), readFile(absolute, "utf8")]); if (normalizeGovernedProgress(committed) !== normalizeGovernedProgress(current)) throw new Error(`current canonical content drifted from integration ${file}`); } } catch (error) { if (error.code === "INVALID_PATH") throw error; throw Object.assign(new Error(`current integration evidence failed: ${error.message}`), { code: "EVIDENCE" }); } };
const validateApplyTransaction = async (project, body, changeFile) => {
  const txId = frontmatterValue(body, "integration_transaction").replace(/^['"]|['"]$/g, "");
  if (!/^apply-[0-9a-f]{24}$/.test(txId)) throw Object.assign(new Error("change lacks a bound apply transaction"), { code: "EVIDENCE" });
  const txRoot = await safeChangeTxRoot(project);
  const txFile = path.join(txRoot, `${txId}.json`);
  await assertRealEntry(project, txFile, { type: "file" });
  const tx = await parseJson(txFile).catch((error) => { throw Object.assign(new Error(`apply transaction evidence is corrupt: ${error.message}`), { code: "EVIDENCE" }); });
  if (tx.type !== "apply" || tx.id !== txId || tx.stage !== "complete" || changeTxId("apply", tx.plan) !== txId) throw Object.assign(new Error("apply transaction evidence does not match its durable digest"), { code: "EVIDENCE" });
  if (changeFile && tx.plan.changeFile !== changeFile) throw Object.assign(new Error("apply transaction is bound to another change card"), { code: "EVIDENCE" });
  return tx.plan;
};
const validateArchiveEvidence = async (project, body, { changeFile = "" } = {}) => {
  const frds = listScalar(frontmatterValue(body, "affected_frds")).map(validateFrd);
  if (!frds.length) throw Object.assign(new Error("change lacks affected FRDs"), { code: "EVIDENCE" });
  const sha = frontmatterValue(body, "integration_sha").replace(/^['"]|['"]$/g, "");
  const requiredPaths = listScalar(frontmatterValue(body, "integration_paths"));
  if (!requiredPaths.length) throw Object.assign(new Error("change lacks bound integration paths"), { code: "EVIDENCE" });
  const plan = await validateApplyTransaction(project, body, changeFile);
  const plannedFrds = [...new Set(plan.affectedFrds.map(validateFrd))].sort();
  const plannedPaths = [...new Set(plan.mutations.map((item) => item.target))].sort();
  if (JSON.stringify([...new Set(frds)].sort()) !== JSON.stringify(plannedFrds) || JSON.stringify([...new Set(requiredPaths)].sort()) !== JSON.stringify(plannedPaths)) throw Object.assign(new Error("change card evidence drifted from its durable apply plan"), { code: "EVIDENCE" });
  await assertCanonicalCommit(project, sha, frds, { requiredPaths });
  await assertCurrentIntegration(project, sha, requiredPaths);
  return { frds, sha, requiredPaths };
};
const changeTxRoot = (project) => path.join(project, ".pandacorp/run/change-transactions");
async function safeChangeTxRoot(project, { create = false } = {}) { const root = changeTxRoot(project); if (create && !await lstat(root).then(() => true).catch(() => false)) await mkdir(root); await assertRealEntry(project, root, { type: "directory" }); return root; }
const changeTxId = (type, value) => `${type}-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24)}`;
const injectedCrash = (wanted, boundary) => { if (wanted === boundary) throw Object.assign(new Error(`injected change transaction crash at ${boundary}`), { code: "CRASH_TEST" }); };

export async function applyChangePlan(project, token, epoch, { changeFile, affectedFrds, mutations, reopenWorkOrders = [], faultAfter = "" }) {
  if (!Array.isArray(affectedFrds) || !affectedFrds.length || !Array.isArray(mutations) || !Array.isArray(reopenWorkOrders)) throw Object.assign(new Error("invalid change plan payload"), { code: "USAGE" });
  const frds = [...new Set(affectedFrds.map(validateFrd))].sort();
  return withFence(project, token, epoch, async (lease) => {
    const card = await safeChangeFile(project, changeFile); let cardBody = await readFile(card, "utf8"); if (!new Set(["ready", "building"]).has(changeStatus(cardBody))) throw Object.assign(new Error("change card is not drainable"), { code: "INVALID_STATE" });
    const docsRoot = path.resolve(project, "docs/frds"); await assertRealEntry(project, docsRoot, { type: "directory" });
    const proposed = new Map();
    for (const mutation of mutations) {
      if (!mutation || typeof mutation.target !== "string" || typeof mutation.content !== "string") throw Object.assign(new Error("invalid change mutation"), { code: "USAGE" });
      const target = path.resolve(project, mutation.target); const docs = path.resolve(project, "docs/frds"); const relative = path.relative(docs, target); const frd = relative.split(path.sep)[0];
      if (relative.startsWith("..") || !frds.includes(frd) || !/^frd-[a-z0-9-]+\/(frd|blueprint|fdd)\.md$/.test(relative.replaceAll(path.sep, "/")) && !/^frd-[a-z0-9-]+\/work-orders\/wo-[^/]+\.md$/.test(relative.replaceAll(path.sep, "/"))) throw Object.assign(new Error(`change mutation escapes affected FRDs: ${mutation.target}`), { code: "INVALID_PATH" });
      await assertRealEntry(project, target, { type: "file", allowMissing: true });
      proposed.set(target, mutation.content.endsWith("\n") ? mutation.content : `${mutation.content}\n`);
    }
    const reopen = new Set(reopenWorkOrders);
    for (const frd of frds) {
      const root = path.join(project, "docs/frds", frd); await assertRealEntry(project, root, { type: "directory" }); const blueprintFile = path.join(root, "blueprint.md"); await assertRealEntry(project, blueprintFile, { type: "file" }); const blueprint = proposed.get(blueprintFile) ?? await readFile(blueprintFile, "utf8"); const rows = parsePlanRows(blueprint); if (!rows?.size) throw Object.assign(new Error(`${frd} proposed Build Plan has no DAG rows`), { code: "PLAN" });
      const woDir = path.join(root, "work-orders"); await assertRealEntry(project, woDir, { type: "directory" }); const names = new Set((await readdir(woDir)).filter((name) => /^wo-.*\.md$/.test(name))); for (const target of proposed.keys()) if (path.dirname(target) === woDir) names.add(path.basename(target));
      const seen = new Set();
      for (const name of [...names].sort()) { const file = path.join(woDir, name); await assertRealEntry(project, file, { type: "file", allowMissing: proposed.has(file) }); let body = proposed.get(file) ?? await readFile(file, "utf8"); const id = frontmatterValue(body, "id") || name.replace(/\.md$/, ""); if (seen.has(id)) throw Object.assign(new Error(`duplicate WO id ${id}`), { code: "PLAN" }); seen.add(id); if (reopen.has(id)) { body = setFmStatus(body, "PLANNED"); proposed.set(file, body); } const status = fmStatus(body); if (!status) throw Object.assign(new Error(`${id} lacks implementation_status`), { code: "INVALID_STATE" }); if (!rows.has(id)) throw Object.assign(new Error(`${id} missing from ${frd} Build Plan`), { code: "PLAN" }); const deps = listScalar(frontmatterValue(body, "dependsOn") || frontmatterValue(body, "depends_on")); if (JSON.stringify([...deps].sort()) !== JSON.stringify([...rows.get(id)].sort())) throw Object.assign(new Error(`${id} dependency drift after change plan`), { code: "PLAN" }); }
      for (const id of rows.keys()) if (!seen.has(id)) throw Object.assign(new Error(`${frd} Build Plan references missing ${id}`), { code: "PLAN" });
    }
    const durablePlan = { changeFile, affectedFrds: frds, mutations: [...proposed].map(([file, content]) => ({ target: path.relative(project, file), content })), reopenWorkOrders }; const txId = changeTxId("apply", durablePlan); const txFile = path.join(await safeChangeTxRoot(project, { create: true }), `${txId}.json`); await atomicJson(txFile, { version: 1, id: txId, type: "apply", stage: "prepared", plan: durablePlan, updated_at: iso() }); injectedCrash(faultAfter, "prepared");
    let index = 0; for (const [file, body] of proposed) { await assertRealEntry(project, file, { type: "file", allowMissing: true }); await atomicText(file, body); await atomicJson(txFile, { version: 1, id: txId, type: "apply", stage: `mutation:${index}`, plan: durablePlan, updated_at: iso() }); injectedCrash(faultAfter, `mutation:${index}`); index++; }
    cardBody = setFmKey(cardBody, "status", "building"); cardBody = setFmKey(cardBody, "affected_frds", JSON.stringify(frds)); cardBody = setFmKey(cardBody, "integration_paths", JSON.stringify(durablePlan.mutations.map((item) => item.target))); cardBody = setFmKey(cardBody, "integration_transaction", JSON.stringify(txId)); cardBody = setFmKey(cardBody, "integration_sha", '""'); await atomicText(card, cardBody); await atomicJson(txFile, { version: 1, id: txId, type: "apply", stage: "card", plan: durablePlan, updated_at: iso() }); injectedCrash(faultAfter, "card"); await syncRollupsUnlocked(project, lease); await atomicJson(txFile, { version: 1, id: txId, type: "apply", stage: "complete", plan: durablePlan, completed_at: iso(), updated_at: iso() }); return { transaction_id: txId, change_file: path.relative(project, card), affected_frds: frds, mutations: proposed.size, mutation_paths: durablePlan.mutations.map((item) => item.target) };
  });
}

export async function stampChangeIntegration(project, token, epoch, { changeFile, sha }) {
  return withFence(project, token, epoch, async () => { const card = await safeChangeFile(project, changeFile); let body = await readFile(card, "utf8"); if (changeStatus(body) !== "building") throw Object.assign(new Error("change is not building"), { code: "INVALID_STATE" }); const frds = listScalar(frontmatterValue(body, "affected_frds")).map(validateFrd); const requiredPaths = listScalar(frontmatterValue(body, "integration_paths")); if (!requiredPaths.length) throw Object.assign(new Error("change lacks bound integration paths"), { code: "EVIDENCE" }); await validateApplyTransaction(project, body, changeFile); await assertCanonicalCommit(project, sha, frds, { requiredPaths, requireHead: true, compareContent: true }); body = setFmKey(body, "integration_sha", JSON.stringify(sha)); await atomicText(card, body); return { change_file: path.relative(project, card), integration_sha: sha }; });
}

export async function reconcileBuildingChange(project, token, epoch, { changeFile, faultAfter = "" }) {
  return withFence(project, token, epoch, async () => {
    const card = await safeChangeFile(project, changeFile); let body = await readFile(card, "utf8"); if (changeStatus(body) === "done") { await validateArchiveEvidence(project, body, { changeFile }); const { done } = await safeChangeRoot(project, { createDone: true }); const target = path.join(done, path.basename(card)); if ((await assertRealEntry(project, target, { type: "file", allowMissing: true })).exists) throw invalidPath("archive target already exists"); await rename(card, target); return { action: "archive-recovered", target: path.relative(project, target) }; } if (changeStatus(body) !== "building") return { action: "none" }; const frds = listScalar(frontmatterValue(body, "affected_frds")); if (!frds.length) throw Object.assign(new Error("building change lacks affected_frds"), { code: "INVALID_STATE" });
    const states = []; for (const frd of frds.map(validateFrd)) { const frdFile = path.join(project, "docs/frds", frd, "frd.md"); await assertRealEntry(project, frdFile, { type: "file" }); states.push(fmStatus(await readFile(frdFile, "utf8"))); }
    if (states.some((status) => status === "BLOCKED")) { body = setFmKey(body, "status", "ready"); body = setFmKey(body, "note", JSON.stringify("re-opened: an affected FRD is BLOCKED")); await atomicText(card, body); return { action: "reset-ready" }; }
    if (!states.every((status) => status === "VERIFIED")) return { action: "waiting" };
    const { sha } = await validateArchiveEvidence(project, body, { changeFile });
    body = setFmKey(body, "status", "done"); body = setFmKey(body, "shipped_sha", JSON.stringify(sha)); body = setFmKey(body, "shipped_at", JSON.stringify(iso())); const { done: doneDir } = await safeChangeRoot(project, { createDone: true }); const target = path.join(doneDir, path.basename(card)); if ((await assertRealEntry(project, target, { type: "file", allowMissing: true })).exists) throw invalidPath("archive target already exists"); const durable = { changeFile, target: path.relative(project, target), body }; const txId = changeTxId("archive", durable); const txFile = path.join(await safeChangeTxRoot(project, { create: true }), `${txId}.json`); await atomicJson(txFile, { version: 1, id: txId, type: "archive", stage: "prepared", ...durable, updated_at: iso() }); injectedCrash(faultAfter, "archive-prepared"); await atomicText(card, body); await atomicJson(txFile, { version: 1, id: txId, type: "archive", stage: "card", ...durable, updated_at: iso() }); injectedCrash(faultAfter, "archive-card"); await rename(card, target); await atomicJson(txFile, { version: 1, id: txId, type: "archive", stage: "complete", ...durable, completed_at: iso(), updated_at: iso() }); return { action: "archived", transaction_id: txId, target: path.relative(project, target) };
  });
}

export async function recoverChangeTransactions(project, token, epoch) {
  const directory = changeTxRoot(project); let names; try { await safeChangeTxRoot(project); names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort(); } catch (error) { if (error.code === "INVALID_PATH" && !await lstat(directory).then(() => true).catch(() => false)) return []; throw error; } const recovered = [];
  for (const name of names) { const file = path.join(directory, name); await assertRealEntry(project, file, { type: "file" }); const tx = await parseJson(file); if (!new Set(["apply", "archive"]).has(tx.type)) throw Object.assign(new Error("unknown change transaction type"), { code: "EVIDENCE" }); const validStage = tx.type === "apply" ? /^(prepared|card|complete|mutation:\d+)$/.test(tx.stage) : /^(prepared|card|complete)$/.test(tx.stage); if (!validStage) throw Object.assign(new Error("unknown change transaction stage"), { code: "EVIDENCE" }); if (tx.type === "apply" && (tx.id !== name.replace(/\.json$/, "") || changeTxId("apply", tx.plan) !== tx.id)) throw Object.assign(new Error("apply transaction digest mismatch"), { code: "EVIDENCE" }); if (tx.type === "archive" && (tx.id !== name.replace(/\.json$/, "") || changeTxId("archive", { changeFile: tx.changeFile, target: tx.target, body: tx.body }) !== tx.id)) throw Object.assign(new Error("archive transaction digest mismatch"), { code: "EVIDENCE" }); if (tx.stage === "complete") continue; if (tx.type === "apply") { const applied = await applyChangePlan(project, token, epoch, tx.plan); recovered.push({ id: tx.id, action: "apply-replayed", change_file: tx.plan.changeFile, affected_frds: tx.plan.affectedFrds, mutation_paths: applied.mutation_paths }); continue; } if (tx.type === "archive") { await withFence(project, token, epoch, async () => { await validateArchiveEvidence(project, tx.body, { changeFile: tx.changeFile }); const { root, done } = await safeChangeRoot(project, { createDone: true }); const sourceLexical = path.resolve(project, tx.changeFile); if (path.dirname(sourceLexical) !== root || !/^[a-z0-9-]+\.md$/.test(path.basename(sourceLexical))) throw invalidPath("archive transaction source is not canonical"); const expectedTarget = path.join(done, path.basename(sourceLexical)); const target = path.resolve(project, tx.target); if (target !== expectedTarget) throw invalidPath("archive transaction target is not canonical"); const targetState = await assertRealEntry(project, target, { type: "file", allowMissing: true }); if (targetState.exists) { const existing = await readFile(target, "utf8"); if (existing !== tx.body) throw invalidPath("archive target already exists with foreign content"); } else { const source = await safeChangeFile(project, tx.changeFile); const body = await readFile(source, "utf8"); if (changeStatus(body) !== "done") await atomicText(source, tx.body); await rename(source, target); } await atomicJson(file, { ...tx, stage: "complete", completed_at: iso(), updated_at: iso() }); }); recovered.push({ id: tx.id, action: "archive-replayed", change_file: tx.changeFile }); }
  }
  return recovered;
}
