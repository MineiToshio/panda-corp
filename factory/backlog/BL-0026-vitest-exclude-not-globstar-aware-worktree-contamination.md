---
id: BL-0026
type: bug
area: templates
title: "vitest.config.ts template's exclude glob is not globstar-aware, so a left-over worktree's own node_modules test files leak into the main checkout's gate"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md — 2026-07-0x, harvested via /pandacorp:memory"
closes:
links: []
---

## Problem
The project template's `vitest.config.ts` uses `exclude: ["e2e/**", "node_modules/**"]`. This pattern is
not globstar-aware relative to nested directories: when a git worktree created under
`.claude/worktrees/*/` is left materialized (not auto-removed after landing), vitest run from the MAIN
checkout scans dependency test files nested under
`.claude/worktrees/<name>/node_modules/**` — because `node_modules/**` only matches a top-level
`node_modules` directory, not one nested several levels down inside a worktree path. This REDs the main
checkout's gate for a completely unrelated reason: hundreds of false failures from a dependency's own
test suite (e.g. `filing-cabinet`, `tsconfig-paths`) that happens to live inside the stray worktree's
`node_modules`. Observed in personal-page-v2's build (raw lesson note, tag `gap ·`).

## Root cause
`exclude: ["node_modules/**"]` is anchored relative to the vitest root and only matches a single-level
`node_modules` directory at that root, not `**/node_modules/**` anywhere in the tree. A left-over worktree
directory under `.claude/worktrees/` has its own full `node_modules` several path segments deep, which the
current pattern does not reach.

## Fix plan
In the project template's `vitest.config.ts` (and any already-generated projects' copies, via the next
`/pandacorp:upgrade` sync), change the exclude pattern from `"node_modules/**"` to `"**/node_modules/**"`
(globstar-aware, matches at any depth) — optionally also add an explicit `".claude/worktrees/**"` exclude
as belt-and-suspenders so a materialized worktree is never scanned by the main checkout's vitest run
regardless of what's inside it. Locate the canonical template file (search `plugin/templates/` or the
project-scaffold source for `vitest.config.ts`) and apply the same fix there.

## Tests (prove the fix — TDD, RED → GREEN)
Create a fixture: materialize a `.claude/worktrees/fixture/node_modules/some-pkg/some-pkg.test.ts` file
containing a deliberately failing test, in a throwaway test project using the template. RED: run vitest
with the CURRENT exclude pattern and confirm the fixture's failing test is picked up (contaminates
results). GREEN: apply the `**/node_modules/**` fix and confirm the same vitest run no longer discovers
or runs the fixture file. A `verify.sh --canary`-style assertion or a documented manual repro (if
automating the fixture is impractical) is acceptable.

## Done when
- The canonical `vitest.config.ts` template's `exclude` array uses a globstar-aware `**/node_modules/**`
  pattern (and/or an explicit `.claude/worktrees/**` exclude).
- The RED→GREEN fixture test above passes.
- Existing projects pick up the fix via their next `/pandacorp:upgrade` overlay sync (no manual backport
  required beyond that).
- `closed:` + `closes:` set, `status: done`.

## Out of scope
Auto-removing stale worktrees after landing (a separate concern — this item only fixes the gate's
exclusion pattern so a stray worktree can't silently contaminate results).
