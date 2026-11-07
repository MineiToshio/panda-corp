---
id: LESSON-0633
type: pattern
domain: multi-agent-orchestration
tags: [batch-jobs, run-state, checklist, decision-propagation, counters, per-family-spec, reflection]
context: synthesis of 3 funko-tracker lessons (same Naruto batch review, 2026-11-05) about a multi-batch
  pipeline where later batches, subagents or resumed sessions only read the run's own frozen plan/state
  artifact — never the full context an earlier step or conversation had
trigger: use this when designing or auditing a multi-batch/multi-round pipeline that dispatches separate
  workers (batches, subagents, resumed sessions) to execute parts of a run — before trusting that a
  lookup, a counter, or a decision will reach those workers
source: "reflection pass, panda-corp memory review 2026-11-07 — synthesizes LESSON-0629, LESSON-0630,
  LESSON-0631 (all funko-tracker, Naruto batch 2026-11-05); all single-project (funko-tracker), pending
  corroboration from a second project before this synthesis itself can activate"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0629, LESSON-0630, LESSON-0631, LESSON-0622]
---

**Situation:** three distinct defects surfaced in the same batch-review incident, each with a different
surface mechanism but the same underlying shape: a photo-plan step silently used a generic view-target
instead of looking up each product family's own spec, leaving 4 items with no planned view of their own
shape (LESSON-0629); a "stop after 2 rejections, escalate to the owner" rule never fired because its
counter was scoped to the current round/batch and reset every time a new round started, letting items
accumulate unlimited total rejections (LESSON-0630); and a method decision agreed in conversation ("AI
generation is only for box renders, never loose figures") never reached 4 later batches in the same run,
because those batches dispatched workers that read the run's own plan/checklist artifact, not the chat
history that produced the decision (LESSON-0631).

**Lesson:** these are not three unrelated bugs — they are one root cause: in a multi-batch/multi-round
pipeline, a later batch, subagent, or resumed session consults ONLY the run's own frozen plan/state
artifact, never the richer context (a spec table, a prior round's tally, a chat decision) that produced
or should have constrained it. Any information that isn't correctly WRITTEN INTO that artifact — a
per-family lookup resolved and recorded rather than defaulted, a counter persisted per item/view rather
than reset per round, a mid-run decision committed to the checklist rather than left in conversation — is
invisible to those workers. None of these failures error: the plan still "has a target," the rule still
"checks the counter," the batch still "runs" — each one looks like a normal, successful step from the
worker's own point of view, and the gap only surfaces on a later, separate review.

**Apply next time:** when designing or auditing any multi-batch/multi-round pipeline that will dispatch
separate workers to execute parts of a run, treat the run's own plan/state/checklist artifact as the
SOLE interface those workers will ever see, and audit three things against it explicitly: (1) does every
category/family present have its own looked-up spec row, with "no matching spec" treated as stop-and-ask
rather than a silent generic default (LESSON-0629)? (2) does every "stop after N" counter persist as a
property of the item/view being retried — surviving a new round starting — rather than living as a
per-round/per-batch-local variable (LESSON-0630)? (3) has every method/scope decision agreed mid-run been
written into that same artifact immediately, rather than left only in the conversation that produced it
(LESSON-0631)? Treat "I told the owner/the chat" or "the default handled it" as insufficient propagation
for anything a downstream worker needs to obey — if it isn't in the artifact, it didn't happen from that
worker's point of view.
