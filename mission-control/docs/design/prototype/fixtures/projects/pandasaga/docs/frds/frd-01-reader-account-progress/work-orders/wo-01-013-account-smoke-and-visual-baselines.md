---
id: "WO-01-013"
type: "work-order"
slug: "account-smoke-and-visual-baselines"
title: "WO-01-013 — Account smoke and visual baselines"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-013"
dependsOn:
  - "WO-01-012"
last_updated: "2026-10-17"
---
# WO-01-013 — Account smoke and visual baselines

## Summary

Adds account smoke and visual baselines, the piece reader account and progress needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-01-013.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-01-013.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-013.3 — WHEN account smoke and visual baselines has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-01-012 is verified.
