---
id: "WO-15-003"
type: "work-order"
slug: "drift-banner"
title: "WO-15-003 — Drift banner"
status: "ACTIVE"
parent: "FRD-15"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/plugin-out-of-sync-warning/**"
source_requirements:
  - "REQ-15-003"
dependsOn:
  - "WO-15-002"
last_updated: "2026-06-26"
---
# WO-15-003 — Drift banner

## Summary

Delivers drift banner as a small, testable slice of plugin out-of-sync warning. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-15-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-15-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-15-003.3 — WHEN drift banner has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
