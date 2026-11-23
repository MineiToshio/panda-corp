---
id: LESSON-0726
type: pattern
domain: build-engine
tags: [capacity, quota, allocator, dr-162, synthesis, scheduler-design, data-modeling]
context: designing or debugging the DR-162 shared-capacity allocator (or any scheduler that reads multi-provider usage/quota data to decide where to route work)
trigger: use this when building or auditing a scheduler/allocator that reads real multi-provider usage/quota data to route work — before trusting a design's complexity, its staleness handling, or its treatment of an absent field
source: "synthesis over 3 evidence-anchored candidates, all mission-control/panda-corp .pandacorp/run/lessons.md 2026-11-13, during the DR-162 shared-capacity-allocator design/build (same day, same project): LESSON-0698 (a simulation comparing a simple threshold rule against a pacing-budget design found both completed the same task set — the complex design's only edge was task-type preference respect, not throughput), LESSON-0699 (an old-but-present usage reading was treated as fully 'unknown' and let a fresher high-usage reading win by default, instead of getting an explicit lower-bound-plus-margin estimate and account-health-first ordering), LESSON-0697 (a provider's absent usage-window type was correctly recognized as a property of that account's PLAN STRUCTURE, not missing/stale data needing a retry). Librarian reflection pass, 2026-11-23 scheduled memory review."
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0697, LESSON-0698, LESSON-0699, LESSON-0153, DR-162]
---

**Situation:** across one allocator's design/build session, three distinct mistakes shared the same root
shape — treating real, structured provider data as if it were simpler or less informative than it
actually is: (1) reaching for a complex pacing/budget-weighted design before checking whether a simple
threshold rule already produces the same outcome; (2) collapsing an old-but-present usage reading into
"unknown" instead of bounding it; (3) treating an absent usage-window field as missing data rather than
a legitimate plan-structure fact (that account's plan simply has no such window).

**Lesson:** a capacity/quota allocator's correctness depends more on how faithfully it MODELS the real
shape of its input data (ages, absent fields, plan variants) than on how sophisticated its routing
formula is. Each of the three facets independently shows the same anti-pattern: defaulting to a cruder
model (fully unknown, missing data, "more complex must be better") instead of modeling what the data
actually represents (a bounded-but-stale estimate, a plan-structure fact, a measured equivalence to a
simpler rule). None of the three is caught by fixing the others — they are orthogonal design-time
questions an allocator author must ask explicitly, not fixes for the same bug.

**Apply next time:** when building or auditing a multi-provider usage/quota allocator: (1) before
committing to a more complex routing design, simulate it against the simplest candidate rule on the same
real/historical data — if they reach the same outcome, the complexity needs an explicit, named
justification (e.g. "it better respects task-type preference," not just "it feels more correct"); (2) never
let an old-but-present reading collapse to "unknown" — give it an explicit lower-bound-plus-margin estimate
and order candidates by account health before any other preference; (3) before treating an absent expected
field as missing/stale data requiring a fallback or retry, check whether its absence is actually normal for
that specific account/plan's structure.

This is a single-session, single-project reflection (all 3 source lessons are the same mission-control/
panda-corp build) and stays a `candidate` until a second, distinct project/build corroborates the pattern
as a whole (DR-047 anti-poisoning) — but each of the 3 underlying facet lessons is independently
evidence-anchored and citable on its own before that happens.
