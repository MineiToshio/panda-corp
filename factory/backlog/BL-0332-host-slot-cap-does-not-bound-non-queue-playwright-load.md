---
id: BL-0332
type: bug
area: build-engine
title: "Host heavy-job slot cap (max 2) only governs merge-queue.sh's own full gate; an ad-hoc verify.sh run outside the queue is unbounded and red-locks concurrent gates under load"
status: open
severity: p2
opened: 2026-11-21
closed:
source: "mission-control overlay 9.2.0->9.6.2 upgrade, 2026-11-21 (agent-inferred): 'Full gate under host load ~20 on 10 cores (other sessions' browser gates) reds randomly with different 5-30s Playwright timeouts each run... the host-slot limit of 2 does not bound CPU when other tools run Playwright outside the slots'; corroborated the same day on funko-tracker overlay 9.4.2->9.6.2 upgrade: 'Parallel upgrade sessions each running a full gate push host load to ~22 on 10 cores: funko run 1 failed on a load-sensitive Playwright e2e... gate 1083s... run 2 at load 7.5 went green (gate 1387s)'"
closes:
links: [DR-146, DR-158, BL-0300]
---

## Problem

`plugin/templates/shared/.pandacorp/merge-queue.sh`'s `host_slot_max()` caps concurrent full-gate runs
AT THE QUEUE (`H_max = max(1, min(2, floor(ncpu/4)))`) so that at most 2 full `verify.sh` invocations run
at once through `merge-queue.sh`. On 2026-11-21, two independent sessions (mission-control and
funko-tracker) each ran a project's full gate directly (`bash .pandacorp/verify.sh`, outside
`merge-queue.sh`, as part of an overlay-upgrade comparison/profiling workflow) WHILE the merge queue's
own slot-governed gates were also running. Host load reached ~20-22 on a 10-core machine, and Playwright
specs that pass reliably in isolation failed intermittently with different 5-30s timeouts each run
(`fail-fast max-failures=1` under certification, so one flaky timeout reds the whole gate). The SAME
tree, re-run when load dropped to 7-13, went green.

The host-slot mechanism exists specifically to bound this (see the comment at
`merge-queue.sh:455-460`: "Host heavy-job (H) slot... Taken only around the full verify.sh"), but it only
wraps `merge-queue.sh`'s OWN invocation of the gate. A bare `bash .pandacorp/verify.sh` run by an agent
(for upgrade comparison, profiling, or manual verification) never acquires a host slot and is invisible
to the accounting — so two sessions each running a bare full gate, or one bare gate racing a queued one,
can push load well past what 2 slots were meant to allow, and the resulting red is reported as a project
test failure rather than the host-contention infrastructure issue it actually is.

## Root cause

`host_slot_action`/`host_slot_max` live inside `merge-queue.sh` and are invoked only from the queue's own
call path (`sed -n '576,595p' merge-queue.sh`). `verify.sh` itself has no equivalent acquire/release call
when run bare (outside the queue), so the slot count is a property of "how many `merge-queue.sh`
invocations are in flight," not "how many full gates (queue-driven or not) are in flight on this host."

## Fix plan

1. Move host-slot acquire/release into `verify.sh` itself (or a shared helper both `verify.sh` and
   `merge-queue.sh` call) for `GATE_SCOPE=full` runs, so a bare `bash .pandacorp/verify.sh` also takes a
   slot — `merge-queue.sh` already has to special-case "the queue's own full-gate call is wrapped," this
   just makes `verify.sh` the single owner of the wrapping instead of its two callers.
2. Preserve `merge-queue.sh`'s existing behavior where the queue's full-gate run reuses an inherited slot
   token across contexts (per DR-165 phase 0.5's "one inherited host slot with closed admission") — do
   not double-acquire when the queue already holds a slot and calls into `verify.sh`.
3. Decide and document whether `H_max` needs to grow (it is a function of `ncpu`, already capped at 2;
   the measured failures are well above what 2 *slot-governed* gates alone would produce, so the fix is
   making bare runs slot-aware, not necessarily raising the cap) or whether a bare full-gate run outside
   the queue should instead degrade its own Playwright concurrency/retries when the slot is unavailable.
4. Bump plugin PATCH + `OVERLAY_VERSION` (verify.sh/merge-queue.sh ship in the overlay); record in
   `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)

A fixture-backed test (alongside the existing host-slot suites) that starts `H_max` bare `verify.sh
--only=playwright` invocations plus one `merge-queue.sh` full-gate invocation concurrently on a fixture
project and asserts: at most `H_max` are ever running their Playwright stage at once (the rest wait on the
slot), RED before the fix (every invocation proceeds unslotted), GREEN after.

## Done when

- [ ] A bare `bash .pandacorp/verify.sh` full-gate run acquires/releases the same host slot
      `merge-queue.sh` uses, proven by the new test.
- [ ] No regression in the existing host-slot acquire/release/reclaim suites.
- [ ] Plugin + overlay versions bumped; decision-log entry.

## Out of scope

Raising `H_max` itself, or building a cross-session CPU governor beyond the existing slot mechanism; this
item only closes the "bare `verify.sh` is invisible to the slot" gap.
