---
id: "WO-21-002"
type: "work-order"
slug: "pending-work-indicator"
title: "WO-21-002 — Pending work indicator"
status: "ACTIVE"
parent: "FRD-21"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/pending-merge/**"
source_requirements:
  - "REQ-21-002"
dependsOn:
  - "WO-21-001"
last_updated: "2026-09-24"
---
# WO-21-002 — Pending work indicator

## Summary

Introduces pending work indicator with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-21-002.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-21-002.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
