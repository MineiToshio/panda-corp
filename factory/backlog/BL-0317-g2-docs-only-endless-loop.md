---
id: BL-0317
type: bug
area: build-engine
title: "Stop the endless green G2 loop on an FRD whose only integrated unit is a docs unit"
status: done
severity: p0
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-02 at epoch 27 (39 green G2 gates at sha ce047e0b in ~2 h, journal seq 62-218)"
closes: "plugin 10.4.3 — frdsReadyForG2 ignores docs units; green G2 with no work queues no review; an empty FRD review is settled and the landing retried"
links: [DR-150, BL-0316]
---

## Problem
Resumed at epoch 27, funko-tracker run `br-2026-11-13-02` held a `docs` unit `integrated` in
`frd-01-catalog-browsing`, a blocked `u-patch-g3` and a queued `u-review-frd-01-catalog-browsing`. `next` spawned a G2 for
the FRD, harvested it green, and spawned it again: 39 green G2 gates at the same sha in about two hours, never reviewing,
landing or finishing, until the coordinator stopped the run by hand.

## Root cause
`frdsReadyForG2` (`plugin/runtime/build/integrate/chain.mjs`) declares an FRD ready when all its units are integrated or
later and at least one is exactly `integrated`, counting `docs` units. A green G2 moves only `build`/`patch`/`tests` units
to `reviewing` (`FRD_WORK_KINDS`); a `docs` unit is never reviewed and stays `integrated`, so the FRD is G2-ready again on
the very next pass. The review queued by the first green G2 had nothing to review, so the candidate builder never
dispatched it, and the run could not reach its landing.

## Fix plan
1. `frdsReadyForG2`: only an `integrated` build/patch/tests unit triggers a G2; docs units still count in the
   "everything integrated or later" condition but never trigger it alone (they land as integrated; G3 verifies them).
2. `next/harvest.mjs`: a green G2 with no build/patch/tests work queues no review.
3. `next/candidates.mjs` + `next/step.mjs`: a queued FRD review with no reviewable unit of its FRD and no named unit is
   settled `verified` (`unit_state` reason `nothing_to_review`), and that pass returns `wait` (reason `gate`) so the
   next pass reaches the landing decision instead of stopping with `no_progress`. This also unsticks a run already in
   the funko state.
4. Document in the CLI reference (G2 rule) and BUILD-9.

## Tests (prove the fix — TDD, RED → GREEN)
`test-build-v2-integrate.mjs` BL-0317 (docs-only FRD, the state after a green G2, after review: not ready; controls with
integrated build or tests work: ready) and `test-build-v2-next.mjs` BL-0317 (the funko state: no G2 spawned in two
passes, the empty review settled, the second pass returns `land`; control: a review with reviewable work is not settled).
Both fail on the previous `main`.

## Done when
Tests green, engine suites green, CLI reference and BUILD-9 updated, plugin bumped, decision log recorded.
