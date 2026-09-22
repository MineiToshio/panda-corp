---
id: BL-0146
type: bug
area: build-engine
title: "test-codex-enforcement.mjs leaked its pc-enforcement-* fixture events into the real, shared ~/.claude/dashboard-events.ndjson"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "canary B launch 2026-09-22 (canary-b-report.md investigation) — confirmed live in ~/.claude/dashboard-events.ndjson"
closes: "af84dcfa fix(tests): isolate test-codex-enforcement.mjs from the real events stream (BL-0146)"
links: []
---

## Problem
`f2-rigor-levels-stop-hook` made `verify-before-stop.sh` emit a `StopGate` event on every stop-gate
run, falling back to `$HOME/.claude/dashboard-events.ndjson` (the REAL, shared telemetry stream Mission
Control's Party panel reads) whenever `PANDACORP_EVENTS_LOG` is unset. `test-codex-enforcement.mjs`'s
`hook()` helper spawned the adapter with the bare `process.env` (no override), so its `mkdtemp`
`pc-enforcement-*` fixture projects leaked `StopGate` lines into the real stream on every run — 15
contaminated lines confirmed live from two consecutive `run-engine-tests.sh` runs on 2026-09-22, the
same day the canary B investigation was run. Impact: the shared telemetry stream — read by every
concurrent Pandacorp session's Mission Control panel — accumulates test noise indistinguishable from
real build activity unless a reader specifically filters `pc-enforcement-*` project ids.

## Root cause
`test-codex-enforcement.mjs`'s `hook()` helper spawned the enforcement adapter subprocess without
setting `PANDACORP_EVENTS_LOG`, so the adapter's own fallback-to-`$HOME` default applied inside the
test suite exactly as it would in production — the test never isolated its own I/O side effect from
the shared, global sink other concurrent sessions and Mission Control depend on.

## Fix plan
Already shipped on `main` (commit `af84dcfa`, 2026-09-22, ahead of this backlog item's filing):
`hook()` in `plugin/scripts/test-codex-enforcement.mjs` now sets a scratch `PANDACORP_EVENTS_LOG` by
default — the same isolation pattern `test-verify-before-stop.sh` already used — so fixture runs never
touch the real stream.

## Tests (prove the fix — TDD, RED → GREEN)
`af84dcfa` added a regression test to `plugin/scripts/test-codex-enforcement.mjs` asserting that
nothing appended to the REAL stream during that test run matches the fixture's `pc-enforcement-`
project id prefix. The assertion checks content (a prefix match), not whole-file identity, because the
real stream is legitimately shared and appended to by other concurrent Pandacorp sessions — a
whole-file diff would false-positive on any parallel session's own real activity.

## Done when
- [x] `hook()` isolates `PANDACORP_EVENTS_LOG` by default (commit `af84dcfa`).
- [x] The regression test asserting no `pc-enforcement-*` leakage into the real stream is present and green.
- [x] `bash plugin/scripts/run-engine-tests.sh` is green (verified 2026-09-22, twice, 22/22 suites — this
      backlog item's own filing session).

## Out of scope
Auditing every OTHER test suite for the same class of leak (a broader sweep, if warranted, is its own
backlog item) — this item closes only the confirmed `test-codex-enforcement.mjs` leak the canary B
investigation surfaced.
