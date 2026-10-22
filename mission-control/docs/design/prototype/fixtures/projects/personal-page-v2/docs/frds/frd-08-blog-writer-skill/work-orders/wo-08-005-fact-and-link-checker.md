---
id: "WO-08-005"
type: "work-order"
slug: "fact-and-link-checker"
title: "WO-08-005 — Fact and link checker"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-005"
dependsOn:
  - "WO-08-004"
last_updated: "2026-07-01"
---
# WO-08-005 — Fact and link checker

## Summary

Introduces fact and link checker with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-08-005.1 — WHEN fact and link checker has data, the screen SHALL show it using the shared tokens.
- AC-08-005.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-08-005.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
