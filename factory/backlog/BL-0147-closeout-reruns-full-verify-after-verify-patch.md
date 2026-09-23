---
id: BL-0147
type: bug
area: build-engine
title: "close-out (notify-end) re-runs the full whole-project verify.sh minutes after verify-patch already ran it green on the same HEAD sha"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "canary A launch 2026-09-22, canary-a-report.md — independent review batch 3"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js close-out/notify-end (all 4 full-verify call sites) + plugin/templates/stack-a-nextjs/verify.sh gate-report.json sha field — b739b867"
links: []
---

## Problem
In canary A, the close-out step (`notify-end`) invoked the whole-project `.pandacorp/verify.sh`
(a full, unscoped run — tests + typecheck + lint/format + build + dead-code + circular-deps +
the browser gates) and it took **373s**. This happened only a few minutes AFTER `verify-patch`
had already run a **whole-project, green** gate over the exact same `HEAD` sha as part of the
per-FRD gate flow immediately before it. The two runs verified the identical commit end to end,
back to back, and the second one bought nothing: no code changed between them, so its verdict
could only ever repeat the first.

Impact: every close-out pays the full gate's wall-clock cost a second time even when nothing
changed since the last full-green run this same launch already produced — pure waste on the
owner's build-time budget, and it compounds on every FRD-heavy build (canary A's close-out is not
a one-off; it is the shape of every close-out today).

## Root cause
`verify-patch` (the per-FRD gate step) and `notify-end` (close-out) each decide independently
whether to run the whole-project suite, with no shared memory of "a full green already happened at
this exact sha, minutes ago." Nothing propagates `verify-patch`'s own gate-report (sha + scope +
green + timestamp) forward to `notify-end`, so close-out has no way to know it would be re-proving
an already-proven fact — it always runs the maximal, safest thing it knows how to run, which today
means paying the full suite again rather than trusting a report it never looks at.

## Fix plan
In the close-out step (`notify-end`, `plugin/templates/shared/.claude/engines/pandacorp-build.js`):
before invoking the whole-project `verify.sh`, read `.pandacorp/run/gate-report.json` (or
`last-green.json`, whichever the engine already writes at `verify-patch` time). If
`last_green_sha == HEAD` AND that report's `scope` is `full` AND `green: true` AND it is MORE
RECENT than the last commit on `HEAD` (i.e. nothing landed since it ran), close-out reuses that
report's verdict instead of re-running the whole suite — and only runs what that report could not
have covered (the browser layer's visual/responsive passes, when those didn't run as part of
`verify-patch`'s own scope). Log which path was taken (`reused-verify-patch-report` vs
`full-rerun`) so the saving is auditable, not silent. Never trust a report older than `HEAD` or
scoped `since`/`partial` — those still fall through to a full run exactly as today.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`: a new scenario asserting that when `verify-patch`'s own
mocked response records a full green gate-report at the close-out commit's sha, the `notify-end`
step's own `agent()`/verify invocation is SKIPPED (or reuses the cached verdict) rather than
re-run — and a sibling scenario proving a STALE or `since`-scoped report still triggers the full
close-out run (no relaxation of the safety net). Cover both via `run-engine-tests.sh`.

## Done when
- [x] The new scenarios above are green in `test-pandacorp-build.mjs` (7 BL-0147 scenarios: reuse on
  full+green+same-sha+clean tree; no-reuse on `since` scope, sha mismatch, dirty tree; parity across
  the hardened close-out AND both notify-end shapes; the unscripted default never reuses). Confirmed
  RED against the pre-fix engine (`git stash` on the engine file alone): 6/7 failed as expected.
- [x] `bash plugin/scripts/run-engine-tests.sh` is green, run twice, 24/24 suites both times (also
  fixed `test-build-engine.mjs`'s own stub, which reaches the same close-out prompts independently
  and needed the same new label wired into its default response).

## Implementation note (deviation from the original fix plan)
The fix plan above assumed `verify-patch`'s own run directly populates a full+green
`gate-report.json` the close-out could trust by construction. On reading the actual engine
(`verifyPatched`/`attemptPatch`), the FRD-gate-time "whole-project" checks run raw `pnpm
vitest`/`tsc`/`biome` commands, not `.pandacorp/verify.sh` itself — so they never produce a
`gate-report.json` at all, and `verify.sh` had no `sha` field to key on. Implemented instead: (1)
`verify.sh` now stamps the commit `sha` it verified into every `gate-report.json` it writes; (2) a
new read-only MECH spawn (`close-out-verify-reuse-check`) runs right before each of the 4 full-verify
call sites (lean/legacy × close-out/notify-end) and independently re-checks `git rev-parse HEAD` +
`git status --porcelain` + the report's `scope`/`green`/`sha`/age against a 900s ceiling — reusing
ANY sufficiently fresh full-green report (e.g. one the JUDGE-BASELINE pre-check at run start left
behind, or the previous run's own close-out), not narrowly "verify-patch's". This is a superset of
the requested behavior and keeps the WP-08 partial-report cage fully intact (a `since`/`partial`
report never licenses reuse).

## Out of scope
Changing `verify-patch`'s own scope decision, or anything about the Stop gate (`verify-before-stop.sh`,
a different caller with its own rigor-scoped logic, REV3 defect D2). This item only teaches
close-out to notice a report `verify-patch` already produced for the SAME commit. Also out of scope:
re-syncing `mission-control/.pandacorp/verify.sh` (the project's own installed copy) — it picks up
the new `sha` field on its next `/pandacorp:upgrade`, same as any other template change. And: a real
(or synthetic, wall-clock-measured) live close-out run proving the reused path fires and the measured
duration drops — NOT VERIFIED here (CONV-13: no live canary was run as part of this item, source-level
TDD only); a live re-measurement is a natural follow-up, the same shape as BL-0155's own deferred
re-measurement.
