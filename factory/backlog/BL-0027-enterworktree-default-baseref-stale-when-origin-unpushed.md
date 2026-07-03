---
id: BL-0027
type: bug
area: build-engine
title: "EnterWorktree's default baseRef ('fresh' from origin/<default-branch>) silently misses recent work when origin lags local main"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md — 2026-07-0x, harvested via /pandacorp:memory"
closes:
links: []
---

## Problem
`EnterWorktree`'s default `baseRef` behavior ("fresh") branches the new worktree from
`origin/<default-branch>`. In a project whose `origin` remote was never pushed/updated recently (a real
observed case in personal-page-v2), `origin/main` is wildly behind the local `main` — so a "fresh"
worktree silently misses recent work: missing scripts, stale docs, stale config, with no warning that the
base is stale. The only workaround found in the moment was manual: `git worktree add -b <name> main`
directly, then attach the session via `EnterWorktree{path: ...}`.

## Root cause
The tool assumes `origin/<default-branch>` is a reliable, up-to-date proxy for "the latest merged work" —
true only when the remote is actively kept in sync with local `main`. It has no check comparing
`origin/<default-branch>` against local `main` and no fallback/warning when they diverge significantly.

## Fix plan
In the `EnterWorktree` tool/mechanism (locate its implementation under the build engine / plugin script
that materializes worktrees), before branching from `origin/<default-branch>`: compare it against local
`main` (e.g. `git rev-list --left-right --count origin/main...main`); if local `main` is ahead by more
than a small threshold (or `origin/<default-branch>` doesn't exist / can't be fetched), branch from local
`main` instead (or warn loudly and require an explicit `baseRef` override) rather than silently using the
stale remote ref.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a local repo where `origin/main` is deliberately several commits behind local `main` (simulate via
a bare remote not pushed to after some local commits). RED: current `EnterWorktree` default behavior
creates a worktree missing the local-only commits. GREEN: after the fix, the worktree includes the
local-only commits (or the tool clearly warns and requires an explicit override). Script-assertable via a
shell fixture comparing the worktree's `git log` against local `main`'s.

## Done when
- `EnterWorktree`'s default baseRef resolution accounts for local main being ahead of origin (falls back
  to local main, or warns + requires explicit override) instead of silently using a stale origin ref.
- The RED→GREEN fixture test passes.
- `closed:` + `closes:` set, `status: done`.

## Out of scope
Changing the tool's behavior when origin IS kept in sync (the common case) — this only targets the
divergent-origin edge case.
