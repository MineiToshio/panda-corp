---
id: "BL-0019"
type: "bug"
area: "plugin-hooks"
title: "The worktree warning listed already-merged branches"
status: "done"
severity: "p2"
opened: "2026-09-05"
closed: "2026-09-09"
source: "memory review"
closes: ""
links:
  - "DR-047"
---

## Problem
Merged branches appeared as pending work.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
