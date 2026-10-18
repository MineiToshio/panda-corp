---
id: BL-0252
type: bug
area: build-engine
title: "A relaunch over a clean half-built tree (no last_green_sha, WOs IN_REVIEW) escalates to the judge baseline, whose repair can delete legitimate work"
status: done
severity: p1
opened: 2026-10-18
closed: 2026-10-18
source: "funko-tracker relaunch analysis after run_20261018T033601Z_80858 (originating session report)"
closes: "DR-132 (5); plugin 9.132.0, OVERLAY_VERSION 8.102.0"
links: [DR-132, BL-0251, BL-0254]
---

## Problem

Mid-build a project has no `last_green_sha` and some WOs committed `IN_REVIEW`. Its full `verify.sh` is red BY
CONSTRUCTION: knip flags the primitives whose consumers are later WOs (funko-tracker: `src/i18n/getT.ts`,
`src/lib/analytics/client.ts`, `posthog-js`). On such a CLEAN tree the baseline is neither `green` (no pin),
`leased-status-only` (nothing dirty) nor `greenfield` (something was built), so both lanes escalate to the opus
"baseline-repair engineer", which runs the full verify and "fixes the production code" on red — likely deleting
legitimate work.

The originating report blamed `STRICT_BASELINE = argBool(args, 'strictBaseline', true)` defaulting to true. Verified
false: `argBool(a, key, expect)` is `a[key] === expect`, so the flag is off unless passed; the launcher never passes it.
The real exposure is the clean-tree case above (a relaunch whose lease write is not dirty, e.g. after a committed
projection; a dirty `status.yaml` alone already takes BL-0124's leased-status-only path).

## Fix plan

`decideCarryOver` in `plugin/scripts/greenfield-probe.mjs` (the one definition, sealed as `carryOver` in the probe line):
no pin, not adopted, ≥ 1 WO, statuses ⊆ PLANNED/DRAFT/IN_REVIEW (+IN_PROGRESS for the fast lane), ≥ 1 IN_REVIEW, none
VERIFIED/BLOCKED. Applied only to a clean tree: classic `precheck.dirty === false`; the fast `precheck` (`carryOverOf`);
`fast-start` `carry-over` verdict (empty dirty list). `args.strictBaseline` keeps the judge.

## Tests (prove the fix — TDD, RED → GREEN)

`test-build-engine.mjs` BL-0252-a (classic clean half-built → no `baseline` spawn), BL-0252-b ×5 (dirty, VERIFIED,
published pin, strictBaseline, broken seal → judge), BL-0252-c (fast lane carry-over → no judge; strictBaseline → judge);
`test-greenfield-probe.mjs` (real git fixture + decideCarryOver refusals); `test-build-mech.mjs` fast-start carry-over
(clean → `carry-over`, dirty → not). BL-0252-a/c RED against 9.131.0.

## Done when

Suites green; plugin 9.132.0 + OVERLAY 8.102.0; DR-132 recorded.

## Out of scope

The same exposure over a PUBLISHED `last_green_sha` with IN_REVIEW carry-over beyond it → BL-0254.
