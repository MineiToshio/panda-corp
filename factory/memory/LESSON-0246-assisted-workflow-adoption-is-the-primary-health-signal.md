---
id: LESSON-0246
type: pattern
domain: process-design
tags: [adoption, workflow-design, escape-hatch, cost, build-engine, owner-feedback]
context: an assisted/automated engineering workflow (a skill, a build engine, a scaffolding step) coexists with a faster/cheaper manual escape hatch the operator can take instead
trigger: use this when evaluating whether an assisted/automated workflow is succeeding, or when prioritizing what to fix in one — before trusting its own internal cost/quality metrics, check ADOPTION first
source: "mission-control .pandacorp/run/lessons.md 2026-09-21 (owner-stated): the owner reported barely using /pandacorp:implement or /pandacorp:spec beyond a project's first build — for ongoing changes they go manual/direct because the skills 'take forever' and cost far more tokens than the direct path. Anchor: the real, measured FRD-24 build cost $20.86 (876 calls, mission-control/.pandacorp/track.jsonl + wf_ddcc95c6-1d7.json, cited in plugin/docs/decision-log.md's speed-sprint entry, 2026-09-22, plugin v9.103.0)."
provenance: owner-stated
created: 2026-09-22
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** the factory built `/pandacorp:implement` (and the wider `spec`/`architecture`/`change` skill
chain) as the assisted, process-preserving path for building and changing a project. The owner reported
that, in practice, he barely uses it past a project's FIRST build — for ongoing changes he edits directly,
because the assisted path "takes forever" and burns far more tokens than doing it by hand. This surfaced
the same week a real measured build (FRD-24, 2 work orders) was shown to cost $20.86 over 64.8 minutes of
100%-sequential clock, with 70% of that cost in review/gate overhead and only 5.8% in actual construction.

**Lesson:** when an assisted/automated workflow has a manual escape hatch available, **adoption — is the
assisted path actually being CHOSEN over the escape hatch — is itself the primary health signal**, and it
can fail even while every internal metric the workflow's own designers track (test pass rate, gate
correctness, feature completeness) looks fine. A user who routes around a slow/expensive assisted path is
not reporting a bug in the workflow's outputs; they are reporting that the workflow's COST (latency, token
spend, friction) exceeds what its assurances are worth to them for routine changes. This is a distinct
failure mode from "the workflow is broken" — it can be "the workflow is correct but too expensive to use
for the job size it's actually facing," and no amount of internal quality tuning fixes it if the underlying
latency/cost isn't addressed. Treat a report of low adoption as load-bearing evidence in its own right, on
par with (or ahead of) an internal cost/time benchmark — the two are complementary, not substitutes:
the benchmark explains WHY the escape hatch wins; the adoption report proves the gap is severe enough to
matter in practice, not just on paper.

**Apply next time:** when auditing or redesigning an assisted workflow that has a manual alternative,
explicitly ask "is this actually being used for its intended cases, or is the operator routing around it?"
before optimizing its internals — a low-adoption workflow needs a latency/cost fix (or a cheaper class of
service for small changes) prioritized over further correctness polish that nobody will benefit from if
they never invoke it. Corroborates and motivates work like the 2026-09 implement-speed sprint (proposal 37,
plugin v9.103.0) — but the *adoption* signal itself, not just the dollar number, is the thing worth
tracking going forward (e.g. via a lightweight "assisted vs direct" usage counter) so a future latency fix
can be verified against actual behavior change, not just a lower benchmark number.
