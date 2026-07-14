---
id: LESSON-0148
type: pattern
domain: agent-orchestration
tags: [synthesis, aggregation, fabrication, fail-loud, reviewer]
context: a step that merges/ranks/condenses several upstream findings into one output (reviewer finding-merge, recommend, review-launch roll-up)
trigger: use this when designing or reviewing a synthesis/aggregation agent step that combines multiple upstream findings, sources or reviews into one output
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry); ringer templates synthesis clause 'no new evidence'"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0027]
---

**Situation:** a synthesis/aggregation step (a reviewer merging several findings, `/pandacorp:recommend`
ranking ideas, `review-launch` rolling up metrics from several sources) sits between upstream evidence
and a final judgment. Left unconstrained, an LLM performing synthesis tends to smooth over gaps by
inventing a plausible-sounding fact, URL or number that was never in any input — because a coherent
narrative is easier to produce than an honest "the inputs don't establish this."

**Lesson:** a synthesis step's contract must explicitly FORBID introducing evidence absent from its
inputs — it may only rank, condense, or resolve conflicts among what upstream already proved; it must
never add a new URL, a new fact, or a new number that isn't traceable to an input it was given. This is
the write-side complement to DR-078's fail-loud readers (which forbid silently fabricating a value when a
read fails) — same discipline, applied to a step that COMBINES rather than reads.

**Apply next time:** when writing or reviewing a synthesis/aggregation prompt or agent, add an explicit
"no new evidence" clause and verify it with a test: feed inputs with a known gap and assert the output
either omits the claim or flags it as unestablished, never fills it in.
