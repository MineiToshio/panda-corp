---
id: "WO-01-012"
type: "work-order"
slug: "progress-sync-across-devices"
title: "WO-01-012 — Progress sync across devices"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-012"
dependsOn:
  - "WO-01-011"
last_updated: "2026-10-17"
---
# WO-01-012 — Progress sync across devices

## Summary

Wires progress sync across devices into reader account and progress without touching neighbouring features. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render progress sync across devices with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-012.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-012.2 — WHEN progress sync across devices has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-01-011 is verified.
