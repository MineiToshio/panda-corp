---
id: BL-0147
type: bug
area: build-engine
title: "close-out (notify-end) re-runs the full whole-project verify.sh minutes after verify-patch already ran it green on the same HEAD sha"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "canary A launch 2026-09-22, canary-a-report.md — independent review batch 3"
closes:
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
- The new scenarios above are green in `test-pandacorp-build.mjs`.
- `bash plugin/scripts/run-engine-tests.sh` is green.
- A real (or synthetic, wall-clock-measured) close-out run after a `verify-patch` green on the
  same sha shows the reused path in its log, and the measured close-out duration drops
  accordingly — recorded in this item's `closes:` on completion.

## Out of scope
Changing `verify-patch`'s own scope decision, or anything about the Stop gate (`verify-before-stop.sh`,
a different caller with its own rigor-scoped logic, REV3 defect D2). This item only teaches
close-out to notice a report `verify-patch` already produced for the SAME commit.
