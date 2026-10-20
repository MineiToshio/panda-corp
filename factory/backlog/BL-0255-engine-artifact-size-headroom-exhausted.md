---
id: BL-0255
type: change
area: build-engine
title: "Recover headroom under the engine artifact's 480 KB budget by moving deterministic logic into mech scripts"
status: open
severity: p1
opened: 2026-10-18
closed:
source: "BL-0251/0252 (plugin 9.132.0): the artifact was 13 bytes under budget before them; they fit only after the compactor stopped emitting indentation"
closes:
links: [BL-0204, DR-132]
---

## Problem

`test-engine-artifact.mjs` holds the generated engine (`plugin/templates/shared/.claude/engines/pandacorp-build.js`) to
480 000 bytes, with at least 40 KiB below the Workflow tool's 524 288-byte hard limit. At 9.131.0 it was 479 987 bytes
(13 bytes left). DR-132's fixes needed ~6 KB; they fit only because the compactor (`generate-engine.mjs`) stopped
emitting leading indentation (−6.5 KB), leaving the 9.132.0 artifact at 479 923 bytes (77 bytes left). The next engine
change of any size fails the gate.

## Fix plan

Move deterministic, engine-state-free logic into `plugin/scripts/build-mech-*.mjs` ops the engine already calls (the
BL-0204 rule: "move logic to a mech script instead of raising it"). Candidates, largest first: the generated prompt
fragments that are identical every run (could be read by the agent from a file the engine names instead of inlined),
the baseline pre-check prompt's STEP texts, the run-end close-out prompt bodies. Measure each move with
`generate-engine.mjs` and keep the scenario suite green.

## Tests (prove the fix — TDD, RED → GREEN)

`test-engine-artifact.mjs` keeps passing with ≥ 15 KB under the 480 000-byte budget; `test-build-engine.mjs` and
`test-pandacorp-build.mjs` unchanged in behaviour (prompt assertions updated only where a text moved to a file).

## Done when

The artifact is ≤ 465 000 bytes, the budget is not raised, and the decision log records what moved.
