---
id: "BL-0017"
type: "bug"
area: "mission-control"
title: "Dates without time shifted a day in the timeline"
status: "done"
severity: "p1"
opened: "2026-09-09"
closed: "2026-09-13"
source: "owner report"
closes: ""
links: []
---

## Problem
Date-only values were parsed as local midnight.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
