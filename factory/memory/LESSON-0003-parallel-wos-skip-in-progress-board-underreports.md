---
id: LESSON-0003
type: anti-pattern
domain: factory-engineering
tags: [build-engine, observability, mission-control, kanban, implementation-status, dr-097, parallel-waves, frontmatter-lag]
context: during a parallel build wave, work orders are actively built (artifact files exist on disk) while their implementation_status frontmatter still says PLANNED, so the Mission Control board shows them in To Do / En Progreso 0 — under-reporting in-flight work because the IN_PROGRESS transition is not reliably written at dispatch
source: project personal-page-v2, build run wf_b01c0efe-146 — WO-03-001 and all of Wave-1 have built artifacts (src/app/[locale]/ projects|about|now|blog|contact created ~3h into the build) while their WO frontmatter is still implementation_status=PLANNED, last_updated=2026-06-29; board EN PROGRESO shows 0
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 0
links: [BL-0002, DR-097, DR-050, LESSON-0002]
---

**Situation:** The owner, watching Mission Control's Work-Orders board mid-build, saw "EN PROGRESO 0"
and WO-03-001 in the "To Do" column, even though WO-03 was actively being implemented. Verified on the
filesystem: ALL of Wave-1's route subtrees already existed (`src/app/[locale]/projects/`, `about/`,
`now/`, `blog/`, `contact/` — created ~3h into run wf_b01c0efe-146), i.e. the engine had fanned out the
entire feature wave in parallel (overlapping it with the still-running FRD-01 foundation gate, good for
speed). But every one of those WOs still carried `implementation_status: PLANNED` (WO-03-001's
`last_updated` was even still `2026-06-29`, the pre-build date). The board derives its column purely from
`implementation_status` (PLANNED→To Do, IN_PROGRESS→En Progreso, IN_REVIEW→Review/Testing,
VERIFIED→Hecho, BLOCKED→Falló), so it showed five actively-building WOs as "To Do" and zero in progress.

**Lesson:** The IN_PROGRESS transition is not being reliably written when a WO actually starts building
in a parallel wave — implementers appear to go PLANNED → (write artifacts) → IN_REVIEW, skipping the
visible IN_PROGRESS phase. This violates DR-097 ("while building → IN_PROGRESS") and makes the live board
(and any consumer of `implementation_status`, e.g. Mission Control, the portfolio rollup) **under-report
real in-flight work** — the build is further along than the board shows. Relying on the implementer agent
to self-report its own start is fragile: under a wide parallel fan-out the flip lags or is skipped, and
"To Do / En Progreso 0" misleads the owner into thinking work is stalled when it is not. State that
exists on disk but not in the frontmatter is exactly the kind of silent drift the status field is meant
to prevent.

**Apply next time (the durable principle):** State that exists on disk but not in the frontmatter is silent
drift — exactly what a status field is meant to prevent. Do not rely on a worker agent to self-report its
own *start*: under a wide parallel fan-out the flip lags or is skipped, so the transition that drives an
observability surface (a board column, a rollup) must be owned by the **orchestrator at dispatch**, written
atomically and independent of the worker, not left to the worker's first action. "Emit the state change at
the control point that owns the timing" generalizes beyond this one field.

> The concrete engine fix (write IN_PROGRESS at dispatch in `pandacorp-build.js`, the belt-and-suspenders
> agent flip, the optional drift check) is an **actionable defect** — an enforcement fix of DR-097 — tracked
> as **BL-0002** in `factory/backlog/`, not part of this durable lesson (DR-103).

**Why it matters:** the board is the owner's primary live view of a long, unattended build. If it shows
"To Do / 0 in progress" while five WOs are being built in parallel, the owner reads a healthy,
fast-moving build as stalled — eroding trust in the very observability the factory ships. The fix is
small (one engine write at dispatch) and removes a whole class of false-stall confusion. Pairs with
LESSON-0002 (both are build-engine fidelity gaps surfaced by the personal-page-v2 build).
