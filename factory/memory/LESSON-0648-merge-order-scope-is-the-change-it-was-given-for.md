---
id: LESSON-0648
type: gotcha
domain: build-orchestration
tags: [merge-queue, merge-order, scope, landing]
context: landing a branch through a merge-queue using a previously-prepared merge order (a precomputed sequence/plan for integrating several branches)
trigger: use this when about to reuse an existing merge order/merge plan to land a production push, before checking whether that order was computed for the SAME change currently being landed
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (agent-inferred): merge-queue (production push) was launched under an earlier, unrelated merge order — a merge order covers only the change it was given for"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0158, LESSON-0548]
---

**Situation:** a production merge-queue landing was launched reusing a merge order that had been computed
earlier for a different, unrelated change.

**Lesson:** a merge order/merge plan is scoped to the specific change it was computed for (the branches,
their dependency ordering, their expected conflicts) — it is not a generic, reusable "how to land things
right now" artifact. Reusing it for a different change silently carries over assumptions (which branches
are included, what order is safe, what's already landed) that may no longer hold, with no structural
signal that the plan is stale for the new context.

**Apply next time:** before launching a merge-queue/landing step with a previously computed merge
order, verify it was computed for the CURRENT change being landed — recompute or re-derive the merge
order per change rather than reusing one from an earlier, different landing, even if the mechanism
(the same script/command) is identical.
