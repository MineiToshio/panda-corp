---
id: "BL-0009"
type: "bug"
area: "plugin-agent"
title: "The reviewer skips the phone viewport on narrow FRDs"
status: "open"
severity: "p2"
opened: "2026-10-05"
closed: 
source: "build close-out"
closes: ""
links: []
---

## Problem
Features with a single screen are only rendered at desktop width.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
