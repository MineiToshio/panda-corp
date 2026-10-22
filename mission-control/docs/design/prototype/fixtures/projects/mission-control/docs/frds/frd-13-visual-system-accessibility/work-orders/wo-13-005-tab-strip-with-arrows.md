---
id: "WO-13-005"
type: "work-order"
slug: "tab-strip-with-arrows"
title: "WO-13-005 — Tab strip with arrows"
status: "ACTIVE"
parent: "FRD-13"
implementation_status: "VERIFIED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/visual-system-accessibility/**"
source_requirements:
  - "REQ-13-005"
dependsOn:
  - "WO-13-004"
last_updated: "2026-06-21"
---
# WO-13-005 — Tab strip with arrows

## Summary

Introduces tab strip with arrows with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render tab strip with arrows with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-13-005.1 — WHEN tab strip with arrows has data, the screen SHALL show it using the shared tokens.
- AC-13-005.2 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-13-005.3 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
