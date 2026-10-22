---
id: "WO-06-003"
type: "work-order"
slug: "franchise-backfill-command"
title: "WO-06-003 — Franchise backfill command"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-06-003"
dependsOn:
  - "WO-06-002"
  - "WO-01-001"
last_updated: "2026-10-19"
---
# WO-06-003 — Franchise backfill command

## Summary

Introduces franchise backfill command with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render franchise backfill command with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-06-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-06-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-06-003.3 — WHEN franchise backfill command has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
