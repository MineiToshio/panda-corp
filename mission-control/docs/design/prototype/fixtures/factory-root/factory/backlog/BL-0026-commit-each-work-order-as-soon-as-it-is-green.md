---
id: "BL-0026"
type: "change"
area: "build-engine"
title: "Commit each work order as soon as it is green"
status: "done"
severity: "p1"
opened: "2026-08-12"
closed: "2026-08-16"
source: "owner report"
closes: ""
links: []
---

## Problem
Batch commits per wave lost work on a crash.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
