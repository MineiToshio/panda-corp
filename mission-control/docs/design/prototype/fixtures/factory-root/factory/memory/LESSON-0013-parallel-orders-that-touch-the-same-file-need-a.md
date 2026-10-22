---
id: "LESSON-0013"
type: "gotcha"
domain: "build-engine"
tags:
  - "build-engine"
  - "gotcha"
context: "Parallel orders that touch the same file need a declared order"
trigger: "use this when two work orders edit one component"
source: "funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-07-10"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of funko-tracker and cost a repair cycle.

**Lesson:** Parallel orders that touch the same file need a declared order.

**Apply next time:** Two work orders edit one component: apply the lesson before writing the first test.
