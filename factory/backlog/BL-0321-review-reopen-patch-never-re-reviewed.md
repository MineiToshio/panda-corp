---
id: BL-0321
type: bug
area: build-engine
title: "A review-reopen patch never returns its FRD to G2/re-review; Astra floor reviews park when Claude is out"
status: done
severity: p0
opened: 2026-11-13
closed: 2026-11-13
source: "funko-tracker run br-2026-11-14-01: after the BL-0320 resume, next returned stop no_progress at once"
closes: "plugin 10.6.0 — patchSupersedes restores review-reopen patches; DR-161 covers >= 90 % reviews too"
links: [DR-161, BL-0320, BUILD-10, BUILD-15]
---

## Problem
After an FRD review `reopen`, the patch unit was dispatched, committed and integrated, but the run stopped with
"nada más puede avanzar". State: the reopened build unit stayed `patching`, the patch `integrated`, the review
`verified` (verdict reopen); no G2, no re-review, no landing.

## Root cause
1. `restorePatchedUnits` (next/harvest.mjs) returned superseded units to `integrated` only for G2/G3 gate patches,
   which carry `gate-failure.json`. A review-reopen patch has none, so its superseded build unit stayed `patching`;
   `patching` is not in `INTEGRATED_OR_LATER`, so `frdsReadyForG2` never selected the FRD again. Every review reopen
   in any run deadlocked this way; no suite covered reopen → patch integrated → G2.
2. With Claude out of quota (91 % weekly), the re-review of an Astra-authored floor/r1 diff parked (`no_reviewer`,
   row 13) and an Astra-authored `none` diff got a same-model N7 review with a deferred Claude re-review, against the
   owner's option A (DR-161: less than 15 % left, which includes >= 90 %).

## Fix
`patchSupersedes(state, patch, evidence)` (exported, pure): a gate patch keeps its `fixes` list; a review-reopen patch
supersedes the `patching` units of its FRD that own one of its work orders. Routing treats `quota` like `conserve` for
reviews: the row's `on_conserve` cell (another model of the author's company: Astra-built → Sol high, r1/floor Sol
xhigh; Astra session touch → Sol high) and never a deferred re-review; `review-record` skips the deferred entry when the
needed company is conserved or out. `unreachable` keeps its previous behaviour (N7 analog, park, deferred).

## Verification
`test-build-v2-conserve.mjs` (BL-0321 supersede cases, Astra floor on quota never parks, no deferred),
`test-build-v2-routing.mjs` (rows 12, 13, 15 on quota; exhaustive invariant: no deferred when the other company is
scarce; negative control), all `test-build-v2-*` suites.
