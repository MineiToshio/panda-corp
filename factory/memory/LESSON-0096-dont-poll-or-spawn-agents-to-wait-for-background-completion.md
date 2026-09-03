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
promotion: proposed   # 2026-07-16 (librarian review) — target factory/standards/agent-portability.md (or a new agent-orchestration convention alongside CONV-11/12): codify "a background Agent-tool dispatch already delivers a completion notification — never schedule a ScheduleWakeup or spawn a bridge/placeholder agent just to wait for it" as a standing rule, plus the scoping fact that ScheduleWakeup itself only reliably re-fires under `/loop` dynamic-mode pacing (the `<<autonomous-loop-dynamic>>` sentinel). Corroborated across 2 distinct projects (mission-control original 2026-07-06, panda-corp corroboration 2026-07-16, a genuine misuse caught and cancelled before it fired).
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
to investigate or continue the same work. `ScheduleWakeup` itself is scoped to `/loop` dynamic-mode
pacing (it needs the `<<autonomous-loop-dynamic>>` sentinel or a `/loop` prompt to re-fire correctly) —
outside a `/loop` run, don't reach for it as a generic "wait for my subagents" mechanism at all; the
harness already resumes the session automatically when a dispatched Agent-tool call completes.

**Promotion held 2026-09-03 — `blocked-by: BL-0099`.** This lesson stays `promotion: proposed`. Proposal 33
R-71 found that it **contradicts the factory's own largest skill**: the lesson calls `ScheduleWakeup` outside
`/loop` "a misuse", while `plugin/skills/implement/SKILL.md:70,77` MANDATES a dedicated ~2-minute
`ScheduleWakeup` outside `/loop` as the build supervisor's lease-renewal timer, and the platform docs do not
forbid that use. The lesson is `agent-inferred` at `confidence: medium`; promoting it as written would codify
a rule the build engine violates by design. **BL-0099** resolves the contradiction on one supervised build
(does the ~2-min heartbeat re-fire outside `/loop` for a full run with no duplicate spawns?). Promote only
after that verdict — and then only the half the verdict supports (the "don't spawn a bridge agent / don't
poll for a background completion notification" rule is unaffected by the contradiction; the "`ScheduleWakeup`
is `/loop`-only" scoping claim is the disputed half).
