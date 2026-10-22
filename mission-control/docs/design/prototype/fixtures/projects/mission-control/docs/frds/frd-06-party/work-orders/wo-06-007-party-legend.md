---
id: "WO-06-007"
type: "work-order"
slug: "party-legend"
title: "WO-06-007 — Party legend"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/party/**"
source_requirements:
  - "REQ-06-007"
dependsOn:
  - "WO-06-006"
last_updated: "2026-06-18"
---
# WO-06-007 — Party legend

## Summary

Introduces party legend with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-06-007.1 — WHEN party legend has data, the screen SHALL show it using the shared tokens.
- AC-06-007.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-06-007.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
