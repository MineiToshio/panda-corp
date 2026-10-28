---
id: LESSON-0497
type: gotcha
domain: build-orchestration
tags: [implement, change, gate-change-wos, new-version, design-freeze, replan]
context: a targeted `/implement --change` run against an FRD that was recently amended by a design
  freeze/milestone (`new-version` step 3, "re-plan") but whose work orders have not been re-planned yet
trigger: use this when planning a targeted `/implement --change` run that lands cards into an FRD amended
  by a design freeze, before confirming its work orders were re-planned after the amendment
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): a targeted /implement
  --change run on an FRD amended by a design freeze, with new-version step 3 (re-plan) still pending, was
  refused by gate-change-wos. The gate judges the FRD's legacy DRAFT work orders against the amended
  frd.md, and the legacy WOs still reflect the pre-amendment contract."
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0537]
---

**Situation:** an FRD was amended by a design freeze (a `new-version` milestone), but its own work orders
had not yet been re-planned to match the amended `frd.md` (milestone step 3, "re-plan", was still
pending). A targeted `/implement --change` run tried to drain a change-queue card that landed inside
that FRD, and `gate-change-wos` refused it — the gate compares the FRD's legacy DRAFT work orders against
the amended `frd.md`, and the stale work orders no longer describe the same contract the frd.md now
states, so the gate (correctly) sees a mismatch.

**Lesson:** this is the gate working as designed, not a bug: an FRD amendment and its work-order re-plan
are two separate steps, and a targeted implement run that only checks "is there a change-queue card
pending" without first confirming the owning FRD's re-plan step actually ran will hit a hard refusal mid-
attempt, costing a wasted dispatch.

**Apply next time:** before launching a targeted `/implement --change` on any card, check whether its
FRD was recently touched by a design freeze / `new-version` milestone; if so, confirm milestone step 3
(re-plan) completed for that FRD BEFORE draining cards that land inside it. Draining first and re-planning
later just produces a guaranteed `gate-change-wos` refusal.
