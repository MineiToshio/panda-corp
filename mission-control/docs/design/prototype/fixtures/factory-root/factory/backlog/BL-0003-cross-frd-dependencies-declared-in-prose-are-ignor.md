---
id: "BL-0003"
type: "bug"
area: "build-engine"
title: "Cross-FRD dependencies declared in prose are ignored"
status: "doing"
severity: "p1"
opened: "2026-10-17"
closed: 
source: "consistency sweep"
closes: ""
links: []
---

## Problem
A work order that names its upstream only in the body is scheduled too early and stalls the wave.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
