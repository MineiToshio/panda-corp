---
id: "WO-06-004"
type: "work-order"
slug: "image-rights-check"
title: "WO-06-004 — Image rights check"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-06-004"
dependsOn:
  - "WO-06-003"
last_updated: "2026-10-19"
---
# WO-06-004 — Image rights check

## Summary

Implements image rights check end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-06-004.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-06-004.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
