---
id: BL-0216
type: bug
area: build-engine
title: "a lease renewal that never settles now suppresses every later renewal silently (BL-0213's in-flight guard), so the Codex lease can age past its TTL with no lease_lost"
status: open
severity: p2
opened: 2026-09-30
closed:
source: "second red-team of the BL-0212/0213/0214 batch (2026-09-30), attack 6 (executor mutex / lease TTL)"
closes:
links: [BL-0213, BL-0166]
---

## Problem
BL-0213 replaced `setInterval(() => renew(...))` with `setInterval(heartbeat)`, where `heartbeat()` returns at once while
`renewInFlight` is true (`plugin/runtime/codex/executor.mjs`, `heartbeat`). That fixed the real defect (stacked
renewals starving the mutation mutex). But `renewInFlight` is cleared only in the `finally` of the awaited `renew()`.
If one renewal never settles (a filesystem call inside `withMutex` that hangs: a network volume, a stalled disk), every
later tick returns immediately: no renewal, no error, no `lease_lost` event, no SIGTERM. The lease (`leaseTtlSeconds`,
default 600 s, `PANDACORP_LEASE_TTL_SECONDS`) then ages past its TTL while the executor keeps dispatching; another
runtime may reclaim a stale lease, and this executor only finds out at its next fenced mutation.
Before BL-0213 the same hang produced stacked renewals that timed out `CONTENDED` and ended the run with `lease_lost`
(loud). The guard turned a loud failure into a silent one for this one case.

Related, loud (documented, not a defect): `controllerOnlyStatusDelta` now reads under `withFence`; a renewal holding
the mutex longer than `withMutex`'s ~100 × 10 ms budget makes the dispatch delta throw `CONTENDED` and the run stops
with that code on stderr (BL-0213's own "130 ms rename variant starves occasionally" note). Deadlock is not possible:
`delta()` is never called inside another `withFence`/`withMutex` callback (checked: every caller runs after
`dispatch()`), and the mutex reclaims a stale owner after 60 s.

## Root cause
The in-flight flag has no deadline: "one renewal at a time" is enforced, "a renewal finishes in bounded time" is not.

## Fix plan
1. Record `renewStartedAt` when a renewal starts. In `heartbeat()`, when `renewInFlight` and
   `Date.now() - renewStartedAt > stallMs` (`stallMs = max(5 × renewIntervalMs, leaseTtlSeconds × 500)`, i.e. half the
   TTL), emit `lease_lost` with `renewal stalled <n> ms`, `announceStop`, and `SIGTERM` itself — once.
2. Keep the guard (never stack renewals).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-codex-executor.mjs`: a slow-disk preload variant whose `rename` of `lease.json.tmp-*` never
resolves after the first renewal (`new Promise(() => {})`), `PANDACORP_LEASE_TTL_SECONDS=3`,
`PANDACORP_LEASE_RENEW_MS=100` → the executor exits non-zero within ~3 s with `renewal stalled` on stderr and a
`lease_lost` journal line. RED today: it keeps dispatching with a lease that is never renewed.

## Done when
- [ ] A renewal that never settles ends the run loudly before the lease's TTL.
- [ ] `run-engine-tests.sh` green (three consecutive batteries, BL-0213's bar).

## Out of scope
Making the dispatch delta tolerate a long-held mutex (it fails loud, which is correct).
