---
id: "WO-17-007"
type: "work-order"
slug: "proposals-summary"
title: "WO-17-007 — Proposals summary"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-007"
dependsOn:
  - "WO-17-006"
last_updated: "2026-07-01"
---
# WO-17-007 — Proposals summary

## Summary

Introduces proposals summary with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-17-007.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-17-007.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-17-007.3 — WHEN proposals summary has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
