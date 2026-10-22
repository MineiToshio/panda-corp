---
id: "BL-0012"
type: "bug"
area: "build-engine"
title: "A reverted work order kept its verified status"
status: "done"
severity: "p0"
opened: "2026-09-12"
closed: "2026-09-16"
source: "build close-out"
closes: ""
links: []
---

## Problem
After a partial revert the board still showed the order as verified.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
