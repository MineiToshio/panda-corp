#!/usr/bin/env node
// worktree-sweep.mjs — the deterministic half of /pandacorp:worktrees (DR-135).
//
// Classifies every git worktree and local branch of ONE repository against its default branch and
// removes only what is provably safe. The agent never decides "safe" by eye: it runs `scan`, shows
// the owner the `ask` items, runs `clean` for the `safe` ones, and `discard` only for an item the
// owner confirmed by name.
//
//   scan    --repo <dir> [--self <dir>]                 read-only; prints the inventory JSON
//   clean   --repo <dir> [--self <dir>] [--dry-run] [--also <branch|path>]…
//                                                       re-scans, then removes ONLY the `safe` items:
//                                                       `git worktree remove <path>` (never --force),
//                                                       `git branch -d <name>` (never -D), `git worktree prune`;
//                                                       --also lifts ONLY the recent-activity hold of an item
//                                                       the owner named (e.g. right after integrating it)
//   discard --repo <dir> --target <branch|path> --confirmed [--self <dir>]
//                                                       owner-confirmed discard of ONE `ask` item: first
//                                                       archives its tip (plus a snapshot of uncommitted
//                                                       and gitignored owner-state files) under
//                                                       refs/pandacorp-archive/, then removes it
//
// Semantics shared with Mission Control's pending reader (mission-control/src/lib/pendingMerge):
// default branch = origin/HEAD stripped of `origin/`, else `main`; pending = a surviving worktree or a
// branch not merged into it; stale after PANDACORP_STALE_HOURS (default 3) since the last commit.
//
// An item is `safe` only when ALL hold: its commits are ancestors of the default branch, it has no
// uncommitted or untracked files, it has been idle for PANDACORP_STALE_HOURS (or the owner named it), it holds no gitignored owner state (.pandacorp/,
// factory/{ideas,memory,profile.md,portfolio.md}), no other worktree is nested inside it, no running
// process has its cwd inside it, it is not the caller's own checkout, it is not locked or a
// deployment, and — when it belongs to the build engine (.pandacorp/run/**, lane/* branches) — no
// build of that project is live or resumable. Anything that fails a hard rule is `protected` (never
// offered); finished engine roots use the shared terminal-run predicate below and retain branch refs. Everything else is `ask` (the owner decides). Exit: 0 ok · 2 bad input · 3 refused.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, lstatSync, unlinkSync, copyFileSync } from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentLease, withUnleasedProject } from "../runtime/build-state.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STALE_HOURS = Number(process.env.PANDACORP_STALE_HOURS ?? 3);
const OLD_DAYS = 30; // un-merged work older than this is suggested for review, not integration
const OWNER_STATE_SPECS = [":(glob).pandacorp/**", ":(glob)*/.pandacorp/**", ":(glob)factory/ideas/**", ":(glob)factory/memory/**", "factory/profile.md", "factory/portfolio.md"];

class Refusal extends Error {}

function git(cwd, args, { env } = {}) {
  // --no-optional-locks: a read (status) must never refresh another worktree's index — it would fake "recent activity".
  const r = spawnSync("git", ["--no-optional-locks", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : process.env });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}
function must(cwd, args) {
  const r = git(cwd, args);
  if (!r.ok) throw new Error(`git ${args.join(" ")} failed: ${r.err}`);
  return r.out;
}
const real = (p) => { try { return realpathSync(p); } catch { return path.resolve(p); } };
const within = (child, parent) => child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

function parsePorcelain(text) {
  const out = [];
  let cur = null;
  for (const line of `${text}\n`.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), head: null, branch: null, detached: false, locked: false, lockReason: null, prunable: false, bare: false }; out.push(cur); }
    else if (!cur) continue;
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch refs/heads/")) cur.branch = line.slice(18);
    else if (line === "detached") cur.detached = true;
    else if (line === "bare") cur.bare = true;
    else if (line === "locked" || line.startsWith("locked ")) { cur.locked = true; cur.lockReason = line.slice(7) || null; }
    else if (line === "prunable" || line.startsWith("prunable ")) cur.prunable = true;
  }
  return out;
}

function defaultBranch(root) {
  const sym = git(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const name = sym.ok && sym.out ? sym.out.replace(/^origin\//, "") : "main";
  if (git(root, ["rev-parse", "--verify", "-q", `refs/heads/${name}`]).ok) return name;
  if (git(root, ["rev-parse", "--verify", "-q", "refs/heads/main"]).ok) return "main";
  throw new Refusal(`cannot resolve the default branch (${name} has no local ref)`);
}

/** cwd of every running process — a worktree somebody stands in is in use (a live session, a dev server). */
export function processCwds() {
  const r = spawnSync("lsof", ["-d", "cwd", "-Fn"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return { ok: false, cwds: [] };
  return { ok: true, cwds: [...new Set((r.stdout || "").split("\n").filter((l) => l.startsWith("n/")).map((l) => real(l.slice(1))))] };
}

/** Pandacorp projects inside the repo (root or one level down, e.g. the nested mission-control) and their build liveness. */
async function projects(mainWt) {
  const dirs = [mainWt];
  for (const e of readdirSync(mainWt, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith(".")) dirs.push(path.join(mainWt, e.name));
  const out = [];
  for (const dir of dirs) {
    const status = path.join(dir, ".pandacorp", "status.yaml");
    const runDir = path.join(dir, ".pandacorp", "run");
    if (!existsSync(status) && !existsSync(runDir)) continue;
    // fail-closed: the shared liveness rule (the same helper /pandacorp:implement's preflight reads) — unreadable = RUNNING
    const r = spawnSync("bash", [path.join(HERE, "check-build-liveness.sh"), status], { encoding: "utf8" });
    const liveness = (r.stdout || "").trim() || "RUNNING";
    let lease = null;
    try { lease = await currentLease(dir); } catch { lease = { unreadable: true }; }
    const live = liveness !== "NOT_RUNNING" || lease !== null || existsSync(path.join(runDir, "build.lease"));
    out.push({ dir: real(dir), runDir: real(runDir), liveness, lease: lease !== null, live });
  }
  return out;
}


/** Running/admitted work needs positive termination evidence, independently of coordinator status. */
export function runningWorktreePaths(state, deps = {}) {
  const alive = deps.isAlive ?? (pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } });
  const provenDead = pid => Number.isInteger(pid) && pid > 0 && alive(pid) === false;
  return [
    ...(state?.units ?? []).filter(u => ['running', 'admitted'].includes(u.state) && !provenDead(u.worker?.pid)).map(u => u.worktree),
    ...(state?.jobs ?? []).filter(j => j.state === 'running' && !provenDead(j.pid)).map(j => j.cwd),
  ].filter(Boolean);
}

/** ONE ownership predicate for retry, close and sweep: run + branch + canonical exact checkout path.
 * Detached G2 snapshots additionally need their exact pin reachable from this run's integration ref;
 * a detached integration/unit is never reclaimed (its unique commit may have no surviving ref).
 */
export function engineWorktreeOwnershipReason(entry, { build, runId } = {}) {
  if (!build || typeof runId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(runId)) return 'run-ownership-unproven';
  const root = real(build), target = real(entry.path);
  if (path.resolve(build) !== root || path.resolve(entry.path) !== target) return 'symlink-path';
  if (!entry.branch) {
    const pin = /^g2\/([A-Za-z0-9._:-]+)-([a-f0-9]{40,64})$/.exec(path.relative(root, target).split(path.sep).join('/'));
    if (!pin || entry.head !== pin[2] || !git(entry.path, ['merge-base', '--is-ancestor', pin[2], `refs/heads/lane/${runId}/integration`]).ok) return 'detached-ownership-unproven';
    return null;
  }
  const prefix = `lane/${runId}/`;
  if (!entry.branch.startsWith(prefix)) return 'foreign-run';
  const segment = entry.branch.slice(prefix.length);
  if (!/^[A-Za-z0-9._:-]+$/.test(segment)) return 'worktree-path-mismatch';
  const expected = segment === 'integration' ? path.join(root, 'integration') : path.join(root, 'wt', segment);
  return target === expected ? null : 'worktree-path-mismatch';
}

// The only protected-state exception. Match worktree ROOTS, never an arbitrary descendant.
function engineRoot(p, projs, entry) {
  for (const project of projs) {
    const run = path.join(project.dir, '.pandacorp/run');
    if (!within(p, run) || real(run) !== run) continue;
    const rel = path.relative(run, p).split(path.sep).join('/');
    if (/^build-suspended(?:\/|$)/.test(rel)) return { project, eligible: false, reason: 'suspended-run' };
    const archive = /^build-archive\/[^/]+\/(?:wt\/[^/]+|g2\/[^/]+|integration)$/.test(rel);
    const v2 = /^build\/(?:wt\/[^/]+|g2\/[^/]+|integration)$/.test(rel);
    const legacy = /^(?:lanes\/[^/]+|gate-worktree[^/]*)$/.test(rel);
    if (!archive && !v2 && !legacy) return { project, eligible: false, reason: 'protected-path' };
    if (project.live) return { project, managed: true, eligible: false, reason: 'live-build' };
    if (legacy) return { project, managed: true, eligible: true };
    const root = archive ? path.join(run, ...rel.split('/').slice(0, 2)) : path.join(run, 'build');
    if (real(root) !== root) return { project, managed: true, eligible: false, reason: 'protected-path' };
    let state;
    try { state = JSON.parse(readFileSync(path.join(root, 'state.json'), 'utf8')); }
    catch (e) { if (!archive || e.code !== 'ENOENT') return { project, managed: true, eligible: false, reason: 'run-state-unreadable' }; state = {}; }
    if (state.status === 'waiting_gate' || Object.values(state.units || {}).some(u => u?.state === 'waiting_gate' || u?.status === 'waiting_gate')) return { project, managed: true, eligible: false, reason: 'waiting-gate' };
    if (!archive && !['finished', 'stopped'].includes(state.status)) return { project, managed: true, eligible: false, reason: 'unfinished-run' };
    if (runningWorktreePaths(state).some(cwd => within(real(cwd), p))) return { project, managed: true, eligible: false, reason: 'running-unit' };
    const ownership = engineWorktreeOwnershipReason(entry, { build: root, runId: state.run_id });
    return { project, managed: true, eligible: !ownership, reason: ownership };
  }
  return null;
}

// Bootstrap proofs live in the main checkout, outside the disposable tree, and bind both
// its path and .git-file identity. A copied/stale proof cannot authorize a replacement tree.
function bootstrapFiles(wt, mainWt) {
  try {
    const id = createHash('sha256').update(wt).digest('hex');
    const file = path.join(mainWt, '.pandacorp/run/worktrees', `bootstrap-${id}.json`);
    if (real(file) !== file || !lstatSync(file).isFile()) return {};
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const st = lstatSync(path.join(wt, '.git'));
    const gd = git(wt, ['rev-parse', '--absolute-git-dir']);
    if (!st.isFile() || data.producer !== 'worktree-bootstrap' || data.version !== 1 || data.path !== wt ||
        data.identity !== `${st.dev}:${st.ino}:${st.birthtimeMs}` || !gd.ok || data.gitdir !== real(gd.out) ||
        !data.generated_files || typeof data.generated_files !== 'object' || Array.isArray(data.generated_files)) return {};
    return Object.fromEntries(Object.entries(data.generated_files).filter(([name, hash]) =>
      /^(?:\.claude\/launch\.json|(?:[^/]+\/)?(?:e2e\/server-env\.json|\.env\.local))$/.test(name) &&
      typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)));
  } catch { return {}; } // No provenance is never permission to discard a hidden difference.
}
const protectedRelative = name => /(^|\/)(\.git|\.pandacorp)(\/|$)|(^|\/)factory\/(ideas|memory|profile\.md|portfolio\.md)(\/|$)/.test(name);
function hashMatches(wt, name, expected) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const file = path.resolve(wt, name);
  return within(file, wt) && file !== wt && !protectedRelative(name) && real(file) === file && lstatSync(file).isFile() &&
    createHash('sha256').update(readFileSync(file)).digest('hex') === expected;
}

// ONE dirty/hidden/protected-state predicate for ALL worktrees, used by sweep and finish.
// Session receipts can prove ignored generated outputs; hidden tracked differences additionally
// require the bootstrap's own provenance. Index concealment flags alone authorize nothing.
function worktreeCleanReason(wt, { bootstrap = {}, generated = {}, disposableIgnored = false } = {}) {
  try {
    const sparse = git(wt, ['config', '--worktree', '--bool', 'core.sparseCheckout']);
    const cones = sparse.ok && sparse.out === 'true' ? git(wt, ['sparse-checkout', 'list']) : null;
    const outsideCone = name => path.posix.dirname(name) !== '.' && cones?.ok && !cones.out.split('\n').filter(Boolean).some(d =>
      name.startsWith(`${d}/`) || path.posix.dirname(name) === '.' || d.startsWith(`${path.posix.dirname(name)}/`) || path.posix.dirname(name) === d);
    const files = git(wt, ['ls-files', '-v', '-z']);
    if (!files.ok) return 'status-unreadable';
    for (const row of files.out.split('\0').filter(row => /^[a-zS] /.test(row))) {
      const name = row.slice(2), file = path.join(wt, name);
      if (!existsSync(file) && row.startsWith('S ') && outsideCone(name)) continue;
      if (!existsSync(file) || !lstatSync(file).isFile() || real(file) !== file) return 'masked-tracked-change';
      const hash = git(wt, ['hash-object', '--no-filters', '--', name]);
      const head = git(wt, ['rev-parse', '--verify', `HEAD:${name}`]);
      if (!hash.ok || !head.ok) return 'masked-tracked-change';
      if (hash.out !== head.out && !(row.startsWith('S ') && hashMatches(wt, name, bootstrap[name]))) return 'masked-tracked-change';
    }
    for (const [name, hash] of Object.entries(generated)) {
      if (!hashMatches(wt, name, hash)) return 'generated-output-changed';
    }
    const ignored = git(wt, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']);
    if (!ignored.ok) return 'status-unreadable';
    // BL-0316: an engine-owned detached G2 snapshot (pin proven reachable from its run's integration ref by
    // engineWorktreeOwnershipReason) is a throwaway checkout of a commit; every ignored file in it was produced by its
    // bootstrap or verify run, never by a person. Tracked/untracked changes, locks and live cwds still protect it.
    if (disposableIgnored) ignored.out = '';
    const caches = /(^|\/)(node_modules|\.next|\.next-fidelity|dist|build|coverage|\.cache|\.turbo|test-results)(\/|$)/;
    for (const name of ignored.out.split('\0').filter(Boolean)) {
      // In particular, .pandacorp/run in an ordinary worktree is owner state too.
      if (protectedRelative(name)) return 'owner-state';
      if (!caches.test(name) && !hashMatches(wt, name, bootstrap[name]) && !hashMatches(wt, name, generated[name])) return 'unclassified-ignored-files';
      const file = path.join(wt, name);
      let dir = lstatSync(file).isDirectory() ? file : path.dirname(file);
      while (dir !== wt && within(dir, wt)) {
        if (existsSync(path.join(dir, '.git')) || ['HEAD', 'objects', 'refs', 'config'].every(n => existsSync(path.join(dir, n)))) return 'nested-repository';
        dir = path.dirname(dir);
      }
    }
    const gd = git(wt, ['rev-parse', '--absolute-git-dir']);
    const common = git(wt, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (!gd.ok || !common.ok) return 'status-unreadable';
    if (['index.lock', 'HEAD.lock'].some(n => existsSync(path.join(gd.out, n))) || ['index.lock', 'packed-refs.lock'].some(n => existsSync(path.join(common.out, n)))) return 'git-lock';
    return null;
  } catch { return 'status-unreadable'; }
}

/** Shared DATA-safety predicate. Lifecycle callers own run/lease eligibility; no caller may bypass these holds. */
export function worktreeRemovalReason(worktree, { mainWt, runningPaths = [], generated = {}, processes = processCwds(), disposableIgnored = false } = {}) {
  try {
    const wt = real(worktree);
    if (path.resolve(worktree) !== wt) return 'symlink-path';
    const listed = parsePorcelain(must(mainWt ?? worktree, ['worktree', 'list', '--porcelain']));
    const entry = listed.find(w => real(w.path) === wt);
    if (!entry) return 'unregistered-path';
    const main = real(listed.find(w => !w.bare)?.path ?? '');
    if (wt === main || within(real(process.cwd()), wt)) return 'self';
    if (entry.locked) return 'locked';
    if (!processes.ok) return 'process-check-unavailable';
    if (processes.cwds.some(c => within(real(c), wt))) return 'in-use';
    if (runningPaths.some(p => typeof p === 'string' && within(real(p), wt))) return 'running-unit';
    if (listed.some(w => real(w.path) !== wt && within(real(w.path), wt))) return 'nested-worktree';
    const hidden = worktreeCleanReason(wt, { bootstrap: bootstrapFiles(wt, mainWt ?? main), generated, disposableIgnored });
    if (hidden) return hidden;
    const status = git(wt, ['status', '--porcelain', '--untracked-files=all']);
    if (!status.ok) return 'status-unreadable';
    return status.out ? 'uncommitted-work' : null;
  } catch { return 'status-unreadable'; }
}

/** Remove only regular manifest files with an absolute path proven absent. Never follow symlinks. */
export function pruneManifests(projectDirs, { dryRun = false } = {}) {
  const pruned = [];
  for (const project of projectDirs) {
    const dir = path.join(project, '.pandacorp/run/worktrees');
    if (!existsSync(dir) || real(dir) !== dir) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const file = path.join(dir, entry.name);
      try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        if (typeof data.path !== 'string' || !path.isAbsolute(data.path)) continue;
        try { lstatSync(data.path); continue; } catch (e) { if (e.code !== 'ENOENT') continue; }
        if (!dryRun) unlinkSync(file);
        pruned.push(file);
      } catch { /* Unreadable evidence stays. */ }
    }
  }
  return pruned;
}

function origin(branch, wtPath) {
  if (wtPath && /\/\.pandacorp\/run\/lanes\//.test(wtPath)) return "build-lane";
  if (wtPath && /\/\.pandacorp\/run\/gate-worktree/.test(wtPath)) return "build-gate";
  if (wtPath && /\/\.pandacorp\/run\//.test(wtPath)) return "build-engine";
  if (branch?.startsWith("lane/")) return "build-lane";
  if (branch?.startsWith("claude/")) return "claude";
  if (branch?.startsWith("codex/")) return "codex";
  if (wtPath && /\/local-deployments\//.test(wtPath)) return "deployment";
  if (wtPath && /\/review-worktrees\//.test(wtPath)) return "review";
  if (wtPath && (wtPath.startsWith("/private/tmp/") || wtPath.startsWith("/tmp/") || wtPath.startsWith(real(os.tmpdir())))) return "temp";
  return "manual";
}

function commitInfo(root, rev, def) {
  const log = git(root, ["log", "-1", "--format=%ct%x09%s", rev]);
  const [ts, ...subj] = log.ok ? log.out.split("\t") : ["0"];
  const merged = git(root, ["merge-base", "--is-ancestor", rev, def]).ok;
  const ahead = merged ? 0 : Number(git(root, ["rev-list", "--count", `${def}..${rev}`]).out || 0);
  const behind = Number(git(root, ["rev-list", "--count", `${rev}..${def}`]).out || 0);
  let patchEquivalent = false;
  let mergeClean = null;
  if (!merged) {
    const cherry = git(root, ["cherry", def, rev]);
    const lines = cherry.ok ? cherry.out.split("\n").filter(Boolean) : [];
    patchEquivalent = lines.length > 0 && lines.every((l) => l.startsWith("-"));
    const mt = git(root, ["merge-tree", "--write-tree", "--quiet", def, rev]);
    mergeClean = mt.ok;
  }
  const lastTs = Number(ts) * 1000 || Date.now();
  return { subject: subj.join("\t") || null, lastCommitAt: new Date(lastTs).toISOString(), ageHours: Math.max(0, Math.floor((Date.now() - lastTs) / 3_600_000)), merged, ahead, behind, patchEquivalent, mergeClean };
}

function suggest(item) {
  if (item.reason === "recent-activity" || (item.idleHours ?? item.ageHours) < STALE_HOURS) return { action: "keep", why: "recent-activity" };
  if (item.uncommitted > 0) return { action: "review", why: "uncommitted-work" };
  if (item.ownerState.length > 0) return { action: "review", why: "owner-state" };
  if (item.nested.length > 0) return { action: "review", why: "nested-worktree" };
  if (item.origin === "build-lane" || item.origin === "build-gate" || item.origin === "build-engine") return { action: "keep", why: "build-engine-chain" };
  if (item.merged) return { action: "review", why: "merged-but-not-clean" };
  if (item.patchEquivalent) return { action: "discard", why: "content-already-in-default" };
  if (item.mergeClean === false) return { action: "review", why: "conflicts-with-default" };
  if (item.ageHours > OLD_DAYS * 24) return { action: "review", why: "old-unmerged" };
  return { action: "integrate", why: "unmerged-commits" };
}

function hoursSince(file) {
  try { return Math.max(0, Math.floor((Date.now() - statSync(file).mtimeMs) / 3_600_000)); } catch { return Number.POSITIVE_INFINITY; }
}

export async function scan(repo, selfDir = process.cwd(), alsoList = [], { generatedFilesByPath = {} } = {}) {
  const top = git(repo, ["rev-parse", "--show-toplevel"]);
  if (!top.ok) throw new Refusal(`not a git repository: ${repo}`);
  const wts = parsePorcelain(must(top.out, ["worktree", "list", "--porcelain"]));
  const main = wts.find((w) => !w.bare) ?? wts[0];
  const mainWt = real(main.path);
  const def = defaultBranch(mainWt);
  const selfTop = git(selfDir, ["rev-parse", "--show-toplevel"]);
  const self = selfTop.ok ? real(selfTop.out) : null;
  const procs = processCwds();
  const projs = await projects(mainWt);
  const anyLive = projs.some((p) => p.live);
  const mergeQueue = existsSync(path.join(mainWt, ".pandacorp", "merge-queue.sh"));
  const allPaths = wts.map((w) => real(w.path));
  const checkedOut = new Set(wts.map((w) => w.branch).filter(Boolean));
  const also = new Set(alsoList.flatMap((a) => [a.replace(/\/+$/, ""), real(a)]));

  const items = [];
  for (const w of wts) {
    const p = real(w.path);
    if (p === mainWt || w.bare) continue;
    const base = { kind: "worktree", path: w.path, branch: w.branch, detached: w.detached, origin: origin(w.branch, p) };
    if (w.prunable || !existsSync(w.path)) {
      items.push({ ...base, decision: w.locked ? "protected" : "safe", reason: w.locked ? "locked" : "missing-directory", actions: w.locked ? [] : ["prune"] });
      continue;
    }
    const rev = w.branch ? `refs/heads/${w.branch}` : w.head;
    const info = commitInfo(mainWt, rev, def);
    const st = git(w.path, ["status", "--porcelain", "--untracked-files=normal"]);
    const uncommitted = st.ok ? st.out.split("\n").filter(Boolean).length : -1;
    const ownerState = git(w.path, ["ls-files", "-o", "-i", "--exclude-standard", "--", ...OWNER_STATE_SPECS]).out.split("\n").filter(Boolean);
    const nested = allPaths.filter((o) => o !== p && within(o, p));
    const idleHours = Math.min(info.ageHours, hoursSince(path.join(git(w.path, ["rev-parse", "--absolute-git-dir"]).out, "logs", "HEAD")));
    const recent = idleHours < STALE_HOURS && !also.has(w.branch) && !also.has(p);
    const inUse = procs.cwds.some((c) => within(c, p));
    const engine = engineRoot(p, projs, w);
    const engineProject = projs.find((pr) => within(p, pr.runDir));
    const engineOwned = Boolean(engineProject) || base.origin.startsWith("build-");
    const engineLive = engineProject ? engineProject.live : engineOwned && anyLive;
    const dirtyReason = worktreeRemovalReason(w.path, { mainWt, generated: generatedFilesByPath[p] || {}, processes: procs });
    const item = { ...base, engineOwned: Boolean(engine), engineManaged: Boolean(engine?.managed), head: w.head, ...info, idleHours, uncommitted, ownerState, nested, inUse, stale: idleHours >= STALE_HOURS };
    let decision; let reason;
    if (w.locked) { decision = "protected"; reason = "locked"; }
    else if (path.resolve(w.path) !== p) { decision = "protected"; reason = "symlink-path"; }
    else if (!engine && /(^|\/)\.pandacorp(\/|$)|\/factory\/(ideas|memory)(\/|$)/.test(p)) { decision = "protected"; reason = "protected-path"; }
    else if (base.origin === "deployment") { decision = "protected"; reason = "deployment"; }
    else if (self && p === self) { decision = "protected"; reason = "self"; }
    else if (engineOwned && engineLive) { decision = "protected"; reason = "live-build"; }
    else if (engine && !engine.eligible) { decision = "protected"; reason = engine.reason; }
    else if (inUse) { decision = "protected"; reason = "in-use"; }
    else if (!procs.ok) { decision = "ask"; reason = "process-check-unavailable"; }
    else if (uncommitted < 0) { decision = "ask"; reason = "status-unreadable"; }
    else if (dirtyReason) { decision = "ask"; reason = dirtyReason; }
    else if (engine?.eligible && uncommitted === 0 && ownerState.length === 0 && nested.length === 0) { decision = "safe"; reason = "finished-run"; }
    else if (info.merged && uncommitted === 0 && ownerState.length === 0 && nested.length === 0) {
      // merged + clean is provably safe for the DATA, but a session idle < STALE_HOURS may still stand on it (a Codex/Claude
      // session lsof can't see between commands): it is only auto-removed once idle, or when the owner named it (--also).
      if (recent) { decision = "ask"; reason = "recent-activity"; } else { decision = "safe"; reason = "merged-and-clean"; }
    }
    else { decision = "ask"; reason = info.merged ? "merged-but-not-clean" : "unmerged"; }
    item.decision = decision;
    item.reason = reason;
    if (decision === "safe") item.actions = ["remove-worktree", ...(w.branch && info.merged && !engine ? ["delete-branch"] : [])];
    if (decision === "ask") { item.suggestion = suggest(item); item.integrateVia = mergeQueue ? "merge-queue" : "direct-merge"; }
    if (w.locked) item.lockReason = w.lockReason;
    items.push(item);
  }

  const branches = must(mainWt, ["for-each-ref", "refs/heads", "--format=%(refname:short)"]).split("\n").filter(Boolean);
  for (const b of branches) {
    if (b === def || checkedOut.has(b)) continue;
    const info = commitInfo(mainWt, `refs/heads/${b}`, def);
    const item = { kind: "branch", path: null, branch: b, detached: false, origin: origin(b, null), ...info, idleHours: info.ageHours, uncommitted: 0, ownerState: [], nested: [], inUse: false, stale: info.ageHours >= STALE_HOURS };
    if (item.origin === "build-lane") { item.decision = "protected"; item.reason = anyLive ? "live-build" : "retained-engine-ref"; }
    else if (info.merged) { item.decision = "safe"; item.reason = "merged"; item.actions = ["delete-branch"]; }
    else { item.decision = "ask"; item.reason = "unmerged"; item.suggestion = suggest(item); item.integrateVia = mergeQueue ? "merge-queue" : "direct-merge"; }
    items.push(item);
  }

  const order = { ask: 0, safe: 1, protected: 2 };
  items.sort((a, b) => order[a.decision] - order[b.decision] || b.ahead - a.ahead || a.ageHours - b.ageHours);
  const count = (d) => items.filter((i) => i.decision === d).length;
  return {
    repo: mainWt, defaultBranch: def, self, staleHours: STALE_HOURS, mergeQueue,
    projects: projs.map(({ dir, liveness, lease, live }) => ({ dir, liveness, lease, live })),
    processCheck: procs.ok,
    summary: { worktrees: items.filter((i) => i.kind === "worktree").length, branches: items.filter((i) => i.kind === "branch").length, safe: count("safe"), ask: count("ask"), protected: count("protected") },
    items,
  };
}

export async function clean(repo, selfDir, { dryRun = false, also = [] } = {}) {
  const inv = await scan(repo, selfDir, also);
  const done = []; const failed = [];
  const root = inv.repo;
  for (const candidate of inv.items.filter((i) => i.decision === "safe")) {
    const fresh = await scan(repo, selfDir, also);
    const it = fresh.items.find(i => i.kind === candidate.kind && i.path === candidate.path && i.branch === candidate.branch);
    if (!it || it.decision !== 'safe') continue;
    for (const a of it.actions) {
      const args = a === "remove-worktree" ? ["worktree", "remove", it.path]
        : a === "delete-branch" ? ["branch", "-d", it.branch]
        : ["worktree", "prune"];
      if (dryRun) { done.push({ action: a, branch: it.branch, path: it.path, dryRun: true }); continue; }
      const project = a === "remove-worktree" && inv.projects.find(p => within(it.path, path.join(p.dir, '.pandacorp/run')));
      let r;
      try { r = project ? await withUnleasedProject(project.dir, () => git(root, args)) : git(root, args); }
      catch (error) { if (error.code !== 'CONTENDED') throw error; r = { ok: false, err: 'live-build' }; }
      (r.ok ? done : failed).push({ action: a, branch: it.branch, path: it.path, ...(r.ok ? {} : { error: r.err }) });
      if (!r.ok) break; // a refused removal keeps its branch too — never escalate to --force/-D
    }
  }
  if (!dryRun) git(root, ["worktree", "prune"]); // only drops entries whose directory is gone; skips locked
  const manifestsPruned = pruneManifests(inv.projects.map(p => p.dir), { dryRun });
  const after = dryRun ? inv : await scan(repo, selfDir, also);
  return { repo: root, dryRun, manifestsPruned, removed: done, failed, remaining: after.summary, ask: after.items.filter((i) => i.decision === "ask"), protected: after.items.filter((i) => i.decision === "protected") };
}

/** Session finish also reclaims terminal engine worktrees, never unrelated sessions or branches. */
export async function cleanEngineWorktrees(repo, selfDir, { dryRun = false, excluded = [], generatedFilesByPath = {} } = {}) {
  const inv = await scan(repo, selfDir, [], { generatedFilesByPath });
  const removed = [], kept = [], failed = [];
  for (const candidate of inv.items.filter(i => i.kind === 'worktree' && i.engineOwned && !excluded.includes(i.path))) {
    const project = inv.projects.find(p => within(candidate.path, path.join(p.dir, '.pandacorp/run')));
    const remove = async () => {
      const fresh = await scan(repo, selfDir, [], { generatedFilesByPath });
      const item = fresh.items.find(i => i.kind === 'worktree' && i.path === candidate.path);
      if (!item || item.decision !== 'safe') {
        if (item) kept.push({path: item.path, reason: item.reason});
        return;
      }
      if (dryRun) { removed.push({path: item.path, dryRun: true}); return; }
      const result = git(inv.repo, ['worktree', 'remove', '--', item.path]);
      if (result.ok && !existsSync(item.path)) removed.push({path: item.path});
      else failed.push({path: item.path, error: result.err || 'directory remains'});
    };
    try { if (project) await withUnleasedProject(project.dir, remove); else await remove(); }
    catch (error) { if (error.code !== 'CONTENDED') throw error; kept.push({ path: candidate.path, reason: 'live-build' }); }
  }
  const manifestsPruned = pruneManifests(inv.projects.map(p => p.dir), {dryRun});
  return {removed, kept, failed, manifestsPruned};
}

function slug(s) { return s.replace(/^\/+/, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80); }

/** Snapshot a dirty worktree (tracked + untracked + gitignored owner state) into a commit, without touching its index or files. */
function snapshot(wt, head, ownerState) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pandacorp-wt-"));
  const idx = path.join(tmp, "index");
  try {
    const gitIdx = must(wt, ["rev-parse", "--git-path", "index"]);
    const abs = path.isAbsolute(gitIdx) ? gitIdx : path.join(wt, gitIdx);
    if (existsSync(abs)) copyFileSync(abs, idx);
    const env = { GIT_INDEX_FILE: idx };
    const add = git(wt, ["add", "-A"], { env });
    if (!add.ok) throw new Refusal(`snapshot failed: ${add.err}`);
    if (ownerState.length) { const f = git(wt, ["add", "-f", "--", ...ownerState], { env }); if (!f.ok) throw new Refusal(`snapshot of owner state failed: ${f.err}`); }
    const tree = git(wt, ["write-tree"], { env });
    if (!tree.ok) throw new Refusal(`snapshot failed: ${tree.err}`);
    return must(wt, ["commit-tree", tree.out, "-p", head, "-m", "pandacorp worktrees: snapshot before discard"]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

export async function discard(repo, selfDir, target) {
  const inv = await scan(repo, selfDir);
  const t = target.replace(/\/+$/, "");
  const it = inv.items.find((i) => i.branch === t || (i.path && (i.path === t || real(i.path) === real(t))));
  if (!it) throw new Refusal(`no worktree or branch matches '${target}'`);
  if (it.decision === "protected") throw new Refusal(`'${target}' is protected (${it.reason}); it is never discarded`);
  if (it.decision === "safe") return { ...(await clean(repo, selfDir)), note: "item was already safe; removed by the normal clean path" };
  const root = inv.repo;
  const date = new Date().toISOString().slice(0, 10);
  const ref = `refs/pandacorp-archive/${date}/${slug(it.branch ?? it.path)}`;
  let tip = it.kind === "branch" ? must(root, ["rev-parse", `refs/heads/${it.branch}`]) : (it.branch ? must(root, ["rev-parse", `refs/heads/${it.branch}`]) : it.head);
  if (it.kind === "worktree" && (it.uncommitted > 0 || it.ownerState.length > 0)) tip = snapshot(it.path, must(it.path, ["rev-parse", "HEAD"]), it.ownerState);
  must(root, ["update-ref", ref, tip]);
  const steps = [{ action: "archive", ref, sha: tip }];
  if (it.kind === "worktree") {
    // --force is the owner-confirmed path only, and only after the archive ref exists; it never overrides a lock (that needs it twice).
    const r = git(root, ["worktree", "remove", "--force", it.path]);
    if (!r.ok) throw new Refusal(`worktree remove failed (archive kept at ${ref}): ${r.err}`);
    steps.push({ action: "remove-worktree", path: it.path });
  }
  if (it.branch) {
    const r = git(root, ["branch", "-D", it.branch]);
    if (!r.ok) throw new Refusal(`branch delete failed (archive kept at ${ref}): ${r.err}`);
    steps.push({ action: "delete-branch", branch: it.branch });
  }
  return { repo: root, discarded: { branch: it.branch, path: it.path }, steps, restore: it.branch ? `git branch ${it.branch} ${ref}` : `git worktree add <dir> ${ref}` };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
  const flag = (k) => rest.includes(`--${k}`);
  const repo = path.resolve(opt("repo") ?? process.cwd());
  const self = path.resolve(opt("self") ?? process.cwd());
  try {
    let out;
    if (cmd === "scan") out = await scan(repo, self);
    else if (cmd === "clean") out = await clean(repo, self, { dryRun: flag("dry-run"), also: rest.flatMap((a, i) => (rest[i - 1] === "--also" ? [path.isAbsolute(a) || a.startsWith(".") ? path.resolve(a) : a] : [])) });
    else if (cmd === "discard") {
      if (!opt("target")) { console.error("discard needs --target <branch|path>"); process.exit(2); }
      if (!flag("confirmed")) { console.error("discard needs --confirmed: run it only after the owner confirmed THIS item by name"); process.exit(3); }
      out = await discard(repo, self, opt("target"));
    } else { console.error("usage: worktree-sweep.mjs scan|clean|discard --repo <dir> [--self <dir>] [--dry-run] [--target <x> --confirmed]"); process.exit(2); }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } catch (e) {
    if (e instanceof Refusal) { process.stdout.write(`${JSON.stringify({ ok: false, refused: e.message }, null, 2)}\n`); process.exit(3); }
    throw e;
  }
}

if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) main();
