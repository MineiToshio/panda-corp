---
id: BL-0063
type: change
area: build-engine
title: "Mock-worker harness: e2e the build engine offline, deterministically, zero token cost"
status: open
severity: p1
opened: 2026-07-10
closed:
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10"
closes:
links: [DR-050, DR-117, DR-118, DR-060]
---

## Problem
`pandacorp-build.js` (`plugin/templates/shared/.claude/engines/pandacorp-build.js`, 2057 lines: wave
scheduler, disjoint-artifact serialization DR-060, split gate, patch-first, DR-117 four-class recovery
ladder, seam reverts, journal, rollup persistence) has NO offline test seam — agent spawns go straight
through the Workflow/Agent tool with no swappable boundary, and no test exercises the engine. Consequence:
every engine change (DR-117/118, proposal-31, BL-0021, split-gate) is validated only by "the next real
build" — expensive, non-deterministic, and structurally unable to exercise the recovery ladder (you cannot
make a real subagent fail as `architectural` vs `deadlocked-contract` on demand).

## Fix plan
Adapt ringer's mock engine pattern (`engines/mock_worker.py` + `tests/test_mock_engine.py`): introduce a
mock worker selectable behind a flag/env — a fake agent that reads deterministic directives from a WO/gate
fixture (write these artifacts / fail with this finding-class / green on attempt N) and returns them
WITHOUT spawning a real subagent. Requires adding a single spawn seam in `pandacorp-build.js` (the point
where it currently calls out to the Workflow/Agent tool). Then drive the whole state machine from fixtures:
1. Add the spawn seam (one call site, swappable implementation).
2. Add the mock worker + a fixture format (WO/gate directives: artifacts to write, finding-class to fail
   with, attempt number to go green on).
3. Add a fixture suite covering a full multi-FRD plan.

## Tests (prove the fix — TDD, RED → GREEN)
RED = today, no test exercises `pandacorp-build.js`'s state machine at all (zero engine tests, confirmed).
GREEN = a test suite that runs a full multi-FRD plan against fixture workers with zero real agent spawns,
asserting resulting frontmatter/rollups/journal deterministically after each fixture-driven step.

## Done when
(1) the engine runs a full multi-FRD plan against fixture workers with zero real agent spawns; (2)
fixtures can drive each DR-117 recovery class, revert+reopen, MAX_REOPENS block, and DR-060 serialization,
asserting resulting frontmatter/rollups/journal deterministically; (3) runs in under a minute with no API
bill; a decision-log entry links this item.

## Out of scope
Replacing or removing the real Workflow/Agent-tool spawn path — the mock worker is an additional, opt-in
seam for testing, not a production mode change.
