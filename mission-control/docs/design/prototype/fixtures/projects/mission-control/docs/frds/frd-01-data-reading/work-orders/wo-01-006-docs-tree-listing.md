---
id: "WO-01-006"
type: "work-order"
slug: "docs-tree-listing"
title: "WO-01-006 — Docs tree listing"
status: "ACTIVE"
parent: "FRD-01"
implementation_status: "VERIFIED"
difficulty: "normal"
reopen_count: 0
artifacts:
  - "src/data-reading/**"
source_requirements:
  - "REQ-01-006"
dependsOn:
  - "WO-01-005"
last_updated: "2026-06-16"
---
# WO-01-006 — Docs tree listing

## Summary

Introduces docs tree listing with typed results instead of silent fallbacks. The change is additive and leaves the existing routes untouched.

## Scope

- Render docs tree listing with the shared tokens and primitives; no new visual scale.
- Keep the module under the size limits and document its exported functions.
- Persist nothing new; the change only reads what the factory already writes.

**Out of scope:** performance tuning beyond the stated budget.

## Acceptance criteria

- AC-01-006.1 — WHEN docs tree listing has data, the screen SHALL show it using the shared tokens.
- AC-01-006.2 — WHEN two consumers read the value, they SHALL read the same resolver.

## Status Note

**Built:** the component reuses the inventory primitives; no new tokens were needed.

**Integration seams:** consumed only by its parent route; no other module imports it.
