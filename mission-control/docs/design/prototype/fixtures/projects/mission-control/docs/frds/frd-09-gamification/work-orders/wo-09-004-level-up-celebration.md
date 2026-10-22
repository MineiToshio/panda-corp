---
id: "WO-09-004"
type: "work-order"
slug: "level-up-celebration"
title: "WO-09-004 — Level-up celebration"
status: "ACTIVE"
parent: "FRD-09"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/gamification/**"
source_requirements:
  - "REQ-09-004"
dependsOn:
  - "WO-09-003"
last_updated: "2026-06-19"
---
# WO-09-004 — Level-up celebration

## Summary

Delivers level-up celebration as a small, testable slice of gamification. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render level-up celebration with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-09-004.1 — WHEN level-up celebration has data, the screen SHALL show it using the shared tokens.
- AC-09-004.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
