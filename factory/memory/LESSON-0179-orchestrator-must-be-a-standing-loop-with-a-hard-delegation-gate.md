---
id: LESSON-0179
type: pattern
domain: agent-orchestration
tags: [orchestrator-design, standing-loop, delegation-gate, model-tier-budget]
context: designing an orchestrator skill/agent whose job is to delegate work to subagents rather than do the work itself
trigger: use this when designing or reviewing an orchestrator skill/agent (including the factory's own build-engine framing) that delegates work to subagents
source: "owner-stated correction, 2026-07-18 (panda-corp factory/memory/_inbox.md) — real failure on the personal /orchestrate skill run against 'Fable 5, Panda Collector' ('Fable cinco orchestrate setup'): it delegated the first batch fine, but its own final step ('tu revisas y entregas') licensed the orchestrating brain to take over and do ALL remaining stages itself, burning the expensive-tier budget fast"
provenance: owner-stated
created: 2026-07-21
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a real run of the personal `/orchestrate` skill delegated its first batch of work
correctly, but its own final instruction ("you review and deliver") gave the orchestrating brain implicit
license to keep going and perform every remaining stage itself instead of delegating — burning the
priciest model tier's budget on work that should have been a cheap subagent's job.

**Lesson:** an orchestrator must be written as a STANDING, STICKY LOOP with a hard per-action
"orchestrate vs work" gate, never as a one-shot fan-out procedure. Three requirements observed to
actually prevent the drift: (1) the mode must PERSIST for the whole conversation, including future
messages, until the owner explicitly exits it; (2) every action must be gated by an explicit question —
"is this orchestrating or working? if working, STOP and delegate"; (3) the loop must be EXPLICIT
(subagents return -> decide the next batch -> spawn again, never continue the work inline). The
expensive brain must stay minimal precisely because it may be the priciest model available — a single
unguarded "you finish it" instruction is enough to erase the whole point of delegating.

**Apply next time:** when designing or reviewing any orchestrator skill/agent (including the factory's
own `/pandacorp:implement` build-engine framing), verify the three requirements above are explicit in
its instructions, and specifically red-team any step that reads like "you review/finish/deliver" for
whether it silently licenses the brain to take over remaining work instead of delegating it.
