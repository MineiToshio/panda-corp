---
id: BL-0225
type: bug
area: build-engine
title: "Bare /implement on an empty plan returns 'all verified' without running the DR-085 Hardening chain or close-out, so a project can never reach phase: release"
status: open
severity: p1
opened: 2026-10-07
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-10-06 (agent-inferred, 'ENGINE GAP') + docs/decision-log.md 2026-10-07 'Construction closed (DR-085 hardening)': run wf_43145920-c54 drained two change cards into five PLANNED WOs, the readiness gate refused all four affected blueprints, the engine then returned 'all verified' on the empty plan without the Hardening chain; the owner had to run security-auditor, implementer and analytics by hand (docs/reviews/security-2026-10-07.md: 0 critical, 1 high, 7 medium, 7 low; analytics: 3 tracking gaps fixed). Verified live by the librarian 2026-10-07 in plugin/templates/shared/.claude/engines/pandacorp-build.js (plugin 9.121.0): the plan.frds.length === 0 branch at ~L1269-1273 does ensureStopped('nothing to build') and returns note 'all verified'; runHardeningChain() (L4377) is only invoked from the post-loop allDone/release branches (L4572, L4634)."
closes:
links: [LESSON-0022, BL-0012, BL-0129, BL-0076, DR-085]
---

## Problem
A project whose last work orders were VERIFIED outside the engine (for example a manual FRD-gate re-run) has
`plan.frds.length === 0` on its next bare `/pandacorp:implement`. The engine's empty-plan branch exits with
`{ note: 'all verified' }` BEFORE the loop, so the DR-085 hardening (security audit, fix, telemetry
verification) and the whole-project close-out that sets `phase: release` never run. The project is stuck at
`phase: implementation` forever on the bare path: nothing buildable, nothing to harden. personal-page-v2
needed a manual orchestration of the same agents to close construction. This is the same false-done family as
BL-0012 (release without hardening), inverted: here hardening is unreachable rather than skipped.

## Root cause
BL-0129 made the empty-plan branch drain the DR-069 change queue (checked, not skipped) but left it exiting
straight to `ensureStopped('nothing to build')`. The Hardening chain + close-out are only wired into the
post-loop `allDone` path, which an empty plan never reaches.

## Fix plan
In `plugin/templates/shared/.claude/engines/pandacorp-build.js`, in the `plan.frds.length === 0` branch, after
the queue-drain confirms nothing buildable: if `status.yaml` `phase` is still `implementation`, every WO of
every FRD is VERIFIED (no IN_REVIEW/PLANNED-and-buildable remain), the run is not TARGETED (BL-0076), and no
`docs/reviews/security-*.md` exists, run `runHardeningChain()` and the same close-out/release transition the
`allDone` path uses; otherwise keep today's early exit. When PLANNED WOs exist but are blocked by the readiness
gate, do NOT release; return a distinct note (for example `blocked-by-readiness`) naming the blueprints, not
'all verified'.

## Tests (prove the fix: TDD, RED to GREEN)
Extend `plugin/scripts/test-pandacorp-build.mjs` next to BL-0129's E2a-E2d scenarios: a project at
`phase: implementation`, all WOs VERIFIED, no security report: RED today (returns 'all verified', zero
Hardening events), GREEN after (Hardening chain runs, release transition fires). Add the negative: targeted
run, or a report already present, keeps the early exit; and a readiness-blocked PLANNED WO returns the distinct
note and never releases.

## Done when
The new harness scenarios pass; plugin PATCH + manifests regenerated; LESSON-0022 back-linked.

## Out of scope
The readiness gate's own strictness (re-grading whole blueprints, DR-100); see LESSON-0279 for the process
side.
