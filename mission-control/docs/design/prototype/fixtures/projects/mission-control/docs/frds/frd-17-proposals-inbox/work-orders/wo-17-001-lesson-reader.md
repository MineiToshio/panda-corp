---
id: "WO-17-001"
type: "work-order"
slug: "lesson-reader"
title: "WO-17-001 — Lesson reader"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-001"
dependsOn:
  - "WO-01-002"
last_updated: "2026-07-01"
---
# WO-17-001 — Lesson reader

## Summary

Adds lesson reader, the piece proposals inbox needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render lesson reader with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-17-001.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-17-001.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-17-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** consumed only by its parent route; no other module imports it.
