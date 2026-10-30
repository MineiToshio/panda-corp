---
id: BL-0289
type: bug
area: hooks
title: "block-dangerous.sh's SERVER_KILL_TARGETS covers dev-server binaries but not named gate/orchestration scripts (verify.sh), so pkill -f verify.sh is still host-wide-kill allowed"
status: open
severity: p2
opened: 2026-10-30
closed:
source: "funko-tracker .pandacorp/run/lessons.md (undated, agent-inferred) via librarian harvest, paired with LESSON-0551; extends BL-0223/BL-0282"
closes:
links: [BL-0223, BL-0282, LESSON-0530, LESSON-0551]
---

## Problem
`plugin/scripts/block-dangerous.sh`'s `SERVER_KILL_TARGETS` regex (added by BL-0223, extended by
BL-0282) refuses a host-wide `pkill -f`/`killall` matching a fixed list of dev-server/test-runner
BINARY names: `next|node|nodejs|vite|vitest|playwright|pnpm|npm|npx|tsx`. It does NOT cover the
factory's or a project's own named gate/orchestration SCRIPTS — `verify.sh`, `merge-queue.sh`, a
project's own build script, etc. An agent running `pkill -f verify.sh` to stop a hung local gate is
currently ALLOWED by the hook, even though on a machine running several concurrent agent sessions (each
possibly running its own `verify.sh`) this kills every session's gate by command-line substring match,
not just the caller's own — the exact hazard BL-0223 already fixed for dev-server binaries, now in an
uncovered sibling category. See `LESSON-0551` for the generalizable lesson this pairs with.

## Root cause
`SERVER_KILL_TARGETS` enumerates BINARY names a dev server/test runner process would be named. A gate
or orchestration script invoked as `bash verify.sh` (or `./verify.sh`) has a command line containing
the SCRIPT'S name, not one of the enumerated binaries, so the regex never matches. The original fix's
scope (BL-0223) was framed entirely around "servers," so named orchestration scripts were never
considered as a sibling risk category.

## Fix plan
1. Add a second, explicit token list to `block-dangerous.sh` for known project/factory gate and
   orchestration script basenames (`verify.sh`, `merge-queue.sh`, `worktree-bootstrap.sh`, and any
   other script the overlay ships that agents commonly background/foreground as a long-running
   process) — reuse the same `pkill|killall` + pattern-match detection path already in place for
   `SERVER_KILL_TARGETS`, pointing the block message at "record the PID when you start it (`$!`) and
   stop only that PID / process group" (same hint as the server case).
2. Make the list extensible per-project (an overlay-level config or a comment pointing at where to add
   a project's own named scripts), since projects may add their own long-running named scripts the
   factory's default list cannot anticipate.
3. Keep `kill <PID>`, `kill -- -<PGID>`, `pkill -P <PID>` allowed, unchanged.

## Tests (prove the fix — TDD, RED → GREEN)
- `plugin/scripts/test-block-dangerous.sh`: `pkill -f verify.sh` and `pkill -f merge-queue.sh` are
  refused (RED today: allowed); `kill $PID` and `pkill -P $PID` against a verify.sh PID stay allowed.
- Regression: existing `SERVER_KILL_TARGETS` cases (next/node/vite/vitest/playwright/pnpm/npm/npx/tsx)
  stay refused — no behavior change to the existing category.

## Done when
- [ ] Hook refuses host-wide kills of named gate/orchestration scripts; new test cases green.
- [ ] Plugin version bumped (PATCH); decision log entry written.
- [ ] Codex agent mirrors regenerated if any agent-facing hint text changed.

## Out of scope
Changing the hook's detection mechanism itself (command-position scan, pid-list-to-kill detection) —
this item only extends the token coverage to a new category of process name.
