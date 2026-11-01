---
id: LESSON-0585
type: anti-pattern
domain: build-orchestration
tags: [close-out, false-done, dr-069, work-orders, change-queue]
context: a close-out/status check that infers "the build is finished" from 100% of work orders rolling up to VERIFIED, without separately checking the project's open-changes queue
trigger: use this when deciding, or building tooling to decide, whether a project's construction is finished based on work-order rollup state
source: "mission-control docs/decision-log.md 2026-10-31 ('Close-out inventory without phase promotion') (agent-inferred) — all 149 work-orders and all 26 FRD/blueprint rollups were VERIFIED, yet the project still had four open changes in its `.pandacorp/inbox/changes/` queue (DR-069) and no build lease was active; the close-out explicitly recorded this as 'not a release or full-gate certification' rather than treating the 100% WO rollup as done"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0022]
---

**Situation:** an inventory/close-out pass found every tracked work order and every FRD/blueprint rollup
at VERIFIED — by that single metric, the build looked complete. The project nonetheless had four open
changes still sitting in its change queue (features/fixes classified and captured via `/pandacorp:change`
but not yet implemented) and no active build lease, so declaring the construction phase finished on the
WO-rollup signal alone would have been wrong.

**Lesson:** "every known work order is verified" and "the project has no more work to do" are two
DIFFERENT claims — the first is a closed-world check over what the build engine already knows about; the
second also requires the open-changes queue (DR-069's unified inbox) to be empty, because a change can be
captured and waiting WITHOUT yet having its own work order. A rollup-only check is blind to that queue by
construction — it only ever sees WOs that already exist.

**Apply next time:** any close-out, phase-promotion, or "is this project done" check must verify BOTH
axes independently: (1) work-order/FRD rollup state, AND (2) the open-changes queue (`.pandacorp/inbox/changes/`)
is empty of pending/queued items. A 100% rollup with a non-empty change queue is not finished — report it
as a build still in progress, never promote the phase on rollup alone.
