---
id: BL-0299
type: bug
area: build-engine
title: "Run the production smoke on mobile as well as desktop"
status: open
severity: p1
opened: 2026-10-31
closed:
source: "Owner close-out decision, Mission Control, 2026-10-31"
closes:
links: []
---

## Problem

`plugin/scripts/build-mech-close.mjs:285` runs `e2e/prod-smoke.spec.ts` with
`--project desktop`. Mission Control defines desktop and mobile projects in `playwright.config.ts`;
its smoke loops over 14 distinct routes. The 14 mobile production cases are excluded by the engine,
so a green production close cannot establish phone coverage. The integration log queue8.log records
28 production-smoke cases skipped in the ordinary development-server suite; those skips do not
replace an actual production smoke.

## Root cause

The producer pins the desktop project. Report aggregation also needs inspection: it currently
judges route rows without an explicit required route-by-project coverage contract.

## Fix plan

1. Update `plugin/scripts/build-mech-close.mjs` production smoke dispatch to include supported target projects.
2. Carry project/viewport identity in production-smoke records and fail closed on missing required route/project pairs; update the stack smoke template and its tests as needed.
3. Preserve production mode, isolated checkout ownership and port isolation; update the operable Manual documentation alongside the producer.
4. Bump plugin metadata and overlay version only where template changes require it.

## Tests (prove the fix — TDD, RED → GREEN)

Add a producer CLI/spawn assertion proving desktop and mobile are selected. Exercise the report reader
with all 14 routes on both projects (green), desktop-only rows (red), an empty report (red), and one
mobile-only render failure (red). Put regressions beside the existing build-mech-close/report tests.

## Done when

The engine executes 14 desktop plus 14 mobile Mission Control production cases, and its completeness
check rejects desktop-only evidence. A failing mobile route prevents green. Producer/template tests and
required version/documentation checks pass.

## Out of scope

This card captures factory work only. No implementation, plugin edits or project gate execution is part of the documentary close-out.
