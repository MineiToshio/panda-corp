---
id: BL-0294
type: change
area: build-engine
title: "implement's supervisor loop watches only WO status changes; a run that parks every chain at once produces no status transition to notice"
status: open
severity: p2
opened: 2026-10-31
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-30/31 (agent-inferred) — a build run parked all in-flight chains at once; the supervisor's own progress check (WO status transitions) stayed silent throughout, and only landed-commit cadence, the parked-chain count and a Claude-fallback event would have surfaced the stall"
closes:
links: [LESSON-0565, BL-0131, BL-0135]
---

## Problem
The `/pandacorp:implement` supervisor pattern infers "the run is alive and making progress" primarily
from work-order `implementation_status` transitions (per `status.yaml`/the build journal). On a run
observed in mission-control (2026-10-30/31), every in-flight chain parked (stalled) at the same time, but
none of the parked work orders had a status-field change — so the one signal the supervisor was watching
stayed silent for the whole stall. The run was, in fact, observably unhealthy on other axes the supervisor
did not check: landed-commit cadence went flat, the count of chains sitting in a parked state was
nonzero/rising, and execution had fallen back to a different agent/runtime ("Claude fallback") than the
one that started the step — none of which is visible from the WO status field alone.

## Root cause
The supervisor's health/progress check treats WO status as the sole liveness signal. It has no
independent check for (a) landed-commit cadence, (b) the count/age of parked chains, or (c) a runtime
fallback event — so a run that stalls in a way that does not happen to flip any WO's status (every chain
parked simultaneously, with no single status transition to key off) looks identical to "nothing new to
report" rather than "the run is stuck."

## Fix plan
Extend the supervisor's periodic health check (the same loop that already renews leases / watches
`last_event_at`) to combine three signals instead of one:
1. **Landed-commit cadence** — track the timestamp of the last landed commit for this run; flag staleness
   past a threshold the same way `last_event_at`/`supervisor_heartbeat` staleness is already flagged.
2. **Parked-chain count** — surface the count of chains currently in a parked state (and how long each has
   been parked) as part of the health tick, not just WO status.
3. **Runtime-fallback events** — when execution falls back from the expected agent/runtime to another one,
   emit a distinct logged event the supervisor's health check can see, rather than leaving it inferable
   only from status.yaml/transcript inspection after the fact.
A health tick where WO status is silent AND any of (1)-(3) indicates trouble should surface the same way
a stale lease does today (visible to the owner / the Mission Control health reminder), not stay silent.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a scripted run where every in-flight chain parks at the same tick with no WO status change, but
landed-commit cadence stalls and a runtime-fallback event fires. RED (current supervisor): the health
check reports nothing wrong (WO status silent). GREEN (fixed): the health check flags the run as unhealthy
from the commit-cadence/parked-count/fallback signals even though WO status never changed.

## Done when
- The supervisor's health tick combines WO status with landed-commit cadence, parked-chain count and
  runtime-fallback events; a run that stalls on all chains at once is flagged even with zero WO status
  transitions.
- New test(s) pass; existing supervisor/health-tick tests stay green.
- Plugin version bumped (PATCH/MINOR per the change) and `plugin/docs/decision-log.md` records it.

## Out of scope
Fixing the root cause of why chains parked in the first place (that is whatever specific defect caused
this run's stall) — this item is about making the supervisor's OWN liveness check notice the stall, not
about any one parking cause.
