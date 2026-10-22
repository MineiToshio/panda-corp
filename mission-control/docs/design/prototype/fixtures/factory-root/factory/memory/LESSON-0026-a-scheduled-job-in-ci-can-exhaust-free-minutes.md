---
id: "LESSON-0026"
type: "gotcha"
domain: "ci"
tags:
  - "ci"
  - "gotcha"
context: "A scheduled job in CI can exhaust free minutes"
trigger: "use this when running an hourly job in CI"
source: "pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-08-22"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of pandasaga and cost a repair cycle.

**Lesson:** A scheduled job in CI can exhaust free minutes.

**Apply next time:** Running an hourly job in CI: apply the lesson before writing the first test.
