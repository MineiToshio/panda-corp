---
id: "BL-0004"
type: "change"
area: "plugin-skill"
title: "The change skill should show the derived rigor before filing"
status: "open"
severity: "p1"
opened: "2026-10-12"
closed: 
source: "owner report"
closes: ""
links:
  - "DR-047"
---

## Problem
The owner only sees the rigor level after the card is written.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
