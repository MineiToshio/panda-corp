---
id: "LESSON-0001"
type: "gotcha"
domain: "javascript"
tags:
  - "javascript"
  - "gotcha"
context: "Shallow copies of constant catalogs leak mutations to every caller"
trigger: "use this when returning a constant array of objects from a module"
source: "funko-tracker, pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-07-01"
status: "active"
promotion: "proposed"
confidence: "high"
times_applied: 1
applied_in:
  - "funko-tracker"
  - "pandasaga"
links: []
---

**Situation:** the problem showed up during a build of funko-tracker and cost a repair cycle.

**Lesson:** Shallow copies of constant catalogs leak mutations to every caller.

**Apply next time:** Returning a constant array of objects from a module: apply the lesson before writing the first test.
