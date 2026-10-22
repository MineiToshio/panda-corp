---
id: "WO-10-006"
type: "work-order"
slug: "radar-of-guild-attributes"
title: "WO-10-006 — Radar of guild attributes"
status: "ACTIVE"
parent: "FRD-10"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/achievements-hall/**"
source_requirements:
  - "REQ-10-006"
dependsOn:
  - "WO-10-005"
last_updated: "2026-06-20"
---
# WO-10-006 — Radar of guild attributes

## Summary

Introduces radar of guild attributes with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render radar of guild attributes with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-10-006.1 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-10-006.2 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** none beyond the props of the parent component.
