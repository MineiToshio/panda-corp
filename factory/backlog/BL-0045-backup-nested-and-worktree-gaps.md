---
id: BL-0045
type: bug
area: hooks
title: "backup-pandacorp-state.sh misses nested projects (>1 level) and is defeated by git worktrees (basename keying)"
status: done
severity: p2
opened: 2026-07-05
closed: 2026-07-05
resolution: "Fixed in plugin v9.72.0. F14: backup keys to the canonical repo via `git rev-parse --git-common-dir` (worktree runs no longer mis-key to the worktree basename). F13: nested projects scanned via `find -maxdepth 3 -name .pandacorp`. Proven by test-backup-and-precious.sh (6/6). Same change added run/*.sh backup + check-unbacked-precious.sh."
source: "Fable hardening sprint II WS-A adversarial guard-bypass hunt (docs/proposals/28), findings F13/F14"
closes:
links: [BL-0035]
---

## Problem
The SessionStart state backup (`plugin/scripts/backup-pandacorp-state.sh`, the BL-0035 backstop for
the historyless gitignored owner layer) has two coverage gaps proven in WS-A:

- **F13 — nested projects:** the scan globs only `$ROOT/.pandacorp` and `$ROOT/*/.pandacorp` (one
  level). A project at `packages/app/.pandacorp` is silently NOT backed up (executed: 0 files).
- **F14 — worktrees defeat it:** `REPO="$(basename "$ROOT")"` with `ROOT=$(git rev-parse
  --show-toplevel)`. Run from a git **worktree** (which the factory actively encourages via
  EnterWorktree), `ROOT` is the worktree path, so (a) the gitignored owner state doesn't exist in the
  worktree tree → a near-empty snapshot, and (b) it lands under a *different* folder
  (`~/.pandacorp-backups/<worktree-name>/`), so a session that lives in worktrees never refreshes the
  real `panda-corp` snapshot.

Neither is destructive (the WS1 visibility fix makes the "0 files" honest and visible), but the
protection silently doesn't cover the case. p2: the factory's day-to-day is a flat sibling layout
run from the main checkout, but the worktree gap is real given DR-096.

## Root cause
One-level glob + repo identity derived from the worktree basename instead of the canonical repo.

## Fix plan
1. **F14:** resolve the CANONICAL repo dir for identity + state — use `git rev-parse
   --git-common-dir` (points at the main repo's `.git` even from a worktree) and derive the real repo
   root / backup key from it, so a worktree run refreshes the true `panda-corp` snapshot from the main
   working tree's gitignored state.
2. **F13:** either deepen the project scan (`find -maxdepth 3 -name .pandacorp -type d`) or document
   the flat-layout assumption explicitly if deepening is judged not worth the scan cost.

## Tests (prove the fix — TDD, RED → GREEN)
A self-test fixture: (a) a nested `packages/app/.pandacorp` → asserts its `status.yaml` is captured;
(b) a worktree of a fixture repo → asserts the backup keys to the canonical repo name and captures
the main tree's state, not the worktree's empty one.

## Done when
Both fixtures pass, the backup covers nested + worktree cases (or documents the flat-layout limit),
plugin version bumped if the script ships via the plugin.

## Out of scope
Backup retention/rotation policy (already handled — 30-day retention).
