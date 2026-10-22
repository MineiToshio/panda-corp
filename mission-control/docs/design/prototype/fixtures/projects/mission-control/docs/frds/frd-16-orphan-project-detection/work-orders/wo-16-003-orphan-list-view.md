---
id: "WO-16-003"
type: "work-order"
slug: "orphan-list-view"
title: "WO-16-003 — Orphan list view"
status: "ACTIVE"
parent: "FRD-16"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/orphan-project-detection/**"
source_requirements:
  - "REQ-16-003"
dependsOn:
  - "WO-16-002"
last_updated: "2026-06-30"
---
# WO-16-003 — Orphan list view

## Summary

Wires orphan list view into orphan project detection without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-16-003.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-16-003.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-16-003.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
