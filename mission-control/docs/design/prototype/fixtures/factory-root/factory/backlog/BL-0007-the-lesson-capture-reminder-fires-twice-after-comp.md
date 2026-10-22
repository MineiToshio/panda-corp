---
id: "BL-0007"
type: "bug"
area: "plugin-hooks"
title: "The lesson-capture reminder fires twice after compaction"
status: "open"
severity: "p1"
opened: "2026-10-08"
closed: 
source: "consistency sweep"
closes: ""
links:
  - "DR-047"
---

## Problem
Both the stop hook and the compaction hook ask for the same lessons.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
