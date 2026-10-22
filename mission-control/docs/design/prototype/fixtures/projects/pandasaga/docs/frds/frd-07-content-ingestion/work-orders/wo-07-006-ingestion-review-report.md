---
id: "WO-07-006"
type: "work-order"
slug: "ingestion-review-report"
title: "WO-07-006 — Ingestion review report"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-07-006"
dependsOn:
  - "WO-07-005"
last_updated: "2026-10-17"
---
# WO-07-006 — Ingestion review report

## Summary

Introduces ingestion review report with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render ingestion review report with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-07-006.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-07-006.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-07-005 is verified.
