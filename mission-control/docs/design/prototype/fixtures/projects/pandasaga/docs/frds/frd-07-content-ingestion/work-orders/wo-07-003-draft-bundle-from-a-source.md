---
id: "WO-07-003"
type: "work-order"
slug: "draft-bundle-from-a-source"
title: "WO-07-003 — Draft bundle from a source"
status: "ACTIVE"
parent: "FRD-07"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/ingestion/**"
source_requirements:
  - "REQ-07-003"
dependsOn:
  - "WO-07-002"
last_updated: "2026-10-17"
---
# WO-07-003 — Draft bundle from a source

## Summary

Builds draft bundle from a source so the content ingestion feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render draft bundle from a source with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-07-003.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-07-003.2 — WHEN draft bundle from a source has data, the screen SHALL show it using the shared tokens.
- AC-07-003.3 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.

## Status Note

**Planned:** starts once WO-07-002 is verified.
