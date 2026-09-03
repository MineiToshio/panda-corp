---
id: BL-0105
type: change
area: hooks
title: "Wire a WorktreeRemove soft warning for unmerged work — today the check only exists as an owner-run script"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-21"
closes:
links: []
---

## Problem
`plugin/templates/shared/.pandacorp/pending-work.sh:2-12` unions surviving worktrees with
`git branch --no-merged` — but only when the owner remembers to run it. The `WorktreeRemove` hook event is
unused, so removing a worktree that still holds unmerged work produces no signal at the moment it matters
(DR-096 §7). Impact: silent loss of unmerged work in a workflow that creates one worktree per backlog item.

## Fix plan
Wire a `WorktreeRemove` hook that runs the same check and emits a **soft warning** when the worktree's
branch has unmerged commits. A **hard block dies** — `factory/decisions/registry.yaml:574` is the precedent
for preferring a visible warning over a `PreToolUse` deny on this class of action. Net-new machinery:
sequence after Wave 0.

## Tests (prove the fix — TDD, RED → GREEN)
Create a worktree with an unmerged branch, attempt removal, and confirm a visible warning fires and the
removal still proceeds. Confirm a fully-merged worktree removes silently.

## Done when
The hook is wired as a warning (never a block); both repros above are recorded; plugin version bumped and
`plugin/docs/decision-log.md` noted.

## Out of scope
Any hard `PreToolUse` block (explicitly rejected, `registry.yaml:574` — do not re-litigate).
