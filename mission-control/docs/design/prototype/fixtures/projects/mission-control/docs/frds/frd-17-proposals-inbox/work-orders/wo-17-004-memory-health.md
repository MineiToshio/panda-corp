---
id: "WO-17-004"
type: "work-order"
slug: "memory-health"
title: "WO-17-004 — Memory health"
status: "ACTIVE"
parent: "FRD-17"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/proposals-inbox/**"
source_requirements:
  - "REQ-17-004"
dependsOn:
  - "WO-17-003"
last_updated: "2026-07-01"
---
# WO-17-004 — Memory health

## Summary

Implements memory health end to end, from the reader to the rendered state. It removes a manual step the owner was doing by hand during the last iteration.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render memory health with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-17-004.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-17-004.2 — WHEN memory health has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
