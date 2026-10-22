---
id: "LESSON-0004"
type: "gotcha"
domain: "git"
tags:
  - "git"
  - "gotcha"
context: "A rebase orphans the recorded green commit"
trigger: "use this when recording the last green commit after a merge"
source: "mission-control, funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-10-10"
status: "active"
promotion: "none"
confidence: "high"
times_applied: 1
applied_in:
  - "mission-control"
  - "funko-tracker"
links: []
---

**Situation:** the problem showed up during a build of mission-control and cost a repair cycle.

**Lesson:** A rebase orphans the recorded green commit.

**Apply next time:** Recording the last green commit after a merge: apply the lesson before writing the first test.
