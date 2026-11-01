---
id: LESSON-0591
type: pattern
domain: quality-and-testing
tags: [reviewer, oracle-sensitivity, mutation-testing, confirmed-cause, dr-016]
context: trusting a high review/verification score (e.g. a reviewer agent scoring a fix 10/10) as proof that a fix actually works, without first confirming the SAME harness produces a deterministic failure on the unfixed baseline
trigger: use this when a fix receives a strong passing score from a reviewer/harness and that score is about to be treated as proof the fix works
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred)"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0185]
---

**Situation:** a fix was verified with a review/scoring harness and received a perfect score. That score
alone was treated as evidence the fix resolved the issue — but the same harness, run against the
UNFIXED baseline, also produced a passing/high score, meaning the harness was never actually sensitive to
the defect in the first place. The "10/10" measured the harness's insensitivity, not the fix's correctness.

**Lesson:** a passing score proves a fix only relative to a harness that is DEMONSTRATED to fail without
the fix — exactly the same logic as the project's own "confirmed cause" debugging rule (a cause is
confirmed only when it predicts the symptom AND the fix removes it) and the same spirit as mutation
testing (a test that can't detect the mutant it's supposed to catch is not testing anything). A review
oracle that always scores well regardless of whether the bug is present is a weak oracle masquerading as
a strong one, and trusting it wastes the one scarce signal — a real verification pass — on a check that
was never discriminating.

**Apply next time:** before trusting a high review/verification score as proof a fix works, run the SAME
harness against the unfixed baseline and confirm it produces a deterministic failure/low score there. If
the baseline also passes, the harness is not sensitive to the defect — fix the oracle (sharpen the
review's rubric, add the missing assertion) before trusting any score it produces, on this fix or any
future one.
