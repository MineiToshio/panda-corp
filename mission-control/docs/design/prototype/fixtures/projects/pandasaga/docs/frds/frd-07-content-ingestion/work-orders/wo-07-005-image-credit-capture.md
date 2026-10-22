---
id: "WO-07-005"
type: "work-order"
slug: "image-credit-capture"
title: "WO-07-005 — Image credit capture"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "PLANNED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-07-005"
dependsOn:
  - "WO-07-004"
last_updated: "2026-10-17"
---
# WO-07-005 — Image credit capture

## Summary

Wires image credit capture into content ingestion without touching neighbouring features. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-07-005.1 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-07-005.2 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-07-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Planned:** starts once WO-07-004 is verified.
