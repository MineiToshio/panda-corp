---
id: LESSON-0243
type: gotcha
domain: build-orchestration
tags: [dr-111, judge-tier, opus, vendor-outage, http-529, preflight, architecture-gate]
context: an architecture-phase JUDGE-tier (opus) gate (DR-100 readiness / DR-102 repo-grounding / DR-116 contradiction) cannot be dispatched because the model itself is returning transient server errors, not because the content under review is bad
trigger: use this when a JUDGE-tier (opus) gate fails to run with repeated HTTP 5xx/overloaded errors right before or during a build, and you're deciding whether to downgrade the tier or force the gate through
source: "mission-control decision-log 2026-09-03 (FRD-24 materialization): 10 dispatch attempts across all 3 JUDGE gates over ~25 minutes all failed with HTTP 529 Overloaded on claude-opus-5, independently confirmed via status.claude.com (active incident 461yvfrzpwtt naming Opus 5/4.8/4.6 and Fable 5/5.1); the blueprint/WOs correctly stayed status: DRAFT, and preflight-implement.sh then correctly failed check 5 (un-gated DRAFT work order) for the WHOLE project, blocking any /pandacorp:implement launch until the gates ran"
provenance: agent-inferred
created: 2026-09-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0159]
---

**Situation:** a fresh FRD's blueprint and work orders could not clear their three JUDGE-tier architecture gates because the opus model itself was returning `HTTP 529 Overloaded` on every dispatch attempt — an active, independently-confirmed vendor incident, not a content problem with the blueprint. Per DR-111/DR-113 the JUDGE tier is never auto-downgraded, so the work orders correctly remained `status: DRAFT` instead of being force-flipped to `ACTIVE` on an incomplete review. Because the project's preflight checks for ANY un-gated DRAFT work order project-wide (not just the ones touched), this correctly blocked the whole project's build launch until the gates could actually run.

**Lesson:** a vendor outage on the JUDGE-tier model is not a reason to relax the gate (downgrade tier, force-flip status, or skip the check) — it is a reason to wait and retry. The resulting whole-project preflight block is working as designed (fail-closed on any un-gated DRAFT WO), even though it is inconvenient; confirm the outage independently (status page) before assuming the gate itself is broken, and record the block in the queue card / blueprint header so a future session doesn't re-materialize a duplicate FRD instead of just re-running the stuck gates.

**Apply next time:** when a JUDGE-tier gate can't be dispatched due to repeated 5xx/overloaded errors, (1) independently confirm it's a vendor incident (status page), (2) leave the work order at `DRAFT` rather than downgrading the tier or forcing it green, (3) expect and accept the resulting whole-project build block until the gate re-runs successfully, and (4) note the block where a future session will see it before attempting to re-materialize the same work.
