---
id: LESSON-0176
type: gotcha
domain: agent-orchestration
tags: [agent-tool, dynamic-workflow, model-tiering, effort, token-budget]
context: budgeting token/cost across a fan-out of subagents dispatched via the Agent tool vs a Workflow's agent() call
trigger: use this when planning a token/cost budget for a fan-out of subagents and choosing which native primitive to dispatch them with
source: "panda-corp factory/memory/_inbox.md 2026-07-18 (designing the personal /orchestrate skill, agent-inferred)"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0175, LESSON-0159, LESSON-0177]
---

**Situation:** budgeting a fan-out of subagents that could be dispatched either via the Agent tool
(chosen for live-steerability, LESSON-0175) or via a Dynamic Workflow's `agent()` call.

**Lesson:** the Agent tool fixes `model` per subagent natively but has **no `effort` parameter** —
effort can only be induced indirectly via prompt instruction. Only Workflow's `agent()` call takes BOTH
`model` and `effort` as first-class parameters. `model` is the DOMINANT lever on cost (roughly ~10x
between a cheap and an expensive tier), `effort` a secondary one — so choosing the Agent tool for its
steerability and losing native effort control is a cheap trade, not a real budget risk.

**Apply next time:** when token-budgeting a fan-out of subagents, tier primarily by `model` (per
DR-111/CONV-12); treat `effort` as a secondary, prompt-induced lever, and don't let the Agent tool's
missing native effort parameter block a choice that's otherwise right for the flow's steerability needs.
