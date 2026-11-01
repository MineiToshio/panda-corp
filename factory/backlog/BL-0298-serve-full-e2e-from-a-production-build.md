---
id: BL-0298
type: change
area: templates
title: "Serve full Playwright passes from a production build through a project seed"
status: done
severity: p2
opened: 2026-10-31
closed: 2026-10-31
source: "funko-tracker measurement 2026-10-31, owner asked for much faster full passes"
closes: "DR-143 review, plugin 9.148.0, overlay 8.116.0"
links: [DR-143, BL-0296]
---

## Problem
One `next dev` limits Playwright: per-test time triples at 3 workers and parallel runs time out.

## Fix plan
Optional `e2e/prod-server.mjs` (`build`, `start <port>`). The full `verify.sh` builds once and sets
`PANDACORP_E2E_SERVER=prod`. Add `e2e/page-errors.spec.ts`, which sweeps every surface in that mode.

## Tests
`plugin/scripts/test-e2e-tiers.mjs` and the DR-143 scenarios in `plugin/scripts/test-verify-gate-report.sh`.

## Done when
Without the seed nothing changes; with it, one build serves both tiers and a red build reds the gate.

## Out of scope
Shrinking the serial tier, and funko-tracker's own adoption.
