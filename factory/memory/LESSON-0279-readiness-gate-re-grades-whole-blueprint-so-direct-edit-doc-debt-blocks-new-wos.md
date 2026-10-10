---
id: LESSON-0279
type: gotcha
domain: build-orchestration
tags: [readiness-gate, dr-100, blueprint, doc-debt, implement, change-queue, direct-edits]
context: a bare /pandacorp:implement that drains ready change cards into new work orders, on a project whose older FRDs were changed by direct edits without updating their blueprint/AC maps
trigger: use this when about to launch a bare /implement (especially a close-out-only run) on a project with ready change cards in older FRDs, or when the readiness gate refuses blueprints you did not touch
source: "personal-page-v2 docs/decision-log.md 2026-10-07 'Construction closed (DR-085 hardening)' + .pandacorp/run/lessons.md 2026-10-06 (agent-inferred): run wf_43145920-c54 drained two ready cards into five new PLANNED WOs (WO-05-003, WO-06-002, WO-06-003, WO-08-009, WO-03-003), then the readiness gate refused all four affected blueprints (FRD-03/05/06/08) on pre-existing doc debt: AC-to-WO maps never updated by direct changes, a stale architecture.md AC coverage map, FRD-03 still describing four case studies instead of six. Nothing was buildable; the debt was left as post-launch follow-up."
provenance: agent-inferred
created: 2026-10-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0022, BL-0225, BL-0050]
---

**Situation:** a bare `/implement` first drains `status: ready` change cards into new work orders, then the
readiness gate (DR-100) grades the affected FRD's WHOLE blueprint (DRAFT to ACTIVE), not just the new WO. On
personal-page-v2 the older FRDs had accumulated doc debt through direct edits (AC maps and the platform
coverage map not updated, an FRD narrative stale by two case studies), so every blueprint touched by the two
new cards was refused and five fresh WOs sat unbuildable. The run was meant only to close construction.

**Lesson:** a new change WO inherits the readiness debt of its whole FRD. Direct edits that skip the
two-layer doc update look free at the time and are billed later, to whichever unrelated change next touches
that FRD. Draining the queue is therefore not a neutral step in a "close-out only" run: it can convert a clean
all-verified project into one with blocked PLANNED work.

**Apply next time:** before launching a bare `/implement` meant only to close out, list the ready cards and
the FRDs they land in, and check those blueprints' readiness (AC-to-WO map current, architecture coverage
map current, FRD text matching shipped scope). Either pay the doc debt first, or hold the cards (target the
run) so they do not pull their FRDs back through the gate. When the debt is accepted, record it explicitly
as post-launch follow-up (as the project did) instead of leaving the refusal as an unexplained block.
