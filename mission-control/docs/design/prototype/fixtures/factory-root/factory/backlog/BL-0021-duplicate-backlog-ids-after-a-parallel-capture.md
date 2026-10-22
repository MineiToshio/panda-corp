---
id: "BL-0021"
type: "bug"
area: "build-engine"
title: "Duplicate backlog ids after a parallel capture"
status: "done"
severity: "p2"
opened: "2026-08-30"
closed: "2026-08-28"
source: "consistency sweep"
closes: ""
links: []
---

## Problem
Two sessions filed the same id.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
