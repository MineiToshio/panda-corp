---
id: "LESSON-0030"
type: "gotcha"
domain: "build-engine"
tags:
  - "build-engine"
  - "gotcha"
context: "A blocked order must leave the wave, not retry forever"
trigger: "use this when an order is blocked on the owner"
source: "pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-08-07"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of pandasaga and cost a repair cycle.

**Lesson:** A blocked order must leave the wave, not retry forever.

**Apply next time:** An order is blocked on the owner: apply the lesson before writing the first test.
