---
id: "LESSON-0022"
type: "anti-pattern"
domain: "factory-engineering"
tags:
  - "factory-engineering"
  - "anti-pattern"
context: "Fixing another session's red files masks real failures"
trigger: "use this when the gate is red in files you did not touch"
source: "pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-08-10"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of pandasaga and cost a repair cycle.

**Lesson:** Fixing another session's red files masks real failures.

**Apply next time:** The gate is red in files you did not touch: apply the lesson before writing the first test.
