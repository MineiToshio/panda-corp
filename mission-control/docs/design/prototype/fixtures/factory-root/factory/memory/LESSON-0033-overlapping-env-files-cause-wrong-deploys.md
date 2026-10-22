---
id: "LESSON-0033"
type: "gotcha"
domain: "env"
tags:
  - "env"
  - "gotcha"
context: "Overlapping env files cause wrong deploys"
trigger: "use this when a project has several env files"
source: "funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-07-16"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of funko-tracker and cost a repair cycle.

**Lesson:** Overlapping env files cause wrong deploys.

**Apply next time:** A project has several env files: apply the lesson before writing the first test.
