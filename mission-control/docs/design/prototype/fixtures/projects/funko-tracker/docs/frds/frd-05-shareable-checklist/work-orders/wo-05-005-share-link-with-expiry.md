---
id: "WO-05-005"
type: "work-order"
slug: "share-link-with-expiry"
title: "WO-05-005 — Share link with expiry"
status: "ACTIVE"
parent: "FRD-05"
implementation_status: "BLOCKED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/export/**"
source_requirements:
  - "REQ-05-005"
dependsOn:
  - "WO-05-004"
blocked_reason: "the link expiry needs an owner decision: seven days or never."
last_updated: "2026-10-18"
---
# WO-05-005 — Share link with expiry

## Summary

Wires share link with expiry into shareable checklist without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render share link with expiry with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-05-005.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-05-005.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.
- AC-05-005.3 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Blocked:** the link expiry needs an owner decision: seven days or never.
