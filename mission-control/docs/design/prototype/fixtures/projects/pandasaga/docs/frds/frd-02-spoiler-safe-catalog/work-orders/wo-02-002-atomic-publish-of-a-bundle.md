---
id: "WO-02-002"
type: "work-order"
slug: "atomic-publish-of-a-bundle"
title: "WO-02-002 — Atomic publish of a bundle"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "PLANNED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/app/catalog/**"
source_requirements:
  - "REQ-02-002"
dependsOn:
  - "WO-02-001"
last_updated: "2026-10-17"
---
# WO-02-002 — Atomic publish of a bundle

## Summary

Builds atomic publish of a bundle so the spoiler-safe catalog feature has one honest source for this behaviour. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Keep the module under the size limits and document its exported functions.
- Render atomic publish of a bundle with the shared tokens and primitives; no new visual scale.
- Expose a typed result for every expected failure and render it as a designed state.

**Out of scope:** any change to neighbouring features or their routes.

## Acceptance criteria

- AC-02-002.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-02-002.2 — WHEN atomic publish of a bundle has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-02-001 is verified.
