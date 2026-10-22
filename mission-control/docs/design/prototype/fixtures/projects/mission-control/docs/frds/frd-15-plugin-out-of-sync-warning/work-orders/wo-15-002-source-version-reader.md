---
id: "WO-15-002"
type: "work-order"
slug: "source-version-reader"
title: "WO-15-002 — Source version reader"
status: "ACTIVE"
parent: "FRD-15"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/plugin-out-of-sync-warning/**"
source_requirements:
  - "REQ-15-002"
dependsOn:
  - "WO-15-001"
last_updated: "2026-06-26"
---
# WO-15-002 — Source version reader

## Summary

Wires source version reader into plugin out-of-sync warning without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render source version reader with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-15-002.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-15-002.2 — WHEN source version reader has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.

**Integration seams:** the shared resolver is the only new export.
