---
id: "BL-0010"
type: "change"
area: "plugin"
title: "Group the skill list by phase in the help output"
status: "open"
severity: "p2"
opened: "2026-10-03"
closed: 
source: "consistency sweep"
closes: ""
links:
  - "DR-047"
---

## Problem
The flat list of skills is hard to scan.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
