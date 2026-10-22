---
id: "WO-18-001"
type: "work-order"
slug: "home-dashboard-cards"
title: "WO-18-001 — Home dashboard cards"
status: "ACTIVE"
parent: "FRD-18"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/dashboard/**"
source_requirements:
  - "REQ-18-001"
dependsOn:
  - "WO-01-005"
last_updated: "2026-06-22"
---
# WO-18-001 — Home dashboard cards

## Summary

Wires home dashboard cards into dashboard without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-18-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-18-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-18-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
