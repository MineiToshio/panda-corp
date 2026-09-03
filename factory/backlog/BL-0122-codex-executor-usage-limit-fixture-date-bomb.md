---
id: BL-0122
type: bug
area: build-engine
title: "test-codex-executor.mjs usage_limit fixtures hardcode a now-lapsed reset_at timestamp -- 2 assertions fail"
status: done
severity: p2
opened: 2026-09-03
closed: 2026-09-03
source: "implementer session for BL-0069 (wiring CI for the plugin/scripts/test-*.mjs corpus), 2026-09-03 -- found while proving the new run-engine-tests.sh runner against the REAL corpus (agent-inferred)"
closes: "plugin v9.102.4, plugin/docs/decision-log.md"
links: [LESSON-0151, BL-0069]
---

## Problem
`plugin/scripts/test-codex-executor.mjs` currently fails 2 of its 51 assertions (`node
plugin/scripts/test-codex-executor.mjs` exits 1, "RESULT: 49 passed, 2 failed"):

- "exact post-dispatch exec rollout classifies a silent exit as usage_limit with reset_at"
- "explicit reached-limit telemetry classifies usage_limit even below 100 percent"

Both expect `cp.uncertain.reset_at === 1784730769` (a Codex rollout fixture's `resets_at` field), but
the dispatcher now classifies the outcome as `terminal_reason: "uncertain"` with a generic
`usage_limit`/no plausible `reset_at`, per the live failure output captured this session.

## Root cause
`1784730769` is a hardcoded Unix timestamp = **2026-07-22T14:32:49Z** (verified: `python3 -c
"import datetime; print(datetime.datetime.utcfromtimestamp(1784730769))"` -> `2026-07-22
14:32:49`). Today is 2026-09-03 -- the fixture's "future reset" timestamp is now **in the past**.
Whatever plausibility check the dispatcher applies to a rollout's `resets_at` (rejecting an
implausible/past reset time -- the suite explicitly also covers an `rollout-reset-implausible`
scenario nearby) now also rejects this fixture's timestamp, because it has itself lapsed. This is a
live instance of exactly the failure mode LESSON-0151 describes (a suite passes when authored, then
silently rots as wall-clock time moves past a hardcoded fixture value) and exactly the kind of rot
BL-0069's new CI trigger (`.github/workflows/factory-engine-tests.yml`) exists to surface instead of
letting it sit unnoticed.

## Fix plan
Replace the hardcoded `1784730769` (and any sibling hardcoded absolute timestamps in the same rollout
fixture family) with a timestamp computed relative to `Date.now()` at test-run time (e.g. `Math.floor
(Date.now() / 1000) + 3600` for "resets in 1 hour"), matching how `rollout-stale` and
`rollout-reset-implausible` already compute their timestamps relative to `now` a few lines up in the
same file. Re-run `node plugin/scripts/test-codex-executor.mjs` and confirm all assertions pass with
no hardcoded absolute time literals remaining in the fixture.

## Tests
RED = today, `node plugin/scripts/test-codex-executor.mjs` exits 1 with the 2 failures above. GREEN =
after the fix, the same command exits 0 with all assertions passing, re-run once more a day later (or
with the system clock advanced) to confirm the fixture no longer depends on the current date.

## Done when
`node plugin/scripts/test-codex-executor.mjs` exits 0, and no assertion in the file depends on an
absolute hardcoded timestamp that will lapse again.

## Out of scope
Any other pre-existing failure in the `plugin/scripts/test-*.mjs` corpus not covered by this file;
auditing every other suite for similar date-bombs (a good candidate for a follow-up sweep, not this
item).

## Closing evidence — 2026-09-03

Fixed exactly per the Fix plan: the fake-codex fixture's `reset=` computation
(`plugin/scripts/test-codex-executor.mjs`) now reads `scenario==='rollout-reset-implausible'?9999999999
:(Math.floor(Date.now()/1000)+3600)` — resets one hour out from whenever the test actually runs,
matching how `rollout-stale`/`rollout-reset-implausible` already compute relative to `now`. The two
assertions that compared `reset_at` against the literal `1784730769` now use a new `isNearFutureReset()`
helper (`Number.isSafeInteger(value) && value > nowSeconds && value <= nowSeconds + 3700`) instead of an
exact-equality match, since the fixture value and the assertion now run in two different processes a
moment apart. `node plugin/scripts/test-codex-executor.mjs` -> `RESULT: 51 passed, 0 failed` (was 49
passed, 2 failed). `grep -n 1784730769 plugin/scripts/test-codex-executor.mjs` -> no matches: no
hardcoded absolute timestamp literal remains anywhere in the file. `bash
plugin/scripts/check-derived-drift.sh` and `claude plugin validate plugin/` both clean.

The Tests section's "re-run a day later / with the clock advanced" is satisfied by construction rather
than executed literally (advancing the system clock is out of bounds for this session): the fixture's
reset value and the assertion's plausibility window are now BOTH derived from `Date.now()` at their own
call time, with no fixed literal in between, so there is no absolute date left in the file that could
lapse again -- the previous failure mode (a value that is fine today, stale in six weeks) cannot recur
here.
