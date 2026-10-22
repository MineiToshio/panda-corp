---
id: "WO-01-004"
type: "work-order"
slug: "progress-model-per-release"
title: "WO-01-004 — Progress model per release"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-004"
dependsOn:
  - "WO-01-003"
last_updated: "2026-10-17"
---
# WO-01-004 — Progress model per release

## Summary

Introduces progress model per release with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render progress model per release with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-01-004.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-01-004.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Planned:** starts once WO-01-003 is verified.
