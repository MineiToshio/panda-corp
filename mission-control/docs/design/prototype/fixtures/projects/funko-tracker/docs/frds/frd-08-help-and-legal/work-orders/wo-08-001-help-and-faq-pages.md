---
id: "WO-08-001"
type: "work-order"
slug: "help-and-faq-pages"
title: "WO-08-001 — Help and FAQ pages"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "IN_REVIEW"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/help/**"
source_requirements:
  - "REQ-08-001"
dependsOn: []
last_updated: "2026-10-19"
---
# WO-08-001 — Help and FAQ pages

## Summary

Introduces help and FAQ pages with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render help and FAQ pages with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-08-001.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-08-001.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-08-001.3 — WHEN help and FAQ pages has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.

**Integration seams:** the shared resolver is the only new export.
