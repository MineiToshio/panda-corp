---
id: "BL-0002"
type: "change"
area: "hooks"
title: "Run the dangerous-command gate under every runtime"
status: "open"
severity: "p0"
opened: "2026-10-10"
closed: 
source: "memory review"
closes: ""
links: []
---

## Problem
The command gate only fires under one runtime; the others rely on instructions alone.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
