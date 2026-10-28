---
id: LESSON-0537
type: gotcha
domain: factory-engineering
tags: [new-version, flip-active, ac-matrix, plan-consistency, brownfield, legacy-work-orders]
context: upgrading an existing, already-shipped (v1) Pandacorp project to a v2 via `new-version`, where flipping any v2 FRD to active requires the project-wide `ac-matrix`/`plan-consistency` gates to pass
trigger: use this when planning a `new-version` milestone against a legacy v1 project and deciding when any v2 FRD can flip active — before assuming only the FRDs actually being redesigned need attention
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred) — Mission Control v2 design freeze/flip-active"
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0497]
---

**Situation:** flipping a v2 FRD to `active` requires the `ac-matrix`/`plan-consistency` gates to report
green PROJECT-WIDE, not just for the FRD being flipped. On a legacy v1 project whose older work orders
predate these gates, many of them carry undefined AC ids or non-verbatim copies of their acceptance
criteria — defects the gates were never run against before. The first attempt to flip any v2 FRD active
therefore fails not because of the v2 FRD itself, but because the whole project's pre-existing work-order
corpus has never been normalized to the gates' expectations.

**Lesson:** a brownfield `new-version` on a project old enough to predate the current gate contract
carries hidden, project-wide debt that only surfaces at the FIRST flip-active attempt — late, expensive,
and unrelated to the actual redesign work. This is a structural cousin of LESSON-0497 (a stale downstream
artifact silently blocking a gate): here the blocker is the ENTIRE corpus of legacy work orders, not one
FRD's own re-plan.

**Apply next time:** before starting a `new-version` milestone on a legacy project, run the project-wide
`ac-matrix`/`plan-consistency` gates once, up front, against the CURRENT (pre-redesign) state, and budget
normalizing every legacy work order that fails (defining missing AC ids, making copies verbatim) as its
own explicit stage of the milestone plan — not something discovered mid-flip. Treat "gates were green
when this project last touched them" as unverified until re-confirmed; an old project's WOs predating a
gate's introduction are not grandfathered in.
