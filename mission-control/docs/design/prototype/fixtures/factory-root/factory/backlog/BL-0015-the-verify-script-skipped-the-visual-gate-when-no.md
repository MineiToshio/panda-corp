---
id: "BL-0015"
type: "bug"
area: "templates"
title: "The verify script skipped the visual gate when no baseline existed"
status: "done"
severity: "p1"
opened: "2026-09-18"
closed: "2026-09-22"
source: "memory review"
closes: ""
links: []
---

## Problem
A missing baseline was treated as a pass.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
