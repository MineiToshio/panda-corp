---
id: LESSON-0096
type: anti-pattern
domain: factory-engineering
tags: [agents, delegation, background-task, ScheduleWakeup, polling, resume]
context: orchestrating or waiting on a long-running background research/investigation agent
trigger: use this when tempted to schedule a polling wakeup or spawn a placeholder/bridge agent just to wait for a background agent's completion
source: "mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — a ScheduleWakeup + fresh Agent used to wait for a background research agent got confused on resume, recursively spawned duplicate investigation agents plus several sleep-N background tasks, leaving ~8 stray running tasks and a stray CronCreate wakeup. Corroborating instance: panda-corp _inbox.md 2026-07-16 (pandacorp-memory-review sweep) — `ScheduleWakeup` is scoped to `/loop` dynamic-mode pacing (it expects the `<<autonomous-loop-dynamic>>` sentinel or a `/loop` prompt to re-fire correctly); reaching for it as a generic 'wait for my background Agent-tool subagents' fallback OUTSIDE `/loop` is a misuse, caught before it fired and cancelled with `stop: true`."
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: proposed   # 2026-09-07 (librarian review) — narrowed + unblocked per BL-0099 verdict (plugin/docs/decision-log.md v9.102.6): target factory/standards/agent-portability.md (or a new agent-orchestration convention alongside CONV-11/12): codify "don't spawn a bridge/placeholder agent, and don't poll, to wait for a background Agent-tool dispatch's completion — the harness's own notification already suffices" as a standing rule, explicitly carving out a no-agent-spawned periodic liveness/lease-renewal tick (e.g. the build supervisor's ~2-min heartbeat) from the anti-pattern. Corroborated across 2 distinct projects (mission-control 2026-07-06, panda-corp 2026-07-16) plus the 2026-09-03 live-build reconciliation (wf_ddcc95c6-1d7).
confidence: medium
times_applied: 1
applied_in: [panda-corp]
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

**Scope carve-out (2026-09-03, BL-0099 verdict — `plugin/docs/decision-log.md` v9.102.6):** this anti-pattern
does NOT cover a periodic **liveness/lease-renewal tick that spawns no agent and does not wait on another
agent's completion** — e.g. the build supervisor's ~2-minute heartbeat (`implement/SKILL.md`), which only
touches a lock file and appends one event. That mechanism is structurally different from this lesson's
incident shape (a `ScheduleWakeup` and/or a placeholder Agent spawned specifically to *wait for one
background task's completion*, which then recursively self-delegated into duplicates). A live supervised
build (`wf_ddcc95c6-1d7`, 2026-09-03) confirmed the ~2-min tick ran cleanly for a full ~66-minute run
carried by a `Monitor` bash-loop, with zero `ScheduleWakeup` firings and no stale-lock false positive —
so the two mechanisms were not even in tension in that run. The earlier blanket claim that `ScheduleWakeup`
outside `/loop` is categorically "a misuse" is retracted; the surviving, corroborated core teaching is:
don't spawn a bridge/placeholder Agent to wait for a background completion, and don't poll for a
notification the harness already delivers automatically.

**Promotion status: unblocked.** BL-0099 (closed 2026-09-03) resolved the contradiction with proposal 33
R-71 (`plugin/skills/implement/SKILL.md`'s mandated liveness tick); this lesson's scope is narrowed above
per that verdict and no longer conflicts with the supervisor contract. `promotion: proposed` stands —
target `factory/standards/agent-portability.md` (or a new agent-orchestration convention alongside
CONV-11/12): codify "don't spawn a bridge/placeholder agent, and don't poll, to wait for a background
Agent-tool dispatch's completion — the harness's own notification already suffices; a no-agent-spawned
periodic liveness/lease tick is not this anti-pattern." Corroborated across 2 distinct projects
(mission-control 2026-07-06, panda-corp 2026-07-16) plus this narrowing pass's live-build reconciliation.
Still `agent-inferred`/`confidence: medium` — promotion decision remains the owner's via `/pandacorp:learn`.
