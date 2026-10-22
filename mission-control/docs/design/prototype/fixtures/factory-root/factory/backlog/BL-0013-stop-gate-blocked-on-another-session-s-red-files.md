---
id: "BL-0013"
type: "bug"
area: "hooks"
title: "Stop gate blocked on another session's red files"
status: "done"
severity: "p0"
opened: "2026-09-04"
closed: "2026-09-08"
source: "owner report"
closes: ""
links:
  - "DR-047"
---

## Problem
The gate attributed a red test to the wrong session.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
