---
id: "BL-0005"
type: "bug"
area: "templates"
title: "New projects start without a phone layout baseline"
status: "open"
severity: "p1"
opened: "2026-10-11"
closed: 
source: "build close-out"
closes: ""
links: []
---

## Problem
The responsive gate has nothing to compare against on the first build.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
