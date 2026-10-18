---
id: BL-0249
type: bug
area: templates
title: "worktree-bootstrap.sh lists already-removed worktrees as active"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "funko-tracker architecture phase 2026-10-17 (several worktree cycles); docs/proposals/architecture-skill-v2.md"
closes:
links: [DR-096, DR-099]
---

## Problem

`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` ends with "worktree ready. Other active worktrees:" and
prints `ls "$MANIFEST_DIR"` (one JSON manifest per worktree it ever bootstrapped). A manifest is never removed when
its worktree is removed (`ExitWorktree(action: remove)`, `git worktree remove`), so after a few cycles the list shows
worktrees that no longer exist. In funko-tracker the architecture phase cycled several worktrees; the stale entries
read as parallel sessions still running, which the DR-099 rules then tell an agent to stay away from.

## Root cause

The listing trusts the manifest directory as the source of truth instead of `git worktree list --porcelain`, and no
remove path deletes the manifest.

## Fix plan

1. Print only manifests whose `path` is present in `git worktree list --porcelain` (and still exists on disk); list
   the stale ones separately as "stale manifest (worktree gone)" or prune them (move, never `rm -r` a `.pandacorp/`
   directory: PROTECTED STATE PATHS; deleting one stale manifest file is allowed).
2. Optionally prune the manifest in the WorktreeRemove hook (`plugin/scripts/warn-worktree-remove.sh`).
3. Plugin PATCH + `OVERLAY_VERSION` PATCH (the script ships in the overlay) + decision-log.

## Tests (prove the fix — TDD, RED → GREEN)

`plugin/scripts/test-worktree-bootstrap.sh`: bootstrap two worktrees, `git worktree remove` one, bootstrap a third →
the "active" list names only the live one (RED today: it names the removed one too).

## Done when

- The test passes inside `run-engine-tests.sh`; versions bumped; decision-log entry.
