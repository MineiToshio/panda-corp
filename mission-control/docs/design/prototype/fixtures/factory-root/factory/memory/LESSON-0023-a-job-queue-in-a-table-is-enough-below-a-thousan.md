---
id: "LESSON-0023"
type: "problem-solution"
domain: "postgres"
tags:
  - "postgres"
  - "problem-solution"
context: "A job queue in a table is enough below a thousand jobs a day"
trigger: "use this when choosing a queue for a small app"
source: "personal-page-v2 lessons.md"
provenance: "agent-inferred"
created: "2026-09-13"
status: "candidate"
promotion: "none"
confidence: "medium"
times_applied: 0
applied_in: []
links: []
---

**Situation:** the problem showed up during a build of personal-page-v2 and cost a repair cycle.

**Lesson:** A job queue in a table is enough below a thousand jobs a day.

**Apply next time:** Choosing a queue for a small app: apply the lesson before writing the first test.
