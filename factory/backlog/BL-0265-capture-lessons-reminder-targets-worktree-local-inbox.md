---
id: BL-0265
type: bug
area: hooks
title: "capture-lessons-reminder.sh resolves the raw lesson inbox from session cwd, losing notes written in a worktree"
status: open
severity: p2
opened: 2026-10-21
closed:
source: "factory/memory/_inbox.md note, 2026-10-20 (agent-inferred) — notes for this exact session had to be written by hand into the main checkout's inbox instead"
closes:
links: [DR-047]
---

## Problem
`plugin/scripts/capture-lessons-reminder.sh` (the Stop-hook lesson-capture backstop, DR-047 rule 8) picks
the raw inbox path purely from the hook payload's `cwd`:

```
if [ -f "$cwd/.pandacorp/status.yaml" ]; then
  inbox="$cwd/.pandacorp/run/lessons.md"          # a product project
elif [ -d "$cwd/factory/memory" ]; then
  inbox="$cwd/factory/memory/_inbox.md"           # the factory itself
else
  exit 0
fi
```

When the session's cwd is a git worktree of the factory repo (e.g. a `.claude/worktrees/<name>` checkout),
`$cwd/factory/memory` exists as a directory (it is tracked — `README.md`, `_lesson-template.md`, the
`LESSON-*.md` files, `INDEX.md`), but `_inbox.md` itself is gitignored (`.gitignore:43`) and therefore is
NOT materialized in a freshly created worktree. The hook still resolves `inbox` to that worktree-local,
nonexistent path, and any note written there is a brand-new, worktree-scoped file — invisible to the main
checkout's `_inbox.md` and permanently lost the moment that worktree is removed (worktree removal does
not archive it, per the hook's own silent write path). Observed live on 2026-10-20: lessons captured
during a worktree session had to be hand-written into the main checkout's `factory/memory/_inbox.md`
instead of relying on the hook/rule-8 default path.

## Root cause
The hook (and rule 8's own prose) assume the raw inbox always lives at a fixed, reachable path relative to
`cwd`. That assumption holds for a product project's `.pandacorp/run/lessons.md` (gitignored but
per-project, so a worktree genuinely has its own legitimate copy) but NOT for the factory's own
`factory/memory/_inbox.md`, which is meant to be a SINGLE, main-checkout-only file — there is exactly one
factory inbox, not one per worktree.

## Fix plan
In `capture-lessons-reminder.sh`'s factory branch, resolve the inbox to the MAIN checkout's
`factory/memory/_inbox.md` rather than `$cwd`'s own copy — e.g. derive the main worktree root via `git
worktree list --porcelain` (the entry with no `[detached]`/non-worktree marker that is the repo's primary
checkout) or via `git rev-parse --git-common-dir` (consistent with the pattern already used for worktree-
root resolution elsewhere, see LESSON-0111) and write/point there instead of `$cwd`. If resolving the main
checkout is itself impossible (e.g. bare clone), fail loud in the reminder text rather than silently
writing to a path that will be lost.

## Tests (prove the fix — TDD, RED → GREEN)
A test that invokes the hook with a `cwd` pointing at a scratch git worktree of a repo containing
`factory/memory/README.md` (no `_inbox.md`) and asserts the reminder text/computed inbox path resolves to
the PRIMARY checkout's `factory/memory/_inbox.md`, not a path under the worktree. RED = current script
computes `$cwd/factory/memory/_inbox.md` (the worktree-local, data-losing path). GREEN = it resolves to the
main checkout's inbox.

## Done when
`capture-lessons-reminder.sh` resolves the factory inbox to the main checkout from any worktree cwd, the
new test passes, the plugin version is bumped per DR-034 (PATCH), and a decision-log entry links this item.

## Out of scope
The equivalent question for a PRODUCT project's `.pandacorp/run/lessons.md` (that one is legitimately
per-worktree/per-project and is drained by `/pandacorp:memory harvest <project>`, not this hook) — this
item is scoped to the factory-target branch only.
