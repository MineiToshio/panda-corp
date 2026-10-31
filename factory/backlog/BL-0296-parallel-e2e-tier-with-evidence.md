---
id: BL-0296
type: change
area: templates
title: "Add an optional evidence-based parallel e2e tier and stop repeating viewport-agnostic gates"
status: done
severity: p2
opened: 2026-10-31
closed: 2026-10-31
source: "owner request via funko-tracker session, full pass about 20 min"
closes: "DR-143, plugin 9.147.0, overlay 8.115.0"
links: [DR-143, DR-056, DR-076]
---

## Problem
Full Playwright passes run every spec on one worker in both viewports. funko-tracker takes 459-475 s of
test time. A global worker bump is unsafe: specs share one fixture user, and a naive 3-worker run failed.

## Fix plan
Optional `e2e/parallel-safe.json`; `verify.sh` runs a parallel tier, then a serial tier. Desktop-only
`shell`, `headers` and `hydration`. Optional `e2e/globalSetup.ts` wiring.

## Tests
`plugin/scripts/test-e2e-tiers.mjs`, plus the DR-143 scenarios in `plugin/scripts/test-verify-gate-report.sh`.

## Done when
Absent file keeps one run; tiers split and fail closed; funko-tracker keeps every unique test (422 of 422)
with measured time saved. Adoption in a project is that project's own change.

## Out of scope
A production-build e2e server, and funko-tracker's own adoption.
