---
id: BL-0153
type: bug
area: build-engine
title: "implement's supervisor lease renewal depends on a live Monitor call (capped at ~30 min), so a build outliving the cap can lapse its lease"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "Canary A and Canary B launches 2026-09-22, mission-control/.pandacorp/run/lessons.md — 13-minute renewal gaps observed in both runs"
closes:
links: [BL-0131]
---

## Problem
Both live canaries launched today (Canary A, `wf_4cef213a-463`; Canary B, `wf_dd3b6dfc-257`) showed a gap
of roughly 13 minutes between the supervisor's lease renewal windows — traced to the supervising session's
own `Monitor` tool call being capped at ~30 minutes, after which the session has to notice the cap expired
and re-arm a fresh `Monitor` before it resumes observing renewal events. `implement/SKILL.md` already
mandates a dedicated ~2-min `ScheduleWakeup` heartbeat as the renewal mechanism (separate from `Monitor`,
which is meant only for the owner-facing live-progress view) — but in practice today's runs show renewal
timing riding on the SAME session loop that also re-arms `Monitor`, so when the `Monitor` cap lapses and
the session takes a few minutes to notice and re-arm, the lease-renewal cadence lapses with it. The lease
itself has a 600s TTL, so a ~13-minute gap is well past the point where a renewal should have fired.
Neither canary's build actually failed from this (the lease held or was renewed before hard expiry), but it
is the same fragility class BL-0131 already tracks (a lease-renewal mechanism silently stops re-firing with
no error), observed here specifically as a Monitor-cap side effect rather than BL-0131's ScheduleWakeup-
chain-breaks-silently mode.

## Fix plan
Two independent paths (either sufficient, prefer (1) if it doesn't conflict with BL-0131's own fix):
1. **Decouple renewal from the Monitor cap entirely.** The launcher session should leave a dedicated
   renewal process/timer that carries the lease token independently of whatever `Monitor` call is currently
   observing progress — so a `Monitor` cap expiry (and the session noticing/re-arming it) never gates
   renewal timing. This is the same direction BL-0131 proposes (fold renewal into a loop that doesn't
   depend on a chained `ScheduleWakeup`/session-turn cadence) — if BL-0131 lands first, verify it also
   closes THIS gap (a Monitor-cap dependency), not just the ScheduleWakeup-chain-breaks mode; if it
   doesn't, this item stays open as the residual case.
2. **Engine-side renewal on every mechanical `agent()` call.** Instead of relying on the SUPERVISING
   session for renewal at all, have the build engine itself renew the lease as a side effect of each
   mechanical `agent()` spawn (cheap, already happening constantly during a build) — removing the
   dependency on the external session's own Monitor/ScheduleWakeup cadence entirely.

## Tests (prove the fix — TDD, RED → GREEN)
A test/harness scenario that simulates a Monitor cap expiring mid-build (or, for the engine-side path, a
build running longer than the lease TTL with no external session activity) and asserts the lease is still
renewed within its TTL window. Cross-check against `plugin/scripts/run-engine-tests.sh`'s existing lease
tests for overlap before writing new ones.

## Done when
- Whichever fix path is chosen is implemented and its test scenario is green.
- A subsequent live canary run (or a controlled long-running test build) shows no renewal gap exceeding a
  documented safe margin under the lease TTL.
- This item's relationship to BL-0131 is reconciled explicitly in whichever item closes second (either
  merged into one, or both closed with a note on which specific gap each one fixed).

## Out of scope
Redesigning the Monitor tool's own cap (owned outside the factory, in the harness) — the fix works around
the cap, not against it.

## Corroborating occurrence — Canary C, 2026-09-23 (still not closing this item)
Canary C (`wf_1cf782d6-2ed`, `frd-23-materialized-stats-read-model`) showed the same fragility class with
its **most severe gap measured so far**. `canary-c-forensics.md` §3, sospechoso b2 ("Hueco de lease > TTL"):
lease `acquired_at 19:49:34`, next `renewed_at 20:46:10` — **56.6 minutes without renewal** (`isFresh` false
for roughly `19:59:34` to `20:46:10`), against the lease's own 600s TTL. Verdict recorded there: **"Real
pero NO causal"** — `assertFence` (`runtime/build-state.mjs:89-94`) does not check TTL at all, so the late
renewal still succeeded and nothing actually broke this run; the eventual block was decided by
`gateConverge` (the BL-0157 oracle bug), not by the lease. Root mechanism newly identified by this run,
distinct from (and sharper than) the earlier Monitor-cap framing: in a run whose build phase is dominated
by back-to-back gate attempts with **no intervening `safe-point`** (Canary C had a single continuous
prep→gate#1→repair→finders→verify-finding→gate#2 chain with the first `safe-point` only at 20:46:04, the
run's OWN first renewal since acquisition), there is structurally nothing to trigger a renewal until
everything converges — a long-gate-heavy build (no WOs to interleave `safe-point` between) is the exact
shape most exposed to this gap, worse than the ~13-minute gaps Canary A/B showed on WO-heavy builds. No
data on `reclaim` risk during the gap beyond the forensic's own note that the epoch never changed (3→3,
confirmed nobody else claimed it) — the exposure is real but unexploited in this instance. Reinforces this
item's own path (2), engine-side renewal decoupled from any external session cadence, as the fix most
directly closing this specific trigger (a gate-only build phase with zero mechanical `agent()` spawns to
piggyback a renewal on).
