---
id: "WO-10-008"
type: "work-order"
slug: "funnel-and-flow"
title: "WO-10-008 — Funnel and flow"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-008"
dependsOn:
  - "WO-10-007"
last_updated: "2026-06-20"
---
# WO-10-008 — Funnel and flow

## Summary

Introduces funnel and flow with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Reuse the existing reader instead of re-deriving the same value.
- Log the invariant it relies on next to the code, not in a separate note.
- Cover the happy path and one malformed input with unit tests written first.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-10-008.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-10-008.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** the shared resolver is the only new export.
