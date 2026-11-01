#!/usr/bin/env node
// test-worktree-sweep.mjs — /pandacorp:worktrees' deterministic engine (worktree-sweep.mjs, DR-135), run as a real
// process against a throwaway repository holding one worktree/branch of every class the skill must tell apart.
// GREEN: merged + clean items (worktree, branch, missing directory) are removed with -d / no --force; RED (never
// auto-removed): unmerged, dirty, gitignored owner state, nested worktree, locked, the caller's own checkout, a
// worktree a process stands in, a build-engine worktree of a live build, recent activity; a confirmed discard
// archives the tip + a snapshot of uncommitted and owner-state files before removing.
// Run: node plugin/scripts/test-worktree-sweep.mjs

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "worktree-sweep.mjs");
let pass = 0;
let fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.log(`  ✗ ${msg}`); } };

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_NOSYSTEM: "1" };
const sh = (cwd, ...args) => { const r = spawnSync("git", args, { cwd, env: ENV, encoding: "utf8" }); if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`); return r.stdout.trim(); };
const sweep = (args, staleHours = "0") => {
  const r = spawnSync("node", [SCRIPT, ...args], { env: { ...ENV, PANDACORP_STALE_HOURS: staleHours }, encoding: "utf8" });
  let json = null; try { json = JSON.parse(r.stdout); } catch { /* exit-code cases */ }
  return { code: r.status, json, stderr: r.stderr };
};
const commit = (cwd, file, msg) => { writeFileSync(path.join(cwd, file), `${msg}\n`); sh(cwd, "add", file); sh(cwd, "commit", "-qm", msg); };

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), "wt-sweep-")));
const repo = path.join(tmp, "repo");
const wt = (n) => path.join(tmp, n);
let sleeper = null;
try {
  mkdirSync(repo);
  sh(repo, "init", "-q", "-b", "main");
  writeFileSync(path.join(repo, ".gitignore"), ".pandacorp/\nnode_modules/\n");
  commit(repo, "a.txt", "base");
  sh(repo, "add", ".gitignore"); sh(repo, "commit", "-qm", "ignore");
  // a Pandacorp project at the root, idle
  mkdirSync(path.join(repo, ".pandacorp/run"), { recursive: true });
  writeFileSync(path.join(repo, ".pandacorp/status.yaml"), "phase: implementation\nrunning: false\n");

  // 1 merged + clean worktree on a branch
  sh(repo, "worktree", "add", "-q", "-b", "claude/merged", wt("merged"));
  commit(wt("merged"), "m.txt", "merged work"); sh(repo, "merge", "-q", "--ff-only", "claude/merged");
  // 2 merged branch with no worktree
  sh(repo, "branch", "old-merged");
  // 3 unmerged clean worktree
  sh(repo, "worktree", "add", "-q", "-b", "codex/feature", wt("feature"));
  commit(wt("feature"), "f.txt", "add feature f");
  // 4 merged but dirty (detached)
  sh(repo, "worktree", "add", "-q", "--detach", wt("dirty"));
  writeFileSync(path.join(wt("dirty"), "a.txt"), "edited\n");
  // 5 locked
  sh(repo, "worktree", "add", "-q", "--detach", wt("locked")); sh(repo, "worktree", "lock", "--reason", "deploy", wt("locked"));
  // 6 the caller's own checkout
  sh(repo, "worktree", "add", "-q", "-b", "claude/self", wt("self"));
  // 7 a process stands in it
  sh(repo, "worktree", "add", "-q", "--detach", wt("inuse"));
  sleeper = spawn("sleep", ["60"], { cwd: wt("inuse"), stdio: "ignore" });
  // 8 build-engine gate worktree (live build toggled below)
  sh(repo, "worktree", "add", "-q", "--detach", path.join(repo, ".pandacorp/run/gate-worktree"));
  // 9 gitignored owner state inside a merged worktree
  sh(repo, "worktree", "add", "-q", "--detach", wt("owner"));
  mkdirSync(path.join(wt("owner"), ".pandacorp/inbox/changes"), { recursive: true });
  writeFileSync(path.join(wt("owner"), ".pandacorp/inbox/changes/card.md"), "owner card\n");
  // 10 patch-equivalent (cherry-picked into main)
  sh(repo, "branch", "codex/picked");
  sh(repo, "checkout", "-q", "codex/picked"); commit(repo, "p.txt", "picked change"); const picked = sh(repo, "rev-parse", "HEAD");
  sh(repo, "checkout", "-q", "main"); commit(repo, "q.txt", "main moves on"); sh(repo, "cherry-pick", picked);
  // 11 nested worktree inside a merged clean one
  sh(repo, "worktree", "add", "-q", "--detach", wt("outer"));
  sh(repo, "worktree", "add", "-q", "--detach", path.join(wt("outer"), "inner"));
  // 12 missing directory
  sh(repo, "worktree", "add", "-q", "--detach", wt("gone")); rmSync(wt("gone"), { recursive: true, force: true });
  // 13 dirty unmerged worktree to discard
  sh(repo, "worktree", "add", "-q", "-b", "claude/wip", wt("wip"));
  commit(wt("wip"), "w.txt", "wip commit");
  writeFileSync(path.join(wt("wip"), "untracked.txt"), "keep me\n");
  mkdirSync(path.join(wt("wip"), ".pandacorp/inbox"), { recursive: true });
  writeFileSync(path.join(wt("wip"), ".pandacorp/inbox/note.md"), "owner note\n");

  console.log("scan — read-only classification");
  const s = sweep(["scan", "--repo", repo, "--self", wt("self")]);
  ok(s.code === 0 && s.json, "scan exits 0 with JSON");
  const by = (pred) => s.json.items.find(pred);
  const W = (n) => by((i) => i.path === wt(n));
  ok(s.json.defaultBranch === "main", "default branch resolves to main");
  ok(W("merged")?.decision === "safe" && W("merged").actions.includes("delete-branch"), "merged + clean worktree is safe, and its branch goes with it");
  ok(by((i) => i.kind === "branch" && i.branch === "old-merged")?.decision === "safe", "merged branch without worktree is safe");
  ok(W("feature")?.decision === "ask" && W("feature").suggestion.action === "integrate" && W("feature").ahead === 1, "unmerged worktree is ask → integrate (+1)");
  ok(W("feature")?.subject === "add feature f", "item carries the last commit subject");
  ok(W("dirty")?.decision === "ask" && W("dirty").uncommitted === 1, "merged but dirty worktree is ask with its uncommitted count");
  ok(W("locked")?.decision === "protected" && W("locked").reason === "locked", "locked worktree is protected");
  ok(W("self")?.decision === "protected" && W("self").reason === "self", "the caller's own checkout is protected");
  ok(W("inuse")?.decision === "protected" && W("inuse").reason === "in-use", "a worktree a process stands in is protected");
  ok(by((i) => i.path?.endsWith(".pandacorp/run/gate-worktree"))?.decision === "safe", "idle build's gate worktree, merged + clean, is safe");
  ok(W("owner")?.decision === "ask" && W("owner").ownerState.includes(".pandacorp/inbox/changes/card.md"), "gitignored owner state blocks auto-removal and is listed");
  ok(by((i) => i.branch === "codex/picked")?.suggestion?.action === "discard", "patch-equivalent branch is ask → discard (content already in main)");
  ok(W("outer")?.decision === "ask" && W("outer").nested.includes(path.join(wt("outer"), "inner")), "a worktree holding a nested worktree is never auto-removed");
  ok(by((i) => i.path === wt("gone"))?.decision === "safe", "a worktree whose directory is gone is safe to prune");
  ok(W("wip")?.decision === "ask", "dirty unmerged worktree is ask");

  console.log("live build — engine-owned worktrees are untouchable");
  writeFileSync(path.join(repo, ".pandacorp/status.yaml"), `phase: implementation\nrunning: true\nsupervisor_heartbeat: ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}\n`);
  const live = sweep(["scan", "--repo", repo, "--self", wt("self")]);
  ok(live.json.items.find((i) => i.path?.endsWith(".pandacorp/run/gate-worktree"))?.reason === "live-build", "running: true protects the gate worktree");
  writeFileSync(path.join(repo, ".pandacorp/status.yaml"), "phase: implementation\nrunning: false\n");
  mkdirSync(path.join(repo, ".pandacorp/run/build.lease"), { recursive: true });
  writeFileSync(path.join(repo, ".pandacorp/run/build.lease/lease.json"), JSON.stringify({ renewed_at: "2020-01-01T00:00:00Z", ttl_seconds: 60, epoch: 1 }));
  const leased = sweep(["scan", "--repo", repo, "--self", wt("self")]);
  ok(leased.json.items.find((i) => i.path?.endsWith(".pandacorp/run/gate-worktree"))?.reason === "live-build", "a stale (resumable) lease still protects it");
  rmSync(path.join(repo, ".pandacorp/run/build.lease/lease.json"));
  rmdirSync(path.join(repo, ".pandacorp/run/build.lease")); // Simulate full release; an orphaned lease directory must fail closed.

  console.log("recent activity — merged + clean but just used");
  const recent = sweep(["scan", "--repo", repo, "--self", wt("self")], "3");
  ok(recent.json.items.find((i) => i.path === wt("merged"))?.reason === "recent-activity", "idle < PANDACORP_STALE_HOURS holds a merged worktree for the owner");

  console.log("clean — only the safe set, never --force / -D");
  const dry = sweep(["clean", "--repo", repo, "--self", wt("self"), "--dry-run"]);
  ok(dry.code === 0 && existsSync(wt("merged")) && dry.json.removed.length > 0, "--dry-run reports without removing");
  const c = sweep(["clean", "--repo", repo, "--self", wt("self"), "--also", wt("merged")], "3");
  ok(c.code === 0 && !existsSync(wt("merged")), "--also lifts the recent-activity hold for a named item");
  const c2 = sweep(["clean", "--repo", repo, "--self", wt("self")]);
  ok(c2.code === 0, "clean exits 0");
  const branches = sh(repo, "branch", "--format=%(refname:short)").split("\n");
  ok(!branches.includes("claude/merged") && !branches.includes("old-merged"), "merged branches deleted with -d");
  ok(!existsSync(path.join(repo, ".pandacorp/run/gate-worktree")), "idle gate worktree removed");
  ok(!sh(repo, "worktree", "list").includes(wt("gone")), "missing-directory entry pruned");
  for (const n of ["feature", "dirty", "locked", "self", "inuse", "owner", "outer", "wip"]) ok(existsSync(wt(n)), `${n} untouched`);
  ok(existsSync(path.join(wt("owner"), ".pandacorp/inbox/changes/card.md")), "owner-state file intact");
  ok(branches.includes("codex/feature") && branches.includes("codex/picked") && branches.includes("claude/wip"), "unmerged branches untouched");

  console.log("discard — owner-confirmed, archived first");
  ok(sweep(["discard", "--repo", repo, "--target", "claude/wip"]).code === 3, "discard without --confirmed refuses (exit 3)");
  ok(sweep(["discard", "--repo", repo, "--self", wt("self"), "--target", wt("locked"), "--confirmed"]).code === 3, "discard of a protected item refuses");
  const d = sweep(["discard", "--repo", repo, "--self", wt("self"), "--target", "claude/wip", "--confirmed"]);
  ok(d.code === 0 && !existsSync(wt("wip")), "confirmed discard removes the worktree");
  ok(!sh(repo, "branch", "--format=%(refname:short)").split("\n").includes("claude/wip"), "and its branch");
  const ref = d.json?.steps?.find((x) => x.action === "archive")?.ref;
  ok(ref?.startsWith("refs/pandacorp-archive/"), "an archive ref was written");
  const files = ref ? sh(repo, "ls-tree", "-r", "--name-only", ref).split("\n") : [];
  ok(files.includes("w.txt") && files.includes("untracked.txt") && files.includes(".pandacorp/inbox/note.md"), "archive holds the commits, the untracked file and the owner-state file");
} finally {
  sleeper?.kill();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
