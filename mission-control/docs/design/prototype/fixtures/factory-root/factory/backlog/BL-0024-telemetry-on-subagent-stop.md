---
id: "BL-0024"
type: "change"
area: "hooks"
title: "Telemetry on subagent stop"
status: "done"
severity: "p2"
opened: "2026-08-19"
closed: "2026-08-23"
source: "memory review"
closes: ""
links: []
---

## Problem
There was no record of how many agents a build used.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
