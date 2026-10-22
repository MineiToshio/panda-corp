---
id: "LESSON-0021"
type: "gotcha"
domain: "testing"
tags:
  - "testing"
  - "gotcha"
context: "Snapshot baselines drift when fonts load late"
trigger: "use this when visual tests flake on text width"
source: "funko-tracker lessons.md"
provenance: "agent-inferred"
created: "2026-07-07"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of funko-tracker and cost a repair cycle.

**Lesson:** Snapshot baselines drift when fonts load late.

**Apply next time:** Visual tests flake on text width: apply the lesson before writing the first test.
