---
id: "BL-0020"
type: "change"
area: "plugin-agent"
title: "Builders cite the lessons they applied"
status: "done"
severity: "p2"
opened: "2026-09-03"
closed: "2026-09-07"
source: "memory review"
closes: ""
links: []
---

## Problem
Lesson usage could not be counted.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
