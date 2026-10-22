---
id: "BL-0001"
type: "bug"
area: "build-engine"
title: "Gate retries hide a red test when the second run is flaky"
status: "open"
severity: "p0"
opened: "2026-10-14"
closed: 
source: "build close-out"
closes: ""
links:
  - "DR-047"
---

## Problem
A flaky e2e test passes on the retry and the gate reports green, so the red first run is lost.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
