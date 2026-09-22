---
id: BL-0154
type: bug
area: build-engine
title: "mission-control/e2e/server-env.json hardcodes port 3900 for the whole repo, colliding across the Stop hook, worktree builds and parallel gates"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "observed 6+ times during today's speed-sprint canary launches (Stop hook + parallel worktree gates + canary builds all racing for the same port)"
closes:
links: []
---

## Problem
`mission-control/e2e/server-env.json` pins `"PORT": "3900"` as a fixed constant read by Playwright's e2e
config (`mission-control/playwright.config.ts`). Because this value is the SAME across every checkout of
the repo — the main dev checkout, every DR-096 worktree spun up for a parallel session, every gate
worktree the build engine pins per FRD, and every canary worktree from today's sprint — any two of these
that need to run the Playwright e2e suite (or the Stop gate, which shells out to it) at the same time
collide on the same port. This was observed 6+ times today across the Stop hook, builds running in
parallel worktrees, and the canary gate runs, each fighting over `:3900`, producing spurious "address
already in use" failures unrelated to the actual code under test.

## Root cause
`launch.json`'s app dev-server ports already solved this exact class of problem with `autoPort`
(`worktree-bootstrap.sh` step 2 flips a worktree's `launch.json` to `autoPort: true`, letting the OS assign
a free port per worktree, named `-<slug>` so N parallel worktrees never collide). `server-env.json` is a
SEPARATE, independent port declaration for the e2e/Playwright server that was never brought under the same
mechanism — it is a static committed value, not something `worktree-bootstrap.sh` (or any other
worktree-entry step) rewrites per worktree.

## Fix plan
Extend `worktree-bootstrap.sh` (or add an equivalent step to whatever provisions a worktree before its
gates run) to also rewrite `mission-control/e2e/server-env.json`'s `PORT` field to an OS-assigned free port
per worktree — the same `autoPort`-via-`jq` pattern step 2 already uses for `launch.json`, applied to this
second, independent port declaration. Confirm `playwright.config.ts` reads `PORT` from `server-env.json` at
run time (not baked into a cached config) so the rewrite actually takes effect without further changes
there.

## Tests (prove the fix — TDD, RED → GREEN)
A test that provisions two worktrees via `worktree-bootstrap.sh` (or a scoped harness around just this
step) and asserts their resulting `server-env.json` `PORT` values differ and are both free at assertion
time. A regression test confirming a single worktree's e2e suite still runs and passes with its
now-dynamic port (no behavior change for the non-parallel case).

## Done when
- `worktree-bootstrap.sh` rewrites `server-env.json`'s `PORT` to a free, worktree-specific value on every
  worktree provision, proven by the new test.
- Two Playwright e2e runs launched concurrently in two different worktrees no longer collide on the same
  port (verified live once, or via the test harness above if a live double-run is impractical in CI).
- `bash plugin/scripts/run-engine-tests.sh` stays green.

## Out of scope
Making the main (non-worktree) dev checkout's own e2e port dynamic — this item targets the PARALLEL-
worktree collision specifically; the main checkout running e2e alone on `:3900` was never the problem.
