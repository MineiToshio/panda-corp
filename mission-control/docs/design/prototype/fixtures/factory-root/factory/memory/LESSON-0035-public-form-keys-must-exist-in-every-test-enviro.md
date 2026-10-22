---
id: "LESSON-0035"
type: "gotcha"
domain: "forms"
tags:
  - "forms"
  - "gotcha"
context: "Public form keys must exist in every test environment"
trigger: "use this when a hosted form service is used"
source: "personal-page-v2 lessons.md"
provenance: "agent-inferred"
created: "2026-09-22"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of personal-page-v2 and cost a repair cycle.

**Lesson:** Public form keys must exist in every test environment.

**Apply next time:** A hosted form service is used: apply the lesson before writing the first test.
