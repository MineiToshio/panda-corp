---
id: "LESSON-0005"
type: "problem-solution"
domain: "nextjs"
tags:
  - "nextjs"
  - "problem-solution"
context: "Forms posted before hydration leak their fields into the URL"
trigger: "use this when adding a client-handled form"
source: "funko-tracker, pandasaga lessons.md"
provenance: "agent-inferred"
created: "2026-07-13"
status: "active"
promotion: "proposed"
confidence: "high"
times_applied: 2
applied_in:
  - "funko-tracker"
  - "pandasaga"
links: []
---

**Situation:** the problem showed up during a build of funko-tracker and cost a repair cycle.

**Lesson:** Forms posted before hydration leak their fields into the URL.

**Apply next time:** Adding a client-handled form: apply the lesson before writing the first test.
