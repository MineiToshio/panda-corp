---
id: LESSON-0390
type: pattern
domain: process
tags: [pareto, design-freeze, audit-loop, time-boxing]
context: deciding whether to run another audit/review pass after an independent audit has already judged the hand-off sufficient
trigger: use this when an independent audit has already said a hand-off (a design freeze, a review gate) is sufficient, and there is an instinct to run another pass chasing smaller remaining nits
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated); design freeze completed in ~1 day. Corroborated on a SECOND, distinct project (panda-corp itself, factory/memory/_inbox.md 2026-11-22, owner-stated): open-ended adversarial review rounds on complex bash concurrency code DIVERGED rather than merely slowed — the defect count went 15->8 across successive rounds, but each fix added new surface, so the process was not cleanly converging toward zero even while nominally making progress."
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: high
times_applied: 2
applied_in: [funko-tracker, panda-corp]
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

**Second corroboration (2026-11-22, panda-corp, owner-stated) — sharper than "diminishing returns":** an
open-ended adversarial review loop over complex bash concurrency code did not just slow down with
shrinking payoff — it genuinely DIVERGED. The defect count fell across rounds (15 → 8), but each round's
*fix* introduced new surface/risk of its own, so repeated review was not monotonically converging the
code toward correctness even as the raw count improved. This strengthens the underlying rule: an
open-ended review loop on genuinely complex/concurrent code is not merely low-ROI past some point — it can
actively make total risk worse round over round. Cap the rounds in advance (one independent pass, fix,
ship; defer remainder) rather than continuing "until it looks clean," especially on concurrency-shaped
code where a fix is itself a new place to introduce a bug.
