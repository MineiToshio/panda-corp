---
id: "WO-10-009"
type: "work-order"
slug: "phase-transitions-list"
title: "WO-10-009 — Phase transitions list"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-009"
dependsOn:
  - "WO-10-008"
last_updated: "2026-06-20"
---
# WO-10-009 — Phase transitions list

## Summary

Builds phase transitions list so the achievements hall feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-10-009.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-10-009.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-10-009.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** consumed only by its parent route; no other module imports it.
