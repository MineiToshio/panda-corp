---
id: "WO-06-001"
type: "work-order"
slug: "party-scene-layout"
title: "WO-06-001 — Party scene layout"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/party/**"
source_requirements:
  - "REQ-06-001"
dependsOn:
  - "WO-01-009"
last_updated: "2026-06-18"
---
# WO-06-001 — Party scene layout

## Summary

Adds party scene layout, the piece party needs before its screens can rely on real data. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Render party scene layout with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-06-001.1 — WHEN party scene layout has data, the screen SHALL show it using the shared tokens.
- AC-06-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-06-001.3 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
