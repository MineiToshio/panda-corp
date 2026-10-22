---
id: "LESSON-0008"
type: "gotcha"
domain: "dates"
tags:
  - "dates"
  - "gotcha"
context: "Never compare ISO timestamps as strings"
trigger: "use this when finding the most recent of several timestamps"
source: "mission-control, funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-10-22"
status: "active"
promotion: "proposed"
confidence: "high"
times_applied: 2
applied_in:
  - "mission-control"
  - "funko-tracker"
links: []
---

**Situation:** the problem showed up during a build of mission-control and cost a repair cycle.

**Lesson:** Never compare ISO timestamps as strings.

**Apply next time:** Finding the most recent of several timestamps: apply the lesson before writing the first test.
