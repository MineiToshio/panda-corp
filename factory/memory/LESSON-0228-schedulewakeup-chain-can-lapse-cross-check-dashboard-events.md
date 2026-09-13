---
id: LESSON-0228
type: gotcha
domain: build-orchestration
tags: [scheduleWakeup, monitor, supervisor, heartbeat, dashboard-events, diagnosis]
context: supervising a long-running build (or any Agent-tool orchestration) that relies on a chained ScheduleWakeup for a periodic mechanical action (e.g. lease renewal)
trigger: use this when a periodic ScheduleWakeup-chained action appears to have stopped firing, before concluding the underlying build/process is dead
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred) — the /pandacorp:implement supervisor's ~2min ScheduleWakeup lease-renewal heartbeat silently stopped chaining for ~25min mid-build (no error, no visible turn) while the actual build kept working fine, proven via ~/.claude/dashboard-events.ndjson SubagentStop/AgentWorking activity continuing normally. Discovered only because a routine Monitor HEALTH_TICK showed last_event_at frozen for 25min, prompting a manual check."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0096, BL-0131]
---

**Situation:** a build's `ScheduleWakeup`-chained ~2-minute lease-renewal heartbeat silently stopped
re-firing for ~25 minutes with no error, while the underlying build agents kept working correctly the
whole time — discovered by chance via a Monitor health check noticing `last_event_at` frozen.

**Lesson:** `ScheduleWakeup` is a fire-and-forget mechanism — each successive turn must correctly re-issue
the next wakeup call, and nothing surfaces an error if one hop is silently missed or dropped. A single
missed renewal firing is therefore **not, by itself, evidence that the underlying build is dead** — the
two are decoupled. Before assuming a frozen heartbeat means a dead build, cross-check
`~/.claude/dashboard-events.ndjson` for recent `SubagentStop`/`AgentWorking` activity (or equivalent live
signals); the build may be working fine even while its own liveness-reporting chain has quietly stopped.

**Apply next time:** when supervising a build via a chained `ScheduleWakeup` for a periodic mechanical
action, periodically sanity-check that the chain is actually still firing (not just assume a fire-and-forget
reschedule loop is reliable across many hops) — and when it does appear frozen, verify against
`dashboard-events.ndjson`'s real agent-activity events before declaring the build stuck. Prefer folding a
tight fixed-interval mechanical action into a persistent `Monitor` bash loop instead of a `ScheduleWakeup`
chain (see BL-0131 for the concrete engine-side fix); this lesson does not touch `LESSON-0096`'s own scope
(spawning an agent to wait for a background completion), a distinct failure shape.
