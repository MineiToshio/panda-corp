---
id: BL-0097
type: change
area: hooks
title: "Measure the Stop-hook path — up to 345 s synchronous per Stop, never measured"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-70"
closes: "plugin/docs/decision-log.md v9.98.13 — real Stop-hook timings (5 runs) vs BL-0092's SessionStart ceiling"
links: [BL-0082]
---

## Problem
`plugin/hooks/hooks.json:57-79` runs three Stop hooks synchronously: `verify-before-stop.sh` (timeout 300)
+ `capture-lessons-reminder.sh` (15) + `check-derived-drift.sh` (30) = **up to 345 s per Stop**, versus the
~115 s SessionStart path that the latency argument (R-19/BL-0092) actually targets. Nobody has measured
either. Impact: if latency is the reason to change SessionStart, the heavier path deserves the same
measurement before any conclusion is drawn — and the result is the input to BL-0082's scope fix.

## Fix plan
Instrument the three Stop hooks with per-hook wall-clock timing (a timestamped line to the event stream or
a local log), run 5 Stops in the factory repo under normal conditions, and record the per-hook split in
`plugin/docs/decision-log.md`. Do **not** change any hook's behaviour in this item — it is a measurement.

## Tests (prove the fix — TDD, RED → GREEN)
Five recorded Stops with a per-hook breakdown; the numbers are written down where the next latency argument
can cite them.

## Done when
The per-hook Stop timings for 5 sessions are recorded in `plugin/docs/decision-log.md`, with the
SessionStart figures from BL-0092 alongside for comparison.

## Out of scope
Any behaviour change to `verify-before-stop.sh` (a Category-2 safety gate) and BL-0082's scope narrowing —
this item only supplies the number that decision needs.
