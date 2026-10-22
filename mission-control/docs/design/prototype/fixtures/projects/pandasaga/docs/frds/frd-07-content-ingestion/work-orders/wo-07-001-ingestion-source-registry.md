---
id: "WO-07-001"
type: "work-order"
slug: "ingestion-source-registry"
title: "WO-07-001 — Ingestion source registry"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "PLANNED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-07-001"
dependsOn:
  - "WO-02-001"
last_updated: "2026-10-17"
---
# WO-07-001 — Ingestion source registry

## Summary

Implements ingestion source registry end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-07-001.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-07-001.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-07-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Planned:** starts once WO-02-001 is verified.
