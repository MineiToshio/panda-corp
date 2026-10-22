---
id: "WO-03-007"
type: "work-order"
slug: "session-hardening-and-rate-limits"
title: "WO-03-007 — Session hardening and rate limits"
status: "ACTIVE"
parent: "FRD-03"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/collection/**"
source_requirements:
  - "REQ-03-007"
dependsOn:
  - "WO-03-006"
last_updated: "2026-10-18"
---
# WO-03-007 — Session hardening and rate limits

## Summary

Wires session hardening and rate limits into account and private collection without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render session hardening and rate limits with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-03-007.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-03-007.2 — WHEN session hardening and rate limits has data, the screen SHALL show it using the shared tokens.
- AC-03-007.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** consumed only by its parent route; no other module imports it.
