---
id: LESSON-0717
type: gotcha
domain: agent-orchestration
tags: [orchestrate, capacity-allocator, model-tier, task-typing]
context: invoking the orchestrate skill's capacity allocator for a task and choosing how to label/type that task so it maps to the right model tier
trigger: use this when dispatching a trivial-complexity research/lookup task through the orchestrate skill's capacity allocator and it keeps returning an expensive model/effort tier
source: "funko-tracker session, 2026-11-22 (agent-inferred): catalog research typed as 'design' returned opus/high from the orchestrate skill's capacity allocator; retyping the SAME task as 'implement' (with complexity: trivial) returned sonnet/medium, matching the ingest skill's own model rule for that kind of work. Note: `orchestrate` is a personal skill at `~/.claude/skills/orchestrate` (outside `plugin/`) that carries its own independent copy of the DR-162 tiering algorithm by design (DR-162 note); this is not a panda-corp plugin/build-engine defect, so it is captured here rather than filed as a factory/backlog item."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-162, LESSON-0504]
---

**Situation:** a catalog-research task dispatched via the orchestrate skill, labeled "design," was routed
to opus/high by its capacity allocator — a far more expensive tier than the task's actual complexity
warranted.

**Lesson:** the orchestrate skill's capacity allocator (a standalone, independent copy of the DR-162
tiering algorithm, per its own design) keys its tier recommendation off the task-type label the caller
supplies, not off an assessment of the task's real content — "design" is treated as inherently JUDGE-tier
regardless of what the specific task actually needs, so a trivial research/lookup task mislabeled "design"
is routed far more expensively than a correctly-labeled "implement" task of the same real complexity.

**Apply next time:** when dispatching through orchestrate's capacity allocator, pick the task-type label by
what the task actually computationally resembles (a trivial lookup/research task → "implement" with an
explicit `complexity: trivial`, not "design"), not by the closest-sounding English word for what the task
is "about" — a mismatched label can cost an unnecessary tier jump for no quality benefit.
