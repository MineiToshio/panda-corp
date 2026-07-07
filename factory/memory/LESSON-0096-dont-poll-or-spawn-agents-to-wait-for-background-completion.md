---
id: LESSON-0096
type: anti-pattern
domain: factory-engineering
tags: [agents, delegation, background-task, ScheduleWakeup, polling, resume]
context: orchestrating or waiting on a long-running background research/investigation agent
trigger: use this when tempted to schedule a polling wakeup or spawn a placeholder/bridge agent just to wait for a background agent's completion
source: "mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — a ScheduleWakeup + fresh Agent used to wait for a background research agent got confused on resume, recursively spawned duplicate investigation agents plus several sleep-N background tasks, leaving ~8 stray running tasks and a stray CronCreate wakeup"
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0094]
---

**Situation:** to "wait" for a background research agent to finish, an agent scheduled a `ScheduleWakeup`
and spawned a fresh placeholder `Agent` to bridge the gap. On resume, that bridging agent got confused
about its own wait state and recursively spawned duplicate investigation agents plus several `sleep N`
background shell tasks, leaving roughly 8 stray running tasks and a stray `CronCreate` wakeup behind it —
none of which contributed useful work, only cleanup burden.

**Lesson:** background agent completion already delivers an automatic task-notification when it finishes
— there is no gap to bridge. Scheduling a polling wakeup, or spawning an extra agent whose only job is to
"wait" for another agent, adds a second delegation layer with its own (fallible) judgment about when/how
to resume, and that layer can misinterpret its own waiting state and cascade into duplicate work. This is
the same failure family as LESSON-0094 (fan-out subagents recursively self-delegating) but triggered by
**waiting for one background task**, not fanning out many — the fix is symmetric: don't insert an agent
where a plain mechanism (the automatic notification) already suffices.

**Apply next time:** when a background agent is running, just let its completion notification arrive —
do not schedule a polling `ScheduleWakeup` or launch a placeholder/bridge agent to wait for it. If the
background agent appears stuck, resume IT directly via `SendMessage`, never spawn a parallel duplicate
to investigate or continue the same work.
