---
id: "WO-02-014"
type: "work-order"
slug: "accessible-empty-column-marker"
title: "WO-02-014 — Accessible empty-column marker"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "IN_REVIEW"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/board/IdeaBoardView/**"
source_requirements:
  - "REQ-02-014"
dependsOn:
  - "WO-02-005"
last_updated: "2026-09-25"
---
# WO-02-014 — Accessible empty-column marker

## Summary

Adds accessible empty-column marker, the piece ideas board needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render accessible empty-column marker with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-02-014.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-02-014.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-02-014.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** none beyond the props of the parent component.
