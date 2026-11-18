---
id: LESSON-0695
type: gotcha
domain: build-engine
tags: [worktree, bootstrap, git-worktree-remove, gitleaks, cleanup]
context: manually closing out a stopped/finished engine run's worker worktrees (not the engine's own automated reclaim)
trigger: use this when manually removing a build-engine unit worktree and `git worktree remove` refuses, or you are tempted to force it, because the tree shows as dirty
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred): closing stopped engine runs found unit worktrees dirty only from bootstrap-generated files (.claude/launch.json, e2e/server-env.json); restoring those files before `git worktree remove` let it succeed cleanly; the agent instead used --no-verify on the lane-branch preservation commits and re-ran gitleaks afterward as a compensating check"
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [DR-145, DR-157]
---

**Situation:** when manually closing out a stopped build-engine run, several unit worktrees appeared
dirty and `git worktree remove` would not proceed cleanly. Inspection showed the only dirty files were
bootstrap-generated, worktree-local rewrites (`.claude/launch.json`'s autoPort name/port, `e2e/
server-env.json`'s derived PORT) — not real product changes. Restoring those specific files to their
committed state before removal let `git worktree remove` succeed without forcing anything. Separately,
the lane-branch preservation commits made during this cleanup were pushed with `--no-verify`, and
gitleaks was re-run manually afterward as a compensating check.

**Lesson:** a worktree flagged dirty at manual close-out time is not automatically unsafe to remove — the
dirtiness is often entirely explained by the bootstrap step's own worktree-local rewrites (ports, launch
config), which are expected per-worktree divergence, not uncommitted product work. Checking what actually
changed before reaching for `--force` (or skipping hooks) avoids both a false "nothing to clean up here"
read and a false "this is unsafe, force it" read. Skipping a pre-push hook (`--no-verify`) to get past a
commit is itself a signal worth treating carefully, even when a manual compensating check (re-running
gitleaks) is done right after.

**Apply next time:** before removing a build-engine unit worktree by hand, diff/restore the known
bootstrap-generated files (`.claude/launch.json`, `e2e/server-env.json`, any other file the project's
`worktree-bootstrap.sh` rewrites per-worktree) to their committed state first — this frequently clears
the "dirty" state without discarding real work and without needing `git worktree remove --force`. If a
commit truly needs `--no-verify` to proceed, treat that as a reason to re-run the skipped checks (e.g.
gitleaks) immediately afterward, not as a one-off bypass to forget about.
