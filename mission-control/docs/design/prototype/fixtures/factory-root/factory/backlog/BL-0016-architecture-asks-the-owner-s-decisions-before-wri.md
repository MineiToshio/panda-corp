---
id: "BL-0016"
type: "change"
area: "plugin-skill"
title: "Architecture asks the owner's decisions before writing documents"
status: "done"
severity: "p1"
opened: "2026-09-16"
closed: "2026-09-20"
source: "build close-out"
closes: ""
links:
  - "DR-047"
---

## Problem
Documents were rewritten after late answers.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
