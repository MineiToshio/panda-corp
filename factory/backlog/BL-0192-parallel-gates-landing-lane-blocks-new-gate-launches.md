---
id: BL-0192
type: bug
area: build-engine
title: "parallelGates: a landing (the whole convergeOne ladder) is awaited inline at the loop top, so no new gate launches into free slots while a verdict lands"
status: open
severity: p1
opened: 2026-09-25
closed:
source: "canary E partial run 2026-09-25 (docs/reviews/canary-e-partial-report.md §3), wf_7a12ea20-7f1"
closes:
links: [BL-0186, BL-0190, BL-0191, DR-118]
---

## Problem
Under `args.parallelGates` (BL-0186) the scheduler lands one settled verdict per iteration:
`plugin/templates/shared/.claude/engines/pandacorp-build.js:4104`,
`if (gateResults.length) { await landParallelVerdict(); continue }`.

A landing is not short. For a reopen it is the whole `convergeOne` ladder: port the reviewer tests, patch, hash,
verify-patch, and on a refusal also revert, the in-run retry build, commit and a re-gate. `launchParallelGates()` is
reached only at `:4165`, after the landing returns. So while one FRD converges, free slots stay idle and gate-ready
FRDs wait.

Measured in canary E (2 slots, 4 FRDs):
- Slot 2 was free from 21:47:04 and slot 1 from 21:51:41, until 22:03:31. That is **≈ 28 slot-minutes idle**, with 0
  live gates from 21:51:41.
- FRD-04/05 were gate-ready from launch and **never started a gate in 36 min**. There was no `⏸ D1: gate … deferred`
  log for them: `launchParallelGates` never ran with a free slot.
- FRD-02's PASS waited **12 min** unlanded behind FRD-03's ladder. The ladder's commits then made FRD-02's pin stale,
  forcing a stale-pin re-verify it would not otherwise have needed.

This is the exact overlap D1 exists to buy, so canary E could not measure D1's throughput.

## Root cause
The lane serializes *landings* on main, which is correct: a landing needs a quiet main tree. But because the lane is
awaited synchronously, it also serializes gate *launches*. Slots never touch main. Each slot is a detached worktree at
its own pin, and the stale-pin guard (`stalePinGuard`, `:3971`) already re-verifies on main any PASS whose pin main
has moved past. So launching a gate during a landing does not endanger main.

## Fix plan
1. Top up the slots before every landing. Under `PARALLEL_GATES`, call `launchParallelGates()` (after `capturePin`
   for unpinned FRDs) **before** `await landParallelVerdict()` at `:4104`. This is the minimal fix: slots freed by
   the previous settle get work before the lane blocks.
2. Better: run the lane as a background promise (`laneInFlight`). The loop then keeps launching gates into slots
   that free up during a long ladder, and idle-waits on `Promise.race([lane, ...gatesInFlight])`. At most one landing
   at a time, and no wave dispatch while `laneInFlight` (main must stay quiet).
3. Pinning during a landing: capture the pin of a gate launched mid-landing at the lane's **pre-landing HEAD**
   (snapshotted when the landing starts), never at a mid-ladder HEAD that holds an uncertified patch commit. The
   landing-time stale-pin guard covers the delta.
4. Budget: keep `gateReserved` + `GATE_LANDING_COST` eligibility, and also reserve the in-flight landing's remaining
   ladder cost so an early launch cannot starve it.

## Tests (prove the fix — TDD, RED → GREEN)
Add engine harness scenarios in `plugin/scripts/test-pandacorp-build.mjs`:
- **Setup**: 2 slots, 3 gate-ready FRDs. FRD-A's gate settles first with a reopen, and its patch response is slow
  (several ticks). FRD-B's gate is still in flight.
- **Expect**: FRD-C's `gate:` label is spawned **before** FRD-A's `verify-patch:` returns (ordering on call
  timestamps or sequence). This is RED today.
- **Pin**: FRD-C's pin equals the pre-landing HEAD, not FRD-A's patch commit.
- **Main quiet**: no `build:`/wave dispatch while a landing is in flight.

## Done when
- [ ] The scenarios are RED → GREEN, and the full engine harness is green.
- [ ] A canary E relaunch shows gates for FRD-04/05 starting while FRD-03 converges.

## Out of scope
Parallel landings (the lane stays exclusive). The evidence-collector Bash-timeout stall (canary E report §4.3) is a
separate item.
