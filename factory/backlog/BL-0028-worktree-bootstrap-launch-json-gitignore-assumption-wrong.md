---
id: BL-0028
type: bug
area: build-engine
title: "worktree-bootstrap.sh assumes .claude/launch.json is gitignored when it is git-tracked, so its autoPort rewrite creates an accidental diff"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md — 2026-07-0x, harvested via /pandacorp:memory"
closes:
links: []
---

## Problem
`.claude/launch.json` is git-tracked in project repos (confirmed in personal-page-v2), contrary to an
assumption embedded in `worktree-bootstrap.sh`'s own comment that treats it as gitignored. The bootstrap
script's `autoPort` rewrite (picking a free port for the worktree's dev server) therefore creates a local
diff in a tracked file that must be manually `git checkout --`'d before committing/merging from a
worktree — otherwise the port rewrite gets committed by accident, polluting the landed change with an
unrelated local-only port number.

## Root cause
`worktree-bootstrap.sh` was written assuming `.claude/launch.json` is gitignored (per its own comment),
but the actual project template tracks the file in git. The autoPort rewrite mutates a tracked file
in-place with no mechanism to keep the mutation local-only (no gitignore, no separate override file, no
post-merge revert step).

## Fix plan
Pick one of: (a) make `.claude/launch.json`'s port field NOT git-tracked — split it into a tracked base
config plus a gitignored local override (e.g. `.claude/launch.local.json`) that `worktree-bootstrap.sh`
writes to instead; or (b) have `worktree-bootstrap.sh` (or the merge-queue landing step) automatically
`git checkout -- .claude/launch.json` before merge/commit so the autoPort rewrite never leaks into a
landed commit. Prefer (a) — it removes the failure mode structurally rather than relying on every session
remembering to revert. Locate `worktree-bootstrap.sh` and the `launch.json` schema/consumers (preview
tooling) to confirm which fields are genuinely worktree-local vs shared.

## Tests (prove the fix — TDD, RED → GREEN)
RED: run `worktree-bootstrap.sh` in a fresh worktree, observe `git status` shows `.claude/launch.json` (or
the split local-override file, if choosing option (a) — inverted check) as modified/tracked-dirty after
the port rewrite. GREEN: after the fix, `git status` in the worktree shows no diff on the tracked
`launch.json` (or the local-only file is confirmed gitignored) after the same bootstrap run.

## Done when
- `worktree-bootstrap.sh`'s autoPort rewrite no longer leaves a diff on a tracked file needing manual
  revert before merge.
- The RED→GREEN fixture test passes.
- The script's own comment about `launch.json` being gitignored is corrected or made true.
- `closed:` + `closes:` set, `status: done`.

## Out of scope
Changing how the port itself is chosen (only how/where the choice is persisted).

## Corroborating occurrence (2026-07-12, personal-page-v2, harvested via /pandacorp:memory)
Re-hit in a later session: `worktree-bootstrap.sh`'s launch.json autoPort rewrite again left the worktree
dirty, and `merge-queue.sh`'s clean-tree preflight rejected the landing until an agent ran
`git checkout -- .claude/launch.json` by hand first. Same root cause as above, still unfixed as of this
note — no new item filed (this is the same BL-0028).
