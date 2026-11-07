---
id: LESSON-0630
type: anti-pattern
domain: batch-processing
tags: [escalation, retry-logic, counters, human-gates, ops]
context: implementing a "stop and escalate to a human after N consecutive rejections/failures on the
  same item" rule inside a multi-round correction pipeline
trigger: use this when designing or auditing a "stop after N rejections/failures" rule for an item that
  can be retried across multiple rounds/batches, not just within a single pass
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05 (agent-inferred, Naruto batch): a project's
  own 'after 2 rejections, escalate to the owner' rule already existed but never fired, because its
  rejection counter was reset at the start of every new round/batch instead of persisting per view/item"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0622]
---

**Situation:** a pipeline had an explicit rule to stop retrying an item and escalate to the owner after
2 consecutive reviewer rejections of the same item. The rule never actually fired on items that were, in
practice, rejected far more than twice (one view failed 6 times across rounds, another 5 times) —
because the counter that tracked rejections was scoped to the current round/batch and reset to zero each
time a new round started.

**Lesson:** a "stop after N failures" rule is only as good as what its counter is scoped to. A counter
scoped to the ROUND/BATCH (rather than to the item/view being retried) resets every time a new round
starts, so an item can accumulate an unlimited number of total rejections — 2 per round, forever — while
the rule's own logic reports "never exceeded 2" every single time it checks. The rule existing in the
skill/spec is not the same as the rule being enforceable by the state it actually reads.

**Apply next time:** when implementing any "stop after N attempts/rejections/failures" rule for an item
that can be retried across multiple rounds, batches, or sessions, store the counter as a property of
the ITEM/view in the run's own persistent manifest — never as a per-round or per-batch-local variable —
and increment it across every round that item is retried, never resetting it except on a genuine new
attempt cycle the owner explicitly restarts. Audit any existing "stop after N" rule by asking "does this
counter survive a new round starting?" before trusting it to fire.
