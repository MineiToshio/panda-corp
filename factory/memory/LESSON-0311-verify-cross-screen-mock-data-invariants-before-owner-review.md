---
id: LESSON-0311
type: gotcha
domain: design-process
tags: [mockup-data, consistency, qa, sample-data]
context: authoring sample/mock data shown across multiple linked mockup screens (e.g. an "owned" list and a "missing" list derived from the same underlying collection) before presenting them to the owner for review
trigger: use this when mockup screens share derived sample data across screens (totals, set membership, goal counts) and you are about to hand them to the owner for feedback
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred): mockup sample data showed the same specific items as BOTH owned (in one screen) and missing (in another), and a goal-owned count exceeded the total-owned count — contradictions an owner notices immediately and that undermine trust in the whole mockup"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** sample/mock data populated across multiple linked mockup screens (an "owned" list, a
"missing" list, a goal/progress summary — all meant to derive from one underlying data set) contained
direct contradictions: the same specific items appeared as owned on one screen and missing on another,
and a goal's "owned" count exceeded the actual total-owned count shown elsewhere.

**Lesson:** when mock data for a multi-screen prototype is authored screen-by-screen (rather than
generated once from one consistent source), it is easy to introduce cross-screen contradictions that a
casual look at any single screen won't catch — but that the owner notices immediately on review, and that
undermine confidence in the whole prototype regardless of how good the visual design is.

**Apply next time:** before handing a multi-screen mockup to the owner, explicitly check the cross-screen
data invariants implied by the product's own logic (e.g. owned-set ∩ missing-set = empty, a subset's
count ≤ its superset's count, group counts sum to the stated total) — treat this as a required
pre-review check, not something to notice only if the owner happens to spot it.
