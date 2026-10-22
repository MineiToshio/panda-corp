---
id: "LESSON-0006"
type: "library-verdict"
domain: "markdown"
tags:
  - "markdown"
  - "library-verdict"
context: "The markdown front-matter parser caches failed parses"
trigger: "use this when parsing the same front matter twice in one process"
source: "pandasaga, personal-page-v2 lessons.md"
provenance: "agent-inferred"
created: "2026-08-16"
status: "active"
promotion: "none"
confidence: "high"
times_applied: 3
applied_in:
  - "pandasaga"
  - "personal-page-v2"
links: []
---

**Situation:** the problem showed up during a build of pandasaga and cost a repair cycle.

**Lesson:** The markdown front-matter parser caches failed parses.

**Apply next time:** Parsing the same front matter twice in one process: apply the lesson before writing the first test.
