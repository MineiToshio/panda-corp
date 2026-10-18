---
id: BL-0254
type: bug
area: build-engine
title: "A relaunch with IN_REVIEW carry-over committed beyond a published last_green_sha still escalates to the judge baseline"
status: open
severity: p1
opened: 2026-10-18
closed:
source: "BL-0252 red-team (funko-tracker relaunch analysis, 2026-10-18)"
closes:
links: [BL-0252, DR-132, BL-0212]
---

## Problem

BL-0252 (DR-132 (5)) skips the judge baseline only when NO `last_green_sha` is published. Once one FRD is VERIFIED the
pin exists; a run interrupted after more WOs landed IN_REVIEW leaves a CLEAN tree whose HEAD is beyond the pin (not the
BL-0066 pointer commit), so both lanes escalate (`escalate`, `dirty: false`) to the opus baseline-repair engineer. Its
full `verify.sh` can be red by construction for the same reason (knip: primitives whose consumers are later WOs), and
its "fix the production code" step can delete legitimate IN_REVIEW work. Likely common: every interrupted multi-FRD
build after its first VERIFIED.

## Fix plan

1. Define (one function, beside `decideCarryOver`) "every commit in `last_green..HEAD` is a commit-wo / engine-metadata
   commit of a work order now IN_REVIEW" deterministically (commit subjects are not enough: read each commit's changed
   paths against the WOs' declared artifacts, or the commit-wo trailer if one exists).
2. When it holds on a clean tree, the baseline is not applicable (as BL-0252); otherwise keep the judge.
3. Or, narrower: make the judge baseline's RED branch refuse to edit files owned by IN_REVIEW work orders (report
   instead), so a red-by-construction tree stops for the owner rather than losing work.

## Tests (prove the fix — TDD, RED → GREEN)

Engine scenario: precheck `escalate, dirty:false` + a probe line with a published pin and IN_REVIEW carry-over → no
`baseline` spawn (or a judge prompt that forbids editing IN_REVIEW-owned files); a pin with an unrelated commit beyond it
→ judge unchanged. Script fixture for the new definition.

## Done when

The scenario is green, the definition is the only one (DR-115), DR-132 is amended.
