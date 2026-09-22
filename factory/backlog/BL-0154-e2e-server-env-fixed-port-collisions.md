---
id: BL-0154
type: bug
area: build-engine
title: "mission-control/e2e/server-env.json hardcodes port 3900 for the whole repo, colliding across the Stop hook, worktree builds and parallel gates"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "observed 6+ times during today's speed-sprint canary launches (Stop hook + parallel worktree gates + canary builds all racing for the same port)"
closes: "plugin/templates/shared/.pandacorp/worktree-bootstrap.sh new step 2b (e2e/server-env.json PORT derivation)"
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
Confirmed first: `playwright.config.ts` already reads `PORT` from `e2e/server-env.json` at run time
(`JSON.parse(fs.readFileSync(...))`, not baked into a cached config), and `verify.sh`'s playwright gate
and the Stop hook (`verify-before-stop.sh`, which just shells out to `verify.sh`) both go through that
same config — so nothing needed to change in either of those two files; fixing the ONE writer fixes
every reader for free (DR-115, one writer / everyone derives).

Added a new step 2b to `worktree-bootstrap.sh`, right after step 2's `launch.json` autoPort rewrite,
that derives a per-worktree `e2e/server-env.json` `PORT`:
- `PANDACORP_E2E_PORT` env var, if set, always wins (an operator/canary pinning a known value).
- Otherwise: a deterministic sha256 hash of the worktree's absolute path selects a starting candidate
  in `[3900,3999)` — the SAME worktree hashes to the SAME candidate every bootstrap, satisfying
  "same worktree → same port" without any stored state. A live free-port probe (`/dev/tcp` connect
  test) then walks forward from that candidate, wrapping inside the range, to resolve a hash collision
  or a leftover listener.
- Only a LINKED worktree is touched (`$WORKTREE != $MAIN_WT`); the main checkout never enters this
  branch, so its committed `3900` is untouched (matches Out of scope below). A project with no
  `e2e/server-env.json` is a no-op, not an error.

Because `server-env.json` is TRACKED (unlike gitignored `launch.json`), the local per-worktree rewrite
is hidden from `git status` with `git update-index --skip-worktree` (each linked worktree has its own
index, so this never touches the main checkout or a sibling worktree) — otherwise the file would show
permanently modified in every worktree, defeating the Stop hook's clean-tree fast-path (BL-0044,
`verify-before-stop.sh`) on every single Stop, forever, for a reason that has nothing to do with the
session's own edits.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-worktree-bootstrap.sh` section (d), 8 new assertions against the REAL script (a
real nested-topology fixture + `git worktree add`, never a reimplementation):
- a hash-derived port lands inside `[3900,3999)`;
- re-bootstrapping the SAME worktree reproduces the SAME port (deterministic, not re-randomized);
- `PANDACORP_E2E_PORT` overrides the derivation outright, on a second worktree, to a value chosen
  OUTSIDE the reserved range — so "two different worktrees end up with two different ports" is
  guaranteed by construction, not by a flaky hash-collision assumption between two random `mktemp -d`
  paths;
- the main checkout's own committed `PORT` (3900) is never rewritten by any worktree's bootstrap;
- the local rewrite does not show as dirty in `git status` (skip-worktree);
- non-`PORT` fields in `server-env.json` (`PANDACORP_FACTORY_ROOT`, `PANDACORP_EVENTS_FILE`) survive
  the rewrite untouched.

Confirmed RED against the pre-fix script (`git stash` of just the two `worktree-bootstrap.sh` copies,
test file left in place): 2 of 26 assertions failed — the override was ignored and both worktrees
stayed on the committed `3900`, exactly the collision this item reports. GREEN (26/26) with the fix.
`bash plugin/scripts/run-engine-tests.sh`: 23/23 suites green (run twice; a `test-codex-executor.mjs`
flake on the first full-suite run reproduced GREEN standalone and on an immediate full-suite rerun —
transient resource contention from this session's parallel load, unrelated to this change).

Live verification (not just the harness): bootstrapped this fix's own worktree
(`panda-corp-bl-0154`, branch `bl-0154-e2e-port`) with the real `worktree-bootstrap.sh` — it derived
`PORT → 3945` and logged it. Ran the real gate, `bash mission-control/.pandacorp/verify.sh
--only=playwright`, live: the Next dev server bound to `127.0.0.1:3945` (confirmed via `lsof`), all 68
Playwright specs passed, `.pandacorp/run/gate-report.json` recorded `"green": true` for the
`playwright` subgate, and port 3945 was cleanly freed after the run.

## Done when
- [x] `worktree-bootstrap.sh` rewrites `server-env.json`'s `PORT` to a derived, worktree-specific value
  on every worktree provision, proven by the new test (26/26, confirmed RED beforehand).
- [x] Two different worktrees derive two different ports (proven deterministically via the
  `PANDACORP_E2E_PORT` override, avoiding a flaky pairwise-hash assertion) and the main checkout's port
  is left untouched.
- [x] `bash plugin/scripts/run-engine-tests.sh` stays green (23/23, run twice).
- [x] A live Playwright run against the derived port passed end to end (68/68 specs, gate-report
  `green: true`), commit `61d6754c`.
- [x] Template (`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh`) and Mission Control's copy
  (`mission-control/.pandacorp/worktree-bootstrap.sh`) re-synced byte-identical (`cmp` confirmed).

## Out of scope
Making the main (non-worktree) dev checkout's own e2e port dynamic — this item targets the PARALLEL-
worktree collision specifically; the main checkout running e2e alone on `:3900` was never the problem.
