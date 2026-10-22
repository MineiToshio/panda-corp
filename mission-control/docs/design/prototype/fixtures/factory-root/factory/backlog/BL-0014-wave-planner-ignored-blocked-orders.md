---
id: "BL-0014"
type: "bug"
area: "build-engine"
title: "Wave planner ignored blocked orders"
status: "done"
severity: "p1"
opened: "2026-09-20"
closed: "2026-09-24"
source: "consistency sweep"
closes: ""
links: []
---

## Problem
Blocked orders were rescheduled every wave.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
