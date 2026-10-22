---
id: "LESSON-0011"
type: "gotcha"
domain: "playwright"
tags:
  - "playwright"
  - "gotcha"
context: "Hard waits hide hydration races"
trigger: "use this when an e2e test waits a fixed time"
source: "personal-page-v2, mission-control lessons.md"
provenance: "agent-inferred"
created: "2026-09-04"
status: "active"
promotion: "none"
confidence: "high"
times_applied: 2
applied_in:
  - "personal-page-v2"
  - "mission-control"
links: []
---

**Situation:** the problem showed up during a build of personal-page-v2 and cost a repair cycle.

**Lesson:** Hard waits hide hydration races.

**Apply next time:** An e2e test waits a fixed time: apply the lesson before writing the first test.
