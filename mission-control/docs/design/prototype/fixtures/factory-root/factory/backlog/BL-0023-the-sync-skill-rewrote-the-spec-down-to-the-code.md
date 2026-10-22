---
id: "BL-0023"
type: "bug"
area: "plugin-skill"
title: "The sync skill rewrote the spec down to the code"
status: "done"
severity: "p2"
opened: "2026-08-22"
closed: "2026-08-26"
source: "build close-out"
closes: ""
links: []
---

## Problem
A bug was documented as intended behaviour.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
