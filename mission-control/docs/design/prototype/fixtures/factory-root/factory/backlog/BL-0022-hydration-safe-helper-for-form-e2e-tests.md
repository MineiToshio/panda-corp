---
id: "BL-0022"
type: "change"
area: "templates"
title: "Hydration-safe helper for form e2e tests"
status: "done"
severity: "p2"
opened: "2026-08-26"
closed: "2026-08-28"
source: "owner report"
closes: ""
links:
  - "DR-047"
---

## Problem
Form tests were flaky before hydration.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
