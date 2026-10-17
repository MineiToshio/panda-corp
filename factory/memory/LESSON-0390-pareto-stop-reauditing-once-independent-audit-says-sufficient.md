---
id: LESSON-0390
type: pattern
domain: process
tags: [pareto, design-freeze, audit-loop, time-boxing]
context: deciding whether to run another audit/review pass after an independent audit has already judged the hand-off sufficient
trigger: use this when an independent audit has already said a hand-off (a design freeze, a review gate) is sufficient, and there is an instinct to run another pass chasing smaller remaining nits
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated); design freeze completed in ~1 day"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113]
---

**Situation:** after an independent audit judged a design freeze hand-off sufficient, there was a
temptation to keep re-auditing for ever-smaller gate/tooling nits rather than shipping. The owner's
instruction was to apply the Pareto principle and move on; the freeze completed in about a day.

**Lesson:** once an INDEPENDENT audit (a different agent/model than the one that did the work)
judges a hand-off sufficient, further re-audits chase diminishing, ever-smaller findings at
increasing time cost — the marginal nit caught rarely justifies another full pass. Looping re-audits
on a hand-off that an independent judge already cleared is a process anti-pattern, not diligence.

**Apply next time:** when an independent audit says a hand-off is sufficient, ship it and defer the
remaining nits to a backlog/punch-list for later — do not launch another re-audit pass looking for
smaller and smaller issues in the same hand-off.
