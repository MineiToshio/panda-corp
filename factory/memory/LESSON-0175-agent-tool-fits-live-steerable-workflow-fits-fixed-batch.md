---
id: LESSON-0175
type: pattern
domain: agent-orchestration
tags: [agent-tool, dynamic-workflow, orchestration-design, steerability]
context: choosing the orchestration substrate (Agent tool background subagents vs a compiled Dynamic Workflow) for a new multi-agent flow
trigger: use this when designing or choosing between the Agent tool and a Dynamic Workflow for a new multi-agent orchestration flow, especially one where the owner may inject or redirect a task mid-run
source: "panda-corp factory/memory/_inbox.md 2026-07-18 (designing the personal /orchestrate skill, agent-inferred)"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0176, LESSON-0177, LESSON-0186]
---

**Situation:** designing an orchestrator flow that needed to accept a NEW task the owner injects mid-run,
or a correction to a task already in flight — a shape neither the Agent tool nor a Dynamic Workflow was
obviously "the" right substrate for without reasoning about it explicitly.

**Lesson:** the two native primitives fit opposite shapes. The **Agent tool** (background subagents +
a conversational main loop) fits **LIVE-STEERABLE** orchestration: subagents run in the background while
the main loop stays conversational, a new task is just another spawn, and a single in-flight subagent can
be redirected via `SendMessage` (context intact) or killed by its own task-id. A **Dynamic Workflow** is
a compiled FIXED plan: `TaskStop` kills the WHOLE run, and no `agent()` call can be added to a live run —
it is good only for deterministic, unattended batch sweeps at scale (the shape the factory's own
`/pandacorp:implement` build engine already uses), not for a flow the owner steers interactively.

**Apply next time:** when designing a new orchestration flow, ask "will the owner interject or redirect
mid-run?" — if yes, use the Agent tool with a conversational main loop; if the flow is a deterministic,
unattended, resumable batch, a Dynamic Workflow is correct and the Agent tool would just add fragile ad
hoc coordination on top. This is the concrete "steerable vs fixed-plan" litmus test behind the factory's
existing workflows-vs-agent-teams doctrine (`docs/vision/00-vision-and-flow.md`).
