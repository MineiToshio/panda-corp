---
id: "WO-16-004"
type: "work-order"
slug: "adopt-command-hint"
title: "WO-16-004 — Adopt command hint"
status: "ACTIVE"
parent: "FRD-16"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/orphan-project-detection/**"
source_requirements:
  - "REQ-16-004"
dependsOn:
  - "WO-16-003"
last_updated: "2026-06-30"
---
# WO-16-004 — Adopt command hint

## Summary

Delivers adopt command hint as a small, testable slice of orphan project detection. Every consumer reads the same resolver, so the value cannot drift between screens.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render adopt command hint with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-16-004.1 — WHEN adopt command hint has data, the screen SHALL show it using the shared tokens.
- AC-16-004.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
