---
id: "WO-13-001"
type: "work-order"
slug: "design-token-registry"
title: "WO-13-001 — Design token registry"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-001"
dependsOn:
  - "WO-01-010"
last_updated: "2026-06-21"
---
# WO-13-001 — Design token registry

## Summary

Adds design token registry, the piece visual system and accessibility needs before its screens can rely on real data. The change is additive and leaves the existing routes untouched.

## Scope

- Cover the happy path and one malformed input with unit tests written first.
- Add the keyboard path and an accessible name for every new control.
- Reuse the existing reader instead of re-deriving the same value.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-13-001.1 — WHEN design token registry has data, the screen SHALL show it using the shared tokens.
- AC-13-001.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-13-001.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** none beyond the props of the parent component.
