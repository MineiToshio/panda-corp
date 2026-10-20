#!/usr/bin/env node
// worktree-sweep.mjs — the deterministic half of /pandacorp:worktrees (DR-132).
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
// uncommitted or untracked files, it has been idle for PANDACORP_STALE_HOURS (or the owner named it), it holds no gitignored owner state (.pandacorp/ outside run/,
// factory/{ideas,memory,profile.md,portfolio.md}), no other worktree is nested inside it, no running
// process has its cwd inside it, it is not the caller's own checkout, it is not locked or a
// deployment, and — when it belongs to the build engine (.pandacorp/run/**, lane/* branches) — no
// build of that project is live or resumable. Anything that fails a hard rule is `protected` (never
// offered); everything else is `ask` (the owner decides). Exit: 0 ok · 2 bad input · 3 refused.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentLease } from "../runtime/build-state.mjs";

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
function processCwds() {
  const r = spawnSync("lsof", ["-d", "cwd", "-Fn"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, cwds: [] };
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
    if (!existsSync(status)) continue;
    // fail-closed: the shared liveness rule (the same helper /pandacorp:implement's preflight reads) — unreadable = RUNNING
    const r = spawnSync("bash", [path.join(HERE, "check-build-liveness.sh"), status], { encoding: "utf8" });
    const liveness = (r.stdout || "").trim() || "RUNNING";
    let lease = null;
    try { lease = await currentLease(dir); } catch { lease = { unreadable: true }; }
    const live = liveness !== "NOT_RUNNING" || lease !== null;
    out.push({ dir: real(dir), runDir: real(runDir), liveness, lease: lease !== null, live });
  }
  return out;
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

export async function scan(repo, selfDir = process.cwd(), alsoList = []) {
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
    const ownerState = git(w.path, ["ls-files", "-o", "-i", "--exclude-standard", "--", ...OWNER_STATE_SPECS]).out.split("\n").filter((f) => f && !/(^|\/)\.pandacorp\/run\//.test(f));
    const nested = allPaths.filter((o) => o !== p && within(o, p));
    const idleHours = Math.min(info.ageHours, hoursSince(path.join(git(w.path, ["rev-parse", "--absolute-git-dir"]).out, "logs", "HEAD")));
    const recent = idleHours < STALE_HOURS && !also.has(w.branch) && !also.has(p);
    const inUse = procs.cwds.some((c) => within(c, p) && !nested.some((n) => within(c, n)));
    const engineProject = projs.find((pr) => within(p, pr.runDir));
    const engineOwned = Boolean(engineProject) || base.origin.startsWith("build-");
    const engineLive = engineProject ? engineProject.live : engineOwned && anyLive;
    const item = { ...base, head: w.head, ...info, idleHours, uncommitted, ownerState, nested, inUse, stale: idleHours >= STALE_HOURS };
    let decision; let reason;
    if (w.locked) { decision = "protected"; reason = "locked"; }
    else if (base.origin === "deployment") { decision = "protected"; reason = "deployment"; }
    else if (self && p === self) { decision = "protected"; reason = "self"; }
    else if (engineOwned && engineLive) { decision = "protected"; reason = "live-build"; }
    else if (inUse) { decision = "protected"; reason = "in-use"; }
    else if (!procs.ok) { decision = "ask"; reason = "process-check-unavailable"; }
    else if (uncommitted < 0) { decision = "ask"; reason = "status-unreadable"; }
    else if (info.merged && uncommitted === 0 && ownerState.length === 0 && nested.length === 0) {
      // merged + clean is provably safe for the DATA, but a session idle < STALE_HOURS may still stand on it (a Codex/Claude
      // session lsof can't see between commands): it is only auto-removed once idle, or when the owner named it (--also).
      if (recent) { decision = "ask"; reason = "recent-activity"; } else { decision = "safe"; reason = "merged-and-clean"; }
    }
    else { decision = "ask"; reason = info.merged ? "merged-but-not-clean" : "unmerged"; }
    item.decision = decision;
    item.reason = reason;
    if (decision === "safe") item.actions = ["remove-worktree", ...(w.branch && info.merged ? ["delete-branch"] : [])];
    if (decision === "ask") { item.suggestion = suggest(item); item.integrateVia = mergeQueue ? "merge-queue" : "direct-merge"; }
    if (w.locked) item.lockReason = w.lockReason;
    items.push(item);
  }

  const branches = must(mainWt, ["for-each-ref", "refs/heads", "--format=%(refname:short)"]).split("\n").filter(Boolean);
  for (const b of branches) {
    if (b === def || checkedOut.has(b)) continue;
    const info = commitInfo(mainWt, `refs/heads/${b}`, def);
    const item = { kind: "branch", path: null, branch: b, detached: false, origin: origin(b, null), ...info, idleHours: info.ageHours, uncommitted: 0, ownerState: [], nested: [], inUse: false, stale: info.ageHours >= STALE_HOURS };
    if (item.origin === "build-lane" && anyLive) { item.decision = "protected"; item.reason = "live-build"; }
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
  for (const it of inv.items.filter((i) => i.decision === "safe")) {
    for (const a of it.actions) {
      const args = a === "remove-worktree" ? ["worktree", "remove", it.path]
        : a === "delete-branch" ? ["branch", "-d", it.branch]
        : ["worktree", "prune"];
      if (dryRun) { done.push({ action: a, branch: it.branch, path: it.path, dryRun: true }); continue; }
      const r = git(root, args);
      (r.ok ? done : failed).push({ action: a, branch: it.branch, path: it.path, ...(r.ok ? {} : { error: r.err }) });
      if (!r.ok) break; // a refused removal keeps its branch too — never escalate to --force/-D
    }
  }
  if (!dryRun) git(root, ["worktree", "prune"]); // only drops entries whose directory is gone; skips locked
  const after = dryRun ? inv : await scan(repo, selfDir, also);
  return { repo: root, dryRun, removed: done, failed, remaining: after.summary, ask: after.items.filter((i) => i.decision === "ask"), protected: after.items.filter((i) => i.decision === "protected") };
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
