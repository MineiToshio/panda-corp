---
id: "WO-19-001"
type: "work-order"
slug: "global-shell-with-sidebar"
title: "WO-19-001 — Global shell with sidebar"
status: "ACTIVE"
parent: "FRD-19"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app-shell/**"
source_requirements:
  - "REQ-19-001"
dependsOn:
  - "WO-01-008"
last_updated: "2026-06-22"
---
# WO-19-001 — Global shell with sidebar

## Summary

Introduces global shell with sidebar with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render global shell with sidebar with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-19-001.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-19-001.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-19-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** none beyond the props of the parent component.
