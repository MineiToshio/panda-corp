---
id: BL-0073
type: bug
area: build-engine
title: "Require fenced stop receipt at every build safe point"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "R10-F installed Claude canary run wf_69f1bdab-89f"
closes: "plugin 9.95.1 / overlay 8.76.1 recurring fenced stop receipt"
links: [DR-068, BL-0068]
---

## Problem

Pandacorp 9.95.0 passed its installed-runtime preflight but the R10-F Claude Stage 1 stopped before
building any work order. The mid-run safe-point agent used ambient shell `test -f` to inspect
`.pandacorp/run/stop`; the host aliases `test` to `npm test`, which returned zero and fabricated an
owner stop. The run ended as `stopReason: rethink`, with FRD-A and WO-A still `PLANNED` and no
`last_green_sha`. This contradicts the documented DR-068/BL-0068 contract that stop truth comes only
from the fenced deterministic `inspect-stop` receipt.

## Root cause

BL-0068 made the pre-loop check deterministic, but the recurring safe-point prompt still delegates
stop inspection as prose. A subagent can therefore improvise an ambient shell predicate instead of
calling the launcher-provided absolute `stateCli` capability with the current token and epoch.

## Fix plan

1. Change the build engine's recurring safe-point contract so stop truth is obtained exclusively from
   the absolute launcher-provided `stateCli inspect-stop` fenced receipt; the agent must not use
   `test`, `[`, filesystem aliases or infer stop from absence/presence itself.
2. Validate the receipt fail-closed and keep change/decision queue processing separate from stop truth.
3. Add adversarial engine tests with `test` shadowed to a successful command, proving an absent stop
   remains false and a real regular stop file remains true at the recurring safe point.
4. Propagate the managed engine and operative documentation, bump plugin and overlay versions where
   required, and record the decision in the plugin log and Mission Control Manual.

## Tests (prove the fix — TDD, RED → GREEN)

- Extend `plugin/scripts/test-pandacorp-build.mjs` to inspect and execute the recurring safe-point
  prompt under a shadowed `test` command; it must continue when the fenced receipt says `stop:false`.
- Add the positive owner-stop case and malformed/failed receipt case; real stop must halt, while an
  invalid receipt must fail closed rather than guess.
- Run the build-engine, state-CLI, launcher/lifecycle and managed-source drift suites plus Mission
  Control typecheck and backlog validation.

## Done when

- No recurring safe-point prompt can derive stop truth through ambient shell predicates.
- Adversarial absent, present and invalid-receipt tests are green.
- Canonical engine, overlay copy, standard, implement skill and Manual agree on the contract.
- Plugin semver and overlay version are bumped, plugin validates, backlog validates, and this item is
  closed with the shipped version.

## Out of scope

Do not run Codex Stage 2 or promote Codex `implement`. Do not reuse or mutate the failed R10-F fixture;
prepare a fresh fixture only after this correction ships.
