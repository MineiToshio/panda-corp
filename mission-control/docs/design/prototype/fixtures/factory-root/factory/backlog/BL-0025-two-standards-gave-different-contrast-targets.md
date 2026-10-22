---
id: "BL-0025"
type: "bug"
area: "standards"
title: "Two standards gave different contrast targets"
status: "done"
severity: "p2"
opened: "2026-08-15"
closed: "2026-08-19"
source: "consistency sweep"
closes: ""
links:
  - "DR-047"
---

## Problem
One file said AA, another AAA.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
