---
id: "WO-13-009"
type: "work-order"
slug: "responsive-shell"
title: "WO-13-009 — Responsive shell"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-009"
dependsOn:
  - "WO-13-008"
last_updated: "2026-06-21"
---
# WO-13-009 — Responsive shell

## Summary

Delivers responsive shell as a small, testable slice of visual system and accessibility. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-13-009.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-13-009.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-13-009.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** none beyond the props of the parent component.
