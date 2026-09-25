---
id: BL-0179
type: bug
area: build-engine
title: "close-out verify reuse (BL-0147) has never actually reused a report in a live run — every FRD gate emits scope:since, only notify-end's own reuse-check runs scope:full"
status: open
severity: p2
opened: 2026-09-25
closed:
source: "canary D report §6, canary-d-report.md — 0 CloseOutVerifyReused events across D1+D2 and the entire dashboard-events.ndjson history"
closes:
links: [BL-0147]
---

## Problem
BL-0147 (closed 2026-09-22, plugin 9.106.0) taught `notify-end` to reuse an existing full-green
`gate-report.json` at `HEAD` instead of re-running `.pandacorp/verify.sh` in full — 7 unit scenarios
(`BL-0147a`-`g`) are green in `test-pandacorp-build.mjs`. But canary D's live measurement
(`canary-d-report.md` §6) found the mechanism has **never fired in a real run**: both D1's and D2's
`notify-end` ran `bash .pandacorp/verify.sh` **completely, without `--since`**, and
`grep -c CloseOutVerifyReused ~/.claude/dashboard-events.ndjson` returns **0 across the ENTIRE event
history**, not just this canary's window. The per-WO cost of paying the full suite a second time
(hundreds of seconds, the exact waste BL-0147 targeted) is still being paid on every close-out.

## Root cause (confirmed, not yet fixed)
Every FRD gate in a real run stamps its `gate-report.json` with `scope: "since"` (the focused,
last-green-onward gate — `verify.sh --since <last_green_sha>`, the fast path every gate actually
takes per `gateFocusedStep`'s non-evidence branch). BL-0147's reuse-check
(`close-out-verify-reuse-check`) only licenses reuse when the report's `scope` is EXACTLY `"full"` AND
`green:true` AND fresh AND at `HEAD` AND the tree is clean — a `since`-scoped report is deliberately
excluded (the WP-08 partial-report cage, correctly, since a `since` scope did not verify the WHOLE
project). In practice, the ONLY thing that ever produces a `scope:"full"` report is `notify-end`
itself (and the JUDGE-BASELINE pre-check at run start) — so the reuse-check's own target condition is
essentially unreachable from the normal per-FRD gate path, and it has apparently never found a
qualifying report to reuse in any run observed so far.

## Fix plan (two options, NOT decided — this item captures the choice, does not make it)
1. **Accept a `since` report whose base matches `last_green_sha`.** If the report's `scope` is
   `"since"` AND its `since` anchor equals the CURRENT `last_green_sha` (i.e., nothing has landed that
   this report didn't already cover) AND it is green/fresh/at-HEAD/clean-tree, treat it as equivalent
   coverage to a full report for reuse purposes — requires auditing that a `since`-scoped run really is
   a superset-safe substitute for `full` (it skips nothing a full run would have caught, GIVEN the
   anchor is correct), which is the exact safety property BL-0147's cage was built to protect.
2. **Make the LAST gate of a run itself run full**, when it is the final FRD before close-out (i.e.,
   `notify-end` is about to happen next) — so that gate's own report becomes the exactly-once full-green
   report `notify-end` can legitimately reuse. Costs the same wall-clock as today's status quo on a
   single-FRD run, but removes today's DOUBLE payment on a multi-FRD run (only ONE of the N FRD gates
   pays full, not the gates AND notify-end separately).
Either option needs a live canary to confirm `CloseOutVerifyReused` actually fires afterward — the
unit-level scenarios already prove the MECHANISM works when handed a qualifying report; they do not
prove a qualifying report is ever produced.

## Tests (prove the fix — TDD, RED → GREEN)
Whichever option is chosen: extend `test-pandacorp-build.mjs` with a scenario shaped like a REAL
per-FRD gate's report (`scope:"since"`, matching `last_green_sha`) reaching `notify-end`'s reuse-check,
asserting it NOW reuses (currently it does not — that is this item's RED). Live proof: re-run a canary
and grep `dashboard-events.ndjson` for a non-zero `CloseOutVerifyReused` count.

## Done when
A decision is made between option 1/2 (or a third); the engine implements it; a live canary run shows
at least one real `CloseOutVerifyReused` event; `docs/decision-log.md` records the choice and the
live-run evidence.

## Out of scope
This item does not implement either option — it documents the confirmed live gap BL-0147's own
"NOT VERIFIED here" note anticipated, so the sprint's close-out does not silently claim BL-0147 as
fully proven in production.
