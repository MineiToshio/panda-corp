---
id: "BL-0027"
type: "bug"
area: "mission-control"
title: "The plugin banner stayed after updating"
status: "done"
severity: "p2"
opened: "2026-08-08"
closed: "2026-08-12"
source: "build close-out"
closes: ""
links: []
---

## Problem
The installed version was read from a stale field.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
