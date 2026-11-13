---
id: BL-0315
type: bug
area: build-engine
title: "Require source_change: [<card>] on work orders a docs unit creates in a card run"
status: done
severity: p1
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-02 (journal seq 11)"
closes: "plugin 10.4.1 — report rejects card-run docs WOs without source_change; docs brief states the rule"
links: [DR-150, DR-147, BL-0312]
---

## Problem
In funko-tracker run `br-2026-11-13-02` (card `explore-home-alive`) the docs unit created WO-01-017 and WO-01-018
(`implementation_status: PLANNED`, `status: ACTIVE`) without `source_change: [explore-home-alive]`. Its report was
committed, the planner re-ran and queued nothing (journal `wo_committed` `data.wos: []`), `next` returned `land` and
the run finished with zero build units: the work orders the card needed were never built, and nothing said why.

## Root cause
With a card scope the planner only plans work orders that the run scope lists or whose `source_change` names the card
(`plugin/runtime/build/planner/model.mjs`, in-scope predicate). The docs-unit report check
(`plugin/runtime/build/report.mjs` `checkChanges`) required a new work order to be `PLANNED` but not to carry the card,
and the docs brief never told the worker the rule. So a valid-looking docs commit silently produced unplannable work.

## Fix plan
1. `report.mjs`: in a card run, a NEW work order of a docs unit whose `source_change` does not list the card is a
   report problem (rejected like any allowlist violation; the unit's attempt is spent and it is re-dispatched with the
   evidence). Runs without a card are unchanged (their docs WOs enter through the FRD scope).
2. `units/brief.mjs`: a docs unit of a card run gets the explicit note to set `source_change: [<card>]` on every new WO;
   `units/allowlist.mjs` prints the same requirement in the docs allowlist line.
3. Document in `plugin/docs/build-engine-cli.md` (report checks) and BUILD-8 docs allowlist text.

Rejecting was chosen over auto-stamping: the engine never rewrites a worker's documents, and the rejection names the
missing card so the second attempt fixes it.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-build-v2-report.mjs` (BL-0315 cases): missing source_change rejected with the attempt consumed;
another card or an empty list rejected; inline and block lists in any case accepted; no-card runs unchanged; the
planner plans only the card-bound WO; the docs brief states the rule. Three of them fail on the previous `main`.

## Done when
Tests green, existing engine suites green, CLI reference updated, plugin bumped, decision log recorded.

## Out of scope
Auto-stamping `source_change`; any change to how non-card runs scope new WOs.
