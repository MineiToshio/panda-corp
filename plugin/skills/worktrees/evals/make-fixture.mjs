#!/usr/bin/env node
// Builds a throwaway repository for the /pandacorp:worktrees evals: node make-fixture.mjs <dir> <mixed|live-build|old-experiment>
// Every worktree's activity is back-dated 5 days so only the classification (not recency) decides the outcome.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const [dir, variant = "mixed"] = process.argv.slice(2);
if (!dir) { console.error("usage: make-fixture.mjs <dir> <mixed|live-build|old-experiment>"); process.exit(2); }
const old = new Date(Date.now() - 5 * 86_400_000);
const ENV = { ...process.env, GIT_AUTHOR_NAME: "owner", GIT_AUTHOR_EMAIL: "o@x", GIT_COMMITTER_NAME: "owner", GIT_COMMITTER_EMAIL: "o@x", GIT_AUTHOR_DATE: old.toISOString(), GIT_COMMITTER_DATE: old.toISOString() };
const git = (cwd, ...a) => { const r = spawnSync("git", a, { cwd, env: ENV, encoding: "utf8" }); if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`); return r.stdout.trim(); };
const commit = (cwd, f, msg) => { writeFileSync(path.join(cwd, f), `${msg}\n`); git(cwd, "add", f); git(cwd, "commit", "-qm", msg); };
const repo = path.join(dir, "app");
const wt = (n) => path.join(dir, n);

mkdirSync(repo, { recursive: true });
git(repo, "init", "-q", "-b", "main");
writeFileSync(path.join(repo, ".gitignore"), ".pandacorp/\n");
git(repo, "add", ".gitignore"); git(repo, "commit", "-qm", "init");
commit(repo, "README.md", "readme");
mkdirSync(path.join(repo, ".pandacorp/run"), { recursive: true });
writeFileSync(path.join(repo, ".pandacorp/status.yaml"), "phase: implementation\nrunning: false\n");

// common: a merged + clean session worktree, a merged branch, an unmerged feature worktree, a locked deploy snapshot
git(repo, "worktree", "add", "-q", "-b", "claude/fix-header", wt("app-fix-header"));
commit(wt("app-fix-header"), "header.txt", "fix(header): align logo");
git(repo, "merge", "-q", "--ff-only", "claude/fix-header");
git(repo, "branch", "release-notes-oct");
git(repo, "worktree", "add", "-q", "-b", "codex/price-alerts", wt("app-price-alerts"));
commit(wt("app-price-alerts"), "alerts.txt", "feat(alerts): email when a tracked price drops");
git(repo, "worktree", "add", "-q", "--detach", wt("deploy-snapshot"));
git(repo, "worktree", "lock", "--reason", "launchd-served deployment", wt("deploy-snapshot"));

if (variant === "mixed") {
  git(repo, "worktree", "add", "-q", "--detach", wt("review-app"));
  writeFileSync(path.join(wt("review-app"), "README.md"), "edited during a review\n");
}
if (variant === "live-build") {
  git(repo, "worktree", "add", "-q", "--detach", path.join(repo, ".pandacorp/run/gate-worktree-1"));
  writeFileSync(path.join(repo, ".pandacorp/status.yaml"), `phase: implementation\nrunning: true\nsupervisor_heartbeat: ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}\n`);
}
if (variant === "old-experiment") {
  git(repo, "checkout", "-q", "-b", "codex/old-experiment");
  commit(repo, "exp.txt", "spike: try a GraphQL layer");
  git(repo, "checkout", "-q", "main");
}

// back-date every worktree's HEAD log so nothing reads as recently active
const admin = path.join(repo, ".git", "worktrees");
if (existsSync(admin)) for (const n of readdirSync(admin)) { const f = path.join(admin, n, "logs", "HEAD"); if (existsSync(f)) utimesSync(f, old, old); }
console.log(repo);
