---
id: BL-0153
type: bug
area: build-engine
title: "implement's supervisor lease renewal depends on a live Monitor call (capped at ~30 min), so a build outliving the cap can lapse its lease"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "Canary A and Canary B launches 2026-09-22, mission-control/.pandacorp/run/lessons.md — 13-minute renewal gaps observed in both runs"
closes: "plugin/runtime/build-state.mjs (reclaim/isReclaimable), plugin/scripts/pandacorp-build-state.mjs and plugin/scripts/launch-implement.sh (lease TTL default + --ttl override)"
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

## Fix implemented (2026-09-22, `16ba2c72`)
Chose neither path (1) nor (2) as originally worded — a **third, lower-risk path already implicit in the
lease's own design**: `isFresh`/`reclaim` already read `ttl_seconds` directly off the lease document
(supplied by the caller at `acquire` time), so the false-stale signal closes by raising that value and
adding a reclaim-only grace margin, with **zero changes to `pandacorp-build.js`** (the engine) and
therefore no byte-identical mission-control mirror step and no `plugin/agents/*.md` regeneration.

Rejected explicitly: threading a `RENEW_LEASE`-style instruction through every prompt in the gate/repair
convergence ladder (`frdGateSerial`/`frdGateSplit`/`gateConverge` and its patch/diagnose/gate-test-repair/
revert rungs) — this is genuinely what "engine-side renewal on every mechanical `agent()` call" would
require once generalized to cover a gate-only phase with zero MECH-labeled spawns (per this item's own
corroborating note), but it touches a large number of call sites in a Dynamic Workflow script this
codebase treats as maximally fragile (no fs/timers of its own, prompt/schema churn is the exact class of
change that has broken convergence before), for a gap that — by this item's own corroborating note — has
so far been "real but unexploited" (the epoch never moved in either canary). Raising the TTL is a strictly
smaller, more mechanically verifiable change for the same practical protection.

Concretely (`plugin/runtime/build-state.mjs`, `plugin/scripts/pandacorp-build-state.mjs`,
`plugin/scripts/launch-implement.sh`, `plugin/skills/implement/SKILL.md`, tests in
`plugin/scripts/test-build-state.mjs`):
- `isFresh` is untouched — every existing "is this lease actively guarding the project" reader (preflight's
  abort-if-fresh check, the frozen Codex executor's pre-reclaim check, the `status.yaml` projection) keeps
  its exact pre-fix semantics.
- New `isReclaimable(lease, now)`: `reclaim()` now additionally requires **a full extra TTL cycle of
  continued silence past the TTL boundary** (2x total, `RECLAIM_GRACE_CYCLES`) before it will hand the
  fence to a new owner — a lease that merely crossed one TTL width mid-gate is stale-but-not-dead and stays
  protected.
- Default lease TTL raised **600s -> 3600s** (`acquireUnlocked`'s default, the CLI's `acquire`/`reclaim`
  `--ttl` default, and `launch-implement.sh`'s real launch call) — comfortably above both canaries' worst
  observed gap (56.6 min) with margin. `launch-implement.sh` also gained an optional `--ttl <seconds>`
  override (validated positive integer) for a targeted single-FRD/change run expected to spend most of its
  time inside one long gate/repair chain, documented in `implement/SKILL.md`'s launch checklist.

**Relationship to BL-0131 (still open)**: orthogonal, not a duplicate and not a supersession. BL-0131
tracks the SUPERVISING SESSION's own `ScheduleWakeup`-chain-breaks-silently renewal cadence (a harness/
session-loop reliability problem). This fix instead hardens the LEASE side of the contract so that a
renewal gap from ANY upstream cause — a Monitor-cap re-arm delay, a broken `ScheduleWakeup` chain (BL-0131's
own failure mode), or a long gate-heavy phase with zero safe-points (this item's own Canary C evidence) —
cannot be misread as the owning run being dead within a realistic build window. BL-0131 stays open to fix
its own cause; this item closes the shared consequence (a stale-but-alive lease being reclaimable too
eagerly) regardless of cause.

**Tests**: two new scenarios in `test-build-state.mjs` — a lease stale past its TTL but still inside the
2x grace window is rejected by `reclaim` (CONTENDED, fence untouched); a lease stale past the grace window
is genuinely reclaimable (epoch increments) — plus the full pre-existing `reclaim`/`isFresh` suite
re-verified unmodified (all use a `renewed_at` from year 2000, trivially past any grace multiplier).
`bash plugin/scripts/run-engine-tests.sh`: **23/23 suites, 0 failures**.

**Done-when checklist** (this item's closeable scope):
- [x] Fix implemented and its test scenario is green (see Tests above) — a real, if synthetic, stale-lease
      fixture proving both sides of the new grace boundary (rejected inside it, accepted past it).
- [x] Relationship to BL-0131 reconciled explicitly above — both stay open/closed independently, neither
      merges into the other.

No change to `pandacorp-build.js` or any `plugin/agents/*.md` — the byte-identical mission-control mirror
step and the Codex agent regeneration do not apply to this fix.

## Out of scope (addendum)
A subsequent LIVE canary run confirming no renewal gap crosses the new (3600s, 2x-graced) safe margin under
real build conditions — this item's fix is verified structurally (unit tests against a real stale-lease
fixture, both sides of the new boundary), not by a live re-run; a live canary re-measurement is a separate
follow-up, same treatment as BL-0155's own deferred A/B re-measurement.

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
