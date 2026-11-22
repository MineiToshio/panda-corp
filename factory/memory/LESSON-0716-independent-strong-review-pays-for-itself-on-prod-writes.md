---
id: LESSON-0716
type: pattern
domain: code-review
tags: [independent-review, model-tier, production-safety]
context: deciding whether to spend on an independent, stronger-model review pass for a code path whose job is writing to production, after its own implementation's tests already pass green
trigger: use this when choosing a reviewer tier for a change whose job is writing to production and its own tests are already green
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-21 (agent-inferred): an independent review with a strong model (Astra high) over a production-write code path found 9 real blockers after the first implementation's own tests were already green."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-162, LESSON-0504, LESSON-0505, LESSON-0067]
---

**Situation:** a first implementation of a code path that writes to production had its own tests passing
green. An independent review pass using a stronger model tier (Astra high) was run anyway and found 9 real
blockers the green tests had not caught.

**Lesson:** "its own tests are green" is evidence the implementer's OWN model satisfied the cases it
thought to write, not that the change is safe to write to production — a stronger, independent reviewer
finds a materially different set of defects because it isn't anchored to the implementer's own blind spots
(the same "errors of a single model cluster together" principle behind constitution rule 3's mandatory
independent reviewer, now with a concrete count: 9 real blockers on one pass).

**Apply next time:** for any change whose job is to WRITE to production (not just read/compute), budget for
and run the independent review at the strongest reviewer tier the task's risk floor calls for (DR-162's
critical-risk floor), even when the implementation's own tests are already green — do not treat green
self-tests as a reason to skip or downgrade that pass.
