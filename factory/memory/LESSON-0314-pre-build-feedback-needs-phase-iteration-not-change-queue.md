---
id: LESSON-0314
type: gotcha
domain: factory-process
tags: [dr-032, dr-069, change-queue, spec-iteration, pre-build]
context: owner feedback arrives on a project that has NOT started implementation yet (phase product/design/architecture) and clarifies or changes already-documented requirements, not a bug in a built artifact
trigger: use this when deciding how to route owner feedback on a project still in a pre-build phase (phase != implementation/release) that touches existing PRD/FRD/blueprint content
source: "pandasaga .pandacorp/comms/iteration.md 2026-10-12 (agent-inferred, from an owner-feedback event): round 2 entry reads 'Corregida la captura inicial: esta aclaración se incorpora ahora en PRD, FRD-01, FRD-02... mediante una iteración de Producto; no espera al build' — the project's own log records a self-correction from an initial wrong capture attempt into .pandacorp/inbox/changes to the correct spec-iteration path"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [pandasaga]
links: [DR-032, DR-069, BL-0234]
---

**Situation:** on a project still in a pre-build manual phase (`product`/`design`/`architecture` —
`phase` in `.pandacorp/status.yaml` is not yet `implementation`/`release`), the owner gave feedback that
clarified or changed requirements already written into the PRD/FRDs. The first instinct was to capture
it as a queued change (the `change`/DR-069 front door, which files to `.pandacorp/inbox/changes/` "for
the build to drain at its next safe point") — but there is no build yet to drain that queue, and the
queue mechanism never touches the PRD/FRD source documents. The project's own iteration log records the
self-correction: the clarification was instead folded directly into the PRD/FRD/decision-log via a
`spec` iteration (DR-032), same turn, "no espera al build".

**Lesson:** `change` (DR-069) and phase iteration (DR-032) solve different problems and are not
interchangeable just because both accept owner feedback. The change-queue assumes a project that is
already built (or being built) and drains at a safe point in the BUILD; it never updates the canonical
spec docs. DR-032's phase iteration is the only path that keeps the PRD/FRD/blueprint (the "current
truth", per the decision-log discipline) in sync with feedback given before those docs are finalized.
Routing pre-build requirement clarifications to the change-queue silently lets the specs drift out of
date relative to what will eventually be built — the gap only surfaces later, expensively, during
`architecture`/`implement`.

**Apply next time:** before filing owner feedback to `.pandacorp/inbox/changes/`, check the project's
current `phase` in `.pandacorp/status.yaml`. If it is still a pre-build manual phase
(`product`/`design`/`architecture`) and the feedback changes/clarifies existing documented requirements
(not a bug report against something already built), re-run that phase's skill (`spec`/`design`/
`architecture`) to fold the change directly into the canonical doc, and log the round in
`.pandacorp/comms/iteration.md` per DR-032 — do not file it to the change-queue. Only route to `change`
once the project has an actual build to drain the queue against, or when the feedback is a bug against
already-shipped behavior.
