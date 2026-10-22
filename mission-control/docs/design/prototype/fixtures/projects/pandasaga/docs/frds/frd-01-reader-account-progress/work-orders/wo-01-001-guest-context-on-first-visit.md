---
id: "WO-01-001"
type: "work-order"
slug: "guest-context-on-first-visit"
title: "WO-01-001 — Guest context on first visit"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/reader/**"
source_requirements:
  - "REQ-01-001"
dependsOn: []
last_updated: "2026-10-17"
---
# WO-01-001 — Guest context on first visit

## Summary

Builds guest context on first visit so the reader account and progress feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render guest context on first visit with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-01-001.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-01-001.2 — WHEN guest context on first visit has data, the screen SHALL show it using the shared tokens.
- AC-01-001.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Planned:** starts once the FRD's first order is verified.
