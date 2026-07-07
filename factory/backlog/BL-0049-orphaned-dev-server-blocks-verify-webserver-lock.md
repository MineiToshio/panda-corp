---
id: BL-0049
type: bug
area: build-engine
title: "Baseline self-heal does not detect an orphaned next dev process blocking verify.sh's Playwright webServer"
status: open
severity: p2
opened: 2026-07-06
closed:
source: "mission-control/.pandacorp/run/lessons.md 2026-07-06 (FRD-17 build, agent-inferred) — verify.sh's own webServer step failed with 'Another next dev server is already running'"
closes:
links: [LESSON-0040, BL-0037]
---

## Problem
During the FRD-17 build on Mission Control, `verify.sh`'s Playwright `webServer` step failed with
Next.js's own error "Another next dev server is already running" — even though the port Playwright's
config targets was free. Next.js detects a prior `next dev` invocation via its own lock mechanism
(independent of port binding), so a stray orphaned `next dev` process left running from an earlier
session (e.g. a Preview dev-server session, or an aborted prior verify run) blocks a completely fresh
`verify.sh` run regardless of which port it targets. The existing baseline self-heal step in the build
engine (DR-067) only covers dirty/conflicted git trees and stale build stashes — it has no check for a
leftover `next dev` process. This is a DIFFERENT mechanism than BL-0037 (a foreign process legitimately
occupying the reserved e2e port): here the port can be free and the failure still happens, because
Next's lock is process-level, not port-level.

## Root cause
Next.js's dev-server lock file/mechanism persists after a `next dev` process is orphaned (parent session
ended without a clean shutdown), and neither the build engine's baseline self-heal nor
`/pandacorp:upgrade`'s pre-canary step checks for or clears this lock before invoking `verify.sh`.

## Fix plan
1. Add a preflight step (baseline self-heal, alongside the existing DR-067 dirty-tree/stash checks, or
   in `verify.sh` itself before the Playwright `webServer` step runs) that detects an orphaned `next dev`
   process for THIS project (matching cwd/project path, not just any `next dev` on the machine) and
   either kills it cleanly or surfaces an actionable message ("a stale next dev process from a previous
   session is blocking this run; terminate PID <n> before continuing") instead of letting Playwright
   surface Next's raw lock error.
2. Consider wiring the same check into `/pandacorp:upgrade`'s pre-canary step, since upgrades also run
   `verify.sh` and could hit the same stale-lock condition after a Preview session.
3. Keep this check distinct from BL-0037's port-occupant check (different failure signature: Next's own
   lock error text vs. an unrelated process answering on the reserved port) — they can share the same
   preflight phase but should assert on different signals.

## Tests (prove the fix — TDD, RED → GREEN)
- **Orphan-lock detection:** start a `next dev` process for the project and leave it running (simulating
  an orphan from a prior session), then run `verify.sh` — it must detect and clear/report the stale lock
  BEFORE Playwright's webServer step times out with the generic Next.js error. Today it surfaces Next's
  raw "Another next dev server is already running" message after Playwright's own timeout.
- **Clean run unaffected:** with no prior `next dev` process running, `verify.sh` passes normally (no
  false-positive detection).

## Done when
`verify.sh` (or the build engine's baseline self-heal) detects and clears/reports an orphaned `next dev`
process for the current project before Playwright's webServer step runs, proven by the two test cases
above; plugin version bumped per semver.

## Out of scope
BL-0037's port-occupant-by-a-different-process case (already tracked separately); building a general
process-management daemon.
