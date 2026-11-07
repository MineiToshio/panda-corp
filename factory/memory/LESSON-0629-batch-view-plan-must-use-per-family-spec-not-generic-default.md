---
id: LESSON-0629
type: anti-pattern
domain: batch-processing
tags: [planning, taxonomy, catalog, per-family-spec, batch-jobs]
context: generating a per-item view/shot plan for a photo-sourcing or render batch, across items that
  belong to several distinct product families with different physical shapes
trigger: use this when a step generates a per-item photo/view-target plan across multiple product
  families — before running the batch, check that every family's target came from that family's own
  spec, not a generic fallback
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05 (agent-inferred, Naruto batch): the
  photo-plan step gave Vinyl SODA items (a can-shaped product) the same generic single-view target used
  for Bitty Pop (a different shape), leaving 4 SODA items with no planned view of their own can"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0622]
---

**Situation:** a batch step planned which photo view(s) each item needed before sourcing/generating
them. It assigned a generic "one view is enough" target — correct for one product family (Bitty Pop) —
to items of a DIFFERENT family (Vinyl SODA cans) that actually needed a distinct view (the can itself).
Because the plan silently defaulted rather than erroring, 4 SODA items went through the batch with no
planned view of their own can, and nothing flagged the gap until a later review.

**Lesson:** a plan-generation step that assigns view/shot targets by a generic default (rather than by
each item's own family-specific specification) will silently produce a wrong-but-plausible-looking plan
for any family the default wasn't designed for — the output still "has a target," so nothing about the
plan itself looks incomplete, and the gap only surfaces once someone notices missing output downstream.

**Apply next time:** when planning per-item targets (views, shots, fields) across multiple product
families/categories, look up each family's target from an explicit per-family specification (a lookup
table or spec sheet keyed by family), never from a single generic default applied to everything. Before
running the batch, explicitly check that every family present has its own spec row — treat a family with
no matching spec as a stop-and-ask condition, not a silent fallback to whatever default is handy.
