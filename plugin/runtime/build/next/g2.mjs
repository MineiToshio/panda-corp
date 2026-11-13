// G2 snapshot worktrees (B5): every G2 job judges its own detached checkout of a pinned integration sha; the
// consecutive-failure counter that hands an FRD back as an environment failure (NB2); which FRDs need a G2 now.
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, readJson } from "../fsx.mjs";
import { dropBootstrapManifests, frdsReadyForG2 } from "../integrate.mjs";
import { removeWorktree, cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { realOrResolved } from "../integrate/git.mjs";
import { assertSafeId, buildPaths, resolveInside } from "../paths.mjs";
import { withRunCleanup } from "../lifecycle/cleanup.mjs";
import { readState } from "../state.mjs";
import { productPrefix, productRoot } from "../units.mjs";
import { FRD_WORK_KINDS, G2_SNAPSHOT_DIR, G2_SNAPSHOT_FAIL_MAX, G2_SNAPSHOT_RE, GIT_SHOW_TIMEOUT_MS, SHA_RE } from "./constants.mjs";
import { err, fenceOf, integrationRoot, resolveDeps, sibling } from "./context.mjs";

const g2SnapshotRoot = (paths) => path.join(paths.build, G2_SNAPSHOT_DIR);

/** `<build>/g2/<frd>-<sha>`: the frd and sha make it unique per job (one live G2 per FRD, A18). */
function g2SnapshotDir(paths, frd, sha) {
  if (!SHA_RE.test(sha)) throw err("INVALID_STATE", `G2 pin is not a commit sha: ${JSON.stringify(sha)}`);
  return resolveInside(g2SnapshotRoot(paths), `${assertSafeId(frd, "frd id")}-${sha}`);
}

/** The snapshot directory and pinned sha of a G2 job, read back from its `cwd`; null for a job with no snapshot. */
export function g2PinOf(paths, job) {
  if (job?.kind !== "g2" || typeof job.cwd !== "string") return null;
  const root = g2SnapshotRoot(paths);
  const rel = path.relative(root, path.resolve(job.cwd));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const top = rel.split(path.sep)[0];
  const m = G2_SNAPSHOT_RE.exec(top);
  return m ? { dir: path.join(root, top), frd: m[1], sha: m[2] } : null;
}

/** `git <args>` in `cwd`; resolves `{code, stdout, stderr}` (never rejects). */
function gitRun(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: GIT_SHOW_TIMEOUT_MS * 8 }, (error, stdout, stderr) => resolve({ code: error ? (Number.isInteger(error.code) ? error.code : 1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }));
  });
}

async function gitOut(cwd, args) {
  const res = await gitRun(cwd, args);
  if (res.code !== 0) throw err("INVALID_STATE", `git ${args.slice(0, 2).join(" ")} failed in ${cwd}: ${res.stderr.trim().split("\n")[0]}`);
  return res.stdout.trim();
}

/** Registered worktree paths (realpath spelling) of the project's repository. */
async function registeredWorktrees(run) {
  const out = await gitOut(run.ref.project, ["worktree", "list", "--porcelain"]);
  const fs = run.d.fs ?? fsp;
  return Promise.all(out.split("\n").filter((l) => l.startsWith("worktree ")).map((l) => realOrResolved(fs, l.slice(9))));
}

/**
 * Create the detached snapshot worktree of one G2 job at the integration tip (work phase, no mutex). A leftover at the same
 * path (a dead job of the same FRD and sha) is removed first; nothing outside `<build>/g2/` is ever touched.
 * @returns {Promise<{dir: string, cwd: string, sha: string}>} `cwd` is the product root inside the snapshot (nested projects)
 */
export async function createG2Snapshot(run, state, frd) {
  const fs = run.d.fs ?? fsp;
  const branch = state.integration?.branch;
  const viaBranch = branch ? await gitRun(run.ref.project, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`]) : { code: 1 };
  const sha = viaBranch.code === 0 ? viaBranch.stdout.trim() : await gitOut(integrationRoot(run, state), ["rev-parse", "--verify", "HEAD^{commit}"]);
  const dir = g2SnapshotDir(run.paths, frd, sha);
  await removeG2Snapshot(run, dir, { strict: true });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const registered = path.join(await fs.realpath(path.dirname(dir)), path.basename(dir));
  await gitOut(run.ref.project, ["worktree", "add", "--detach", registered, sha]);
  if (run.prefix === undefined) run.prefix = await productPrefix(run.ref.project, { env: run.d.env });
  return { dir, cwd: productRoot(dir, run.prefix), sha };
}

/**
 * Remove one registered G2 snapshot through the shared ownership and safety checks. Unregistered directories stay
 * protected. Cleanup after a harvest is best effort; a protected leftover makes the next spawn refuse it.
 */
export async function removeG2Snapshot(run, dir, { strict = false } = {}) {
  const fs = run.d.fs ?? fsp;
  try {
    resolveInside(g2SnapshotRoot(run.paths), path.relative(g2SnapshotRoot(run.paths), dir));
    const result = await removeWorktree({ project: run.ref.project, worktree: dir }, run.d);
    if (!result.removed && await fs.lstat(dir).then(() => true, () => false)) {
      if (strict) throw err("INVALID_STATE", `G2 snapshot is protected: ${result.reason ?? "unregistered-path"}`);
      return false;
    }
    return result.removed;
  } catch (error) {
    if (strict) throw error;
    run.d.log(`next: the G2 snapshot ${dir} could not be removed: ${error?.message ?? error}`);
  }
}

/**
 * Remove every G2 snapshot of the run (`<build>/g2/*`) and its bootstrap manifest entry, except (unless `all`) the snapshot
 * a `running` G2 job of `state` still judges: that one is removed by its own harvest. Called when the run stops (terminal
 * actions, `stop`), finishes, and on `start --resume` (leftovers of a crash between a snapshot and its job). Never runs
 * without a reservation: terminal cleanup excludes acquire; active resume supplies its epoch (NB5).
 * @param {{project: string, state?: object|null, all?: boolean, epoch?: number|null}} input `state` defaults to `build/state.json`
 * @param {object} [deps] `fs`, `env`, `homedir`, `log`
 * @returns {Promise<{removed: string[], kept: string[]}>}
 */
export async function removeAllG2Snapshots({ project, state = null, all = false, epoch = null }, deps = {}) {
  state ??= await readState(project, deps);
  if (!state) return { removed: [], kept: [] };
  if (state.status === "active" && epoch === null) throw err("FENCE", "La limpieza de snapshots activos requiere su epoch.");
  return withRunCleanup({ project, state, epoch }, current => cleanG2Snapshots({ project, state: current, all }, deps), deps);
}

async function cleanG2Snapshots({ project, state, all }, deps) {
  const d = resolveDeps(deps);
  const fs = d.fs ?? fsp;
  const run = { ref: { project }, d, paths: buildPaths(project, d) };
  const root = g2SnapshotRoot(run.paths);
  const removed = [];
  const kept = [];
  try {
    const names = await fs.readdir(root).catch((error) => { if (error?.code === "ENOENT") return []; throw error; });
    let live = new Set();
    if (!all) {
      const s = state ?? await readState(project, d).catch(() => null);
      live = new Set((s?.jobs ?? []).filter((j) => j.kind === "g2" && j.state === "running").map((j) => g2PinOf(run.paths, j)?.dir).filter(Boolean));
    }
    for (const name of names) {
      const dir = path.join(root, name);
      if (live.has(dir)) { kept.push(dir); continue; }
      if (await removeG2Snapshot(run, dir)) removed.push(dir); else kept.push(dir);
    }
    await gitRun(project, ["worktree", "prune"]);
  } catch (error) {
    d.log(`next: the G2 snapshots under ${root} could not be cleaned: ${error?.message ?? error}`);
  }
  const current = state ?? await readState(project, d).catch(() => null);
  if (current && current.status !== "active") await cleanupRunWorktrees({ project, state: current }, d);
  return { removed, kept };
}

const g2FailuresFile = (paths) => path.join(paths.build, "g2-snapshot-failures.json");

/** `{<frd>: consecutive failed snapshot passes}`, persisted under `<build>/` (untracked) because every `next` call is a new process. */
async function readG2Failures(run) {
  try {
    const counts = await readJson(g2FailuresFile(run.paths), { fs: run.d.fs });
    return counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {};
  } catch (error) {
    if (error.code === "LEDGER_CORRUPT") return {};
    throw error;
  }
}

/** Reset the counter of the FRDs whose snapshot was made and add one to the failed ones; returns the counts of the failed FRDs. */
export async function trackG2SnapshotFailures(run, okFrds, failedFrds) {
  if (!okFrds.length && !failedFrds.length) return {};
  const counts = await readG2Failures(run);
  for (const frd of okFrds) delete counts[frd];
  for (const frd of failedFrds) counts[frd] = (Number(counts[frd]) || 0) + 1;
  await atomicWriteJson(g2FailuresFile(run.paths), counts, { fs: run.d.fs });
  return Object.fromEntries(failedFrds.map((frd) => [frd, counts[frd]]));
}

/**
 * Hand back (cause `env-infra`, the unit and its dependents `blocked`, R4) the first integrated work unit of every FRD whose
 * G2 snapshot has failed `G2_SNAPSHOT_FAIL_MAX` passes in a row, and reset its counter.
 * @returns {Promise<string[]>} the FRDs that are still retrying (their snapshot failed fewer times)
 */
export async function handBackExhaustedG2(run, state, failedFrds, fails, notes) {
  const retrying = [];
  const counts = await readG2Failures(run);
  for (const frd of failedFrds) {
    if ((fails[frd] ?? counts[frd] ?? 1) < G2_SNAPSHOT_FAIL_MAX) { retrying.push(frd); continue; }
    delete counts[frd];
    const work = state.units.find((u) => FRD_WORK_KINDS.includes(u.kind) && u.frd === frd && u.state === "integrated");
    if (!work) {
      // The FRD left `integrated` since the failed passes (nothing waits on its G2 any more): nothing to hand back, but
      // the dropped retry is reported, never silent (DR1c-N2).
      notes.push(`G2 de ${frd}: no se pudo crear su copia de la rama de integración ${G2_SNAPSHOT_FAIL_MAX} veces seguidas, pero ya no queda ninguna unidad integrada que devolver; se deja de reintentar.`);
      run.d.log(`next: G2 snapshot of ${frd} failed ${G2_SNAPSHOT_FAIL_MAX} times and the FRD has no integrated unit left to hand back`);
      continue;
    }
    const res = await (await sibling(run.d, "failure", "handbackCommand"))({ ...fenceOf(run), unit: work.id, reason: `G2 de ${frd}: no se pudo crear su copia de la rama de integración ${G2_SNAPSHOT_FAIL_MAX} veces seguidas`, cause: "env-infra" }, run.d);
    if (res?.notice_es) notes.push(res.notice_es);
  }
  await atomicWriteJson(g2FailuresFile(run.paths), counts, { fs: run.d.fs });
  return retrying;
}

/** FRDs that need a G2 now (integrate.frdsReadyForG2, CLI 4.1) and have no live G2 job. */
export const g2Needed = (state) => frdsReadyForG2(state).filter((frd) => !state.jobs.some((j) => j.kind === "g2" && j.frd === frd && j.state === "running"));
