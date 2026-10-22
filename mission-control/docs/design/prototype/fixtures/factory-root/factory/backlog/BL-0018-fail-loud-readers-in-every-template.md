---
id: "BL-0018"
type: "change"
area: "standards"
title: "Fail-loud readers in every template"
status: "done"
severity: "p1"
opened: "2026-09-07"
closed: "2026-09-11"
source: "consistency sweep"
closes: ""
links: []
---

## Problem
Readers returned empty lists on malformed input.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
