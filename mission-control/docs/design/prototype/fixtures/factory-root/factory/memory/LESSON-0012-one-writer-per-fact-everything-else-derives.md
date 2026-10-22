---
id: "LESSON-0012"
type: "pattern"
domain: "data"
tags:
  - "data"
  - "pattern"
context: "One writer per fact; everything else derives"
trigger: "use this when two screens show the same count"
source: "mission-control, funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-10-07"
status: "active"
promotion: "none"
confidence: "high"
times_applied: 3
applied_in:
  - "mission-control"
  - "funko-tracker"
links: []
---

**Situation:** the problem showed up during a build of mission-control and cost a repair cycle.

**Lesson:** One writer per fact; everything else derives.

**Apply next time:** Two screens show the same count: apply the lesson before writing the first test.
