---
id: "BL-0028"
type: "change"
area: "plugin"
title: "Validate the plugin manifests in CI"
status: "done"
severity: "p2"
opened: "2026-08-04"
closed: "2026-08-08"
source: "memory review"
closes: ""
links:
  - "DR-047"
---

## Problem
A hand-edited manifest drifted from its source.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
