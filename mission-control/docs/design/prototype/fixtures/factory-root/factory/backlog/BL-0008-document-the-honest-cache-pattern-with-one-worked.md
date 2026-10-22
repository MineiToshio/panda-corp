---
id: "BL-0008"
type: "change"
area: "standards"
title: "Document the honest-cache pattern with one worked example"
status: "open"
severity: "p2"
opened: "2026-10-06"
closed: 
source: "owner report"
closes: ""
links: []
---

## Problem
Reviewers keep asking what a valid stored derived value looks like.

## Fix plan
1. Reproduce it with a fixture that fails today.
2. Fix the smallest unit that owns the behaviour.
3. Add the regression test next to the existing ones.

## Proof
- The new test fails without the fix and passes with it.
