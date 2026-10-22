---
id: "WO-01-010"
type: "work-order"
slug: "sort-by-release-date-and-box-number"
title: "WO-01-010 — Sort by release date and box number"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-01-010"
dependsOn:
  - "WO-01-009"
last_updated: "2026-10-18"
---
# WO-01-010 — Sort by release date and box number

## Summary

Implements sort by release date and box number end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-01-010.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-01-010.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
