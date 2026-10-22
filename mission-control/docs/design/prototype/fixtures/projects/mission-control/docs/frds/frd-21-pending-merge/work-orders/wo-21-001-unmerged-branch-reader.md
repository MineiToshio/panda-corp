---
id: "WO-21-001"
type: "work-order"
slug: "unmerged-branch-reader"
title: "WO-21-001 — Unmerged branch reader"
status: "ACTIVE"
parent: "FRD-21"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/pending-merge/**"
source_requirements:
  - "REQ-21-001"
dependsOn:
  - "WO-01-004"
last_updated: "2026-09-24"
---
# WO-21-001 — Unmerged branch reader

## Summary

Wires unmerged branch reader into pending merge without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-21-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-21-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-21-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
