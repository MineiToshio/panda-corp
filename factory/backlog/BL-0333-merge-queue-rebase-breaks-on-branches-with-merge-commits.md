---
id: BL-0333
type: bug
area: templates
title: "merge-queue.sh's plain 'git rebase <default-branch>' linearizes a branch that already contains merge commits from main, dropping their conflict resolutions and handing back a false conflict"
status: open
severity: p2
opened: 2026-11-21
closed:
source: "panda-corp agent-inferred note, 2026-11-21: 'merge-queue.sh uses plain git rebase main: a branch carrying Merge branch main commits is linearized and the merges conflict resolutions are dropped, so even with main an ancestor the queue exit 10s (rebase conflict). Squash the branch to a linear history on mains tip first (DR-141 squash note); keep a backup ref.'"
closes:
links: [DR-096, DR-141]
---

## Problem

`plugin/templates/shared/.pandacorp/merge-queue.sh` always lands a branch with
`git rebase "$DEFAULT_BRANCH"` (around line 696). This assumes the branch's history is a pure sequence
of the author's own commits on top of some ancestor of `$DEFAULT_BRANCH`. When the branch instead
contains one or more `Merge branch 'main'/'<default>' into <branch>` merge commits (e.g. produced by
`git merge main` during a long-running session to stay current), `git rebase` REPLAYS each commit on the
merge-commit's first-parent chain individually — it does not understand "this commit was already a
resolved merge," so any conflict that merge commit had already resolved resurfaces as a REBASE CONFLICT
the queue cannot auto-resolve (exit 10, "rebase conflict git can't auto-resolve"), even though
`$DEFAULT_BRANCH` is a true ancestor of the branch's tip and the actual diff already reconciles cleanly.
The agent's own workaround was to manually squash the branch to a single linear commit on
`$DEFAULT_BRANCH`'s tip (mirroring DR-141's batch-landing squash procedure, `build-orchestration.md`
lines ~396-410) before re-queueing — a manual step with no guidance or automation in `merge-queue.sh`
itself.

## Root cause

`git rebase` replays each commit (including the commits a merge commit's first-parent chain pulled in)
individually against the new base; it has no notion of "this set of changes was already resolved as a
merge" the way `git rebase --rebase-merges` (preserving merge structure) or a pre-squash would. A branch
produced by interleaving `git merge main` with normal work hits this; `merge-queue.sh` has no detection
for "this branch already contains merge commits" before attempting a plain rebase, and no fallback when
the rebase conflicts despite the branch's tip being a true descendant of `$DEFAULT_BRANCH^{commit}`
(i.e., a case where a squash-then-rebase, or `git rebase --rebase-merges`, would succeed cleanly where a
plain rebase does not).

## Fix plan

1. Before calling `git rebase "$DEFAULT_BRANCH"`, detect whether the branch contains merge commits since
   its merge-base with `$DEFAULT_BRANCH` (`git log --merges <merge-base>..<branch> --oneline`).
2. When merge commits are present, either (a) rebase with `--rebase-merges` instead of the plain form, or
   (b) squash the branch to a single commit on the current `$DEFAULT_BRANCH` tip first (same mechanism
   as the DR-141 batch procedure) before the normal flow continues — pick whichever preserves per-author
   commit messages/attribution expectations documented elsewhere in `merge-queue.sh`; keep a backup ref
   to the pre-squash tip in both cases so the original history is recoverable.
3. If a rebase conflict is still hit after this change, the hand-back message (exit 10) should mention
   the merge-commit detection outcome, so the agent isn't left guessing why an ancestor-safe branch
   failed to land cleanly.
4. Bump plugin PATCH + `OVERLAY_VERSION` (merge-queue.sh ships in the overlay); record in
   `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)

A fixture repo where a feature branch includes a `git merge main` partway through (with a conflict
resolved at merge time) and main has since advanced further: landing through `merge-queue.sh` today
conflicts on rebase (RED); after the fix it lands cleanly (GREEN), with the final tree matching what a
manual squash-then-rebase would produce.

## Done when

- [ ] The new fixture test passes; the existing rebase/landing suites show no regression.
- [ ] Plugin + overlay versions bumped; decision-log entry.

## Out of scope

Changing the DR-141 batch-landing squash procedure itself (already documented and working); this item is
scoped to the single-branch landing path's handling of a branch that already contains merge commits.
