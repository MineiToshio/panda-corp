---
id: "LESSON-0014"
type: "problem-solution"
domain: "worker"
tags:
  - "worker"
  - "problem-solution"
context: "Idle workers should sleep and wake on a queue signal"
trigger: "use this when a background worker costs money while idle"
source: "pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-08-13"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of pandasaga and cost a repair cycle.

**Lesson:** Idle workers should sleep and wake on a queue signal.

**Apply next time:** A background worker costs money while idle: apply the lesson before writing the first test.
