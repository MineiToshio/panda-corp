---
id: "WO-08-004"
type: "work-order"
slug: "draft-in-the-house-voice"
title: "WO-08-004 — Draft in the house voice"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/writer/**"
source_requirements:
  - "REQ-08-004"
dependsOn:
  - "WO-08-003"
last_updated: "2026-07-01"
---
# WO-08-004 — Draft in the house voice

## Summary

Builds draft in the house voice so the blog writer skill feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render draft in the house voice with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-08-004.1 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.
- AC-08-004.2 — WHILE a value is loading, the layout SHALL NOT shift once it arrives.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** none beyond the props of the parent component.
