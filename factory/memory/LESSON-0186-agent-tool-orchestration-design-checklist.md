---
id: LESSON-0186
type: pattern
domain: agent-orchestration
tags: [agent-tool, dynamic-workflow, orchestration-design, synthesis, checklist]
context: designing a new multi-agent orchestration flow (a personal skill, an internal engine) and deciding whether/how to use the Agent tool's background subagents
trigger: use this when designing a new orchestration flow around the Agent tool — before it ships, walk the substrate choice, the cost budget, and the failure-recovery path each explicitly
source: "synthesis over 3 evidence-anchored candidates, panda-corp, 2026-07-18 (designing the personal /orchestrate skill; already cross-linked in each lesson's own `links:`): LESSON-0175 (the Agent tool fits live-steerable orchestration, a Dynamic Workflow fits a fixed deterministic batch — picking wrong adds fragile ad hoc coordination), LESSON-0176 (the Agent tool has no native `effort` parameter, only `model` — a cheap trade against steerability, not a real budget risk, since `model` is the dominant cost lever), LESSON-0177 (a background subagent killed mid-response by a transient provider error is resumable via `SendMessage` to the same agent-id, not lost — try that once before respawning from scratch) — librarian reflection pass, 2026-08-03"
provenance: agent-inferred
created: 2026-08-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0175, LESSON-0176, LESSON-0177]
---

**Situation:** designing a new orchestration flow (the personal `/orchestrate` skill) that fans out
subagents via the Agent tool surfaced three independent, non-overlapping design questions in the same
session: which native primitive to build on (LESSON-0175), how to budget cost given the primitive's
parameter surface (LESSON-0176), and how to recover when a background subagent is interrupted mid-run by
a transient provider error (LESSON-0177). Each was solved separately, but together they form the actual
checklist any Agent-tool-based orchestration design needs to walk once, deliberately, rather than
discover by trial.

**Lesson:** the Agent tool and a Dynamic Workflow are not interchangeable — the Agent tool fits
LIVE-STEERABLE flows (the owner can inject or redirect a task mid-run, a subagent is individually
addressable and resumable) while a Workflow fits a FIXED, deterministic, unattended batch. Having chosen
the Agent tool for steerability, its one real capability gap is the lack of a native `effort` parameter
(only `model` is first-class) — this is a cheap trade, not a budget risk, since `model` is already the
dominant cost lever (DR-111/CONV-12) and `effort` only a secondary, prompt-induced one. And once running,
a background subagent interrupted by a transient provider error is not lost work — `SendMessage` to the
same agent-id resumes it with context intact, which is both cheaper and more reliable than a fresh
respawn.

**Apply next time:** when designing a new orchestration flow around the Agent tool, walk this checklist
before shipping: (1) does the owner need to interject/redirect mid-run — if yes, Agent tool; if it's a
fixed, unattended, resumable batch, a Dynamic Workflow is the better fit (LESSON-0175); (2) budget cost by
`model` tier per subagent, not by chasing an `effort` parameter the Agent tool doesn't expose
(LESSON-0176); (3) build the interruption-recovery path to try `SendMessage` to the same agent-id ONCE
before falling back to a fresh spawn, so a transient provider error doesn't silently double the run's
cost (LESSON-0177).
