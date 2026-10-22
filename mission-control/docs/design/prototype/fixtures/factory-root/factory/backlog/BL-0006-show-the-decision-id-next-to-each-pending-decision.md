---
id: "BL-0006"
type: "change"
area: "mission-control"
title: "Show the decision id next to each pending decision"
status: "open"
severity: "p1"
opened: "2026-10-09"
closed: 
source: "memory review"
closes: ""
links: []
---

## Problem
The owner copies the command but cannot see which decision it targets.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
