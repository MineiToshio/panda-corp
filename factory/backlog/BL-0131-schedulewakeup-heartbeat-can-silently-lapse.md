---
id: BL-0131
type: change
area: build-engine
title: "implement's supervisor lease-renewal heartbeat chained via ScheduleWakeup can silently stop re-firing -- fold renewal into the Monitor loop instead"
status: open
severity: p2
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11/12 (agent-inferred) — the /pandacorp:implement supervisor's ~2min ScheduleWakeup lease-renewal heartbeat silently stopped chaining for ~25min mid-build (no error, no visible turn) while the actual build kept working fine (proven via ~/.claude/dashboard-events.ndjson SubagentStop/AgentWorking activity continuing normally). Discovered only because a routine Monitor HEALTH_TICK showed last_event_at frozen for 25min. See LESSON-0228 for the generalizable diagnostic lesson; this item is the engine-side fix."
closes:
links: [LESSON-0096, LESSON-0228]
---

## Problem
`implement/SKILL.md`'s supervisor pattern can chain periodic lease-renewal via repeated `ScheduleWakeup`
turns. On personal-page-v2 (2026-09-11), that chain silently stopped re-firing for ~25 minutes mid-build
with no error and no visible turn, while the underlying build kept working correctly the whole time
(confirmed via `dashboard-events.ndjson` SubagentStop/AgentWorking activity). This was caught only by
chance (a routine Monitor `HEALTH_TICK` noticed `last_event_at` frozen). A `ScheduleWakeup` chain is a
fire-and-forget mechanism with no built-in guarantee it keeps re-arming itself across many hops — relying
on it alone for a critical lease-renewal timer risks the lease silently expiring with no diagnostic signal.
This is a distinct, narrower finding than `LESSON-0096`/BL-0099 (which concerns spawning an agent to WAIT
for a background completion): here the SAME renewal mechanism itself proved unreliable as a chain, on a
run where the persistent `Monitor` bash loop was already running successfully alongside it.

## Root cause
`ScheduleWakeup` requires each successive turn to correctly re-issue the next wakeup call; if any one hop
is missed, dropped, or misjudged, the whole chain silently stops with no error surfaced anywhere.

## Fix plan
Fold the periodic lease-renewal side effect directly into the persistent `Monitor`'s bash loop (which
already reliably runs `sleep 15`-style loops for hours) instead of chaining repeated `ScheduleWakeup`
turns: add a `NOW - LAST_RENEW >= N` guard inside the Monitor loop that shells out to the renewal command,
sourcing token/lease-epoch from a small env file in the session scratchpad (updatable in place across a
lease-epoch bump without restarting the Monitor). Only emit an event on renewal FAILURE, not on every
success, to stay quiet. Reserve `ScheduleWakeup` for genuine "come back and decide something" checkpoints
(e.g. reacting to a Monitor `RUN_ENDED` event to chain the next targeted build), not a tight fixed-interval
mechanical action. Update `implement/SKILL.md`'s Operative-constants table/prose accordingly (it currently
names a "dedicated ~2-min ScheduleWakeup heartbeat" — see the related unresolved audit note in BL-0099's
closing evidence).

## Tests (prove the fix — TDD, RED → GREEN)
On one supervised build (or a scripted simulation of a missed `ScheduleWakeup` hop), confirm the
Monitor-loop-based renewal keeps firing on schedule even when a `ScheduleWakeup`-style hop would have been
missed. A gate canary or manual repro is acceptable per the backlog template's allowance for genuinely
hard-to-automate live-supervisor behavior — document which and why.

## Done when
`implement/SKILL.md`'s lease-renewal mechanism is Monitor-loop-based (not a ScheduleWakeup chain); the
Operative-constants table's wording matches the actual mechanism; one live supervised build confirms no
silent renewal lapse; `plugin/runtime/plugin-metadata.json` bumped and manifests regenerated.

## Out of scope
`LESSON-0096`'s own scope/wording (already resolved by BL-0099) and any change to `Monitor`'s general
contract beyond this one renewal responsibility.

## Corroborating occurrence (2026-09-22, mission-control speed-sprint canary A, run wf_4cef213a-463)
A different specific mechanism, same fragility class as this item's ScheduleWakeup-chain finding: the
supervisor's `Monitor` bash loop (capped at 30 min per the tool's own contract) left a **~13.5-minute gap**
between its expiration and its re-arming; the build's atomic lease (TTL 600 s) expired during that gap and
the engine's own end-of-build renewal attempt failed (`LEASE_RENEW_FAILED`). The build completed anyway
(the run's other liveness signals — `last_event_at`, ongoing `AgentWorking` events — stayed fresh, so
nothing treated the run as dead), but this is the second distinct way a supervisor-mounted lease-renewal
mechanism has now proven to lapse when the renewal timer's own liveness depends on a bounded/managed tool
lifecycle (a `ScheduleWakeup` chain that can silently stop re-firing, per this item's original finding; a
`Monitor` loop with a hard cap that isn't guaranteed to re-arm promptly, per this occurrence) rather than
on an independent, unconditional timer. Strengthens the case for this item's Fix plan direction (a renewal
mechanism that does not ride on a capped/chained tool's own re-arming discipline) — but note the concrete
fix needs to additionally cover the Monitor-cap re-arm gap, not just fold renewal into the Monitor loop as
originally scoped, since the Monitor loop itself is what left the gap here.
