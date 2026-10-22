---
id: "BL-0011"
type: "change"
area: "build-engine"
title: "Record the build mode in every progress entry"
status: "open"
severity: ""
opened: "2026-10-02"
closed: 
source: "memory review"
closes: ""
links: []
---

## Problem
The progress log does not say which mode produced each run.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
