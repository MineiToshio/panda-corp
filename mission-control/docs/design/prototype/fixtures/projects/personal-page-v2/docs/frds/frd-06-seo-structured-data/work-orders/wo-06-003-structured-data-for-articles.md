---
id: "WO-06-003"
type: "work-order"
slug: "structured-data-for-articles"
title: "WO-06-003 — Structured data for articles"
status: "ACTIVE"
parent: "FRD-06"
implementation_status: "PLANNED"
difficulty: "low"
reopen_count: 0
artifacts:
  - "src/app/seo/**"
source_requirements:
  - "REQ-06-003"
dependsOn:
  - "WO-06-002"
last_updated: "2026-06-30"
---
# WO-06-003 — Structured data for articles

## Summary

Introduces structured data for articles with typed results instead of silent fallbacks. Keeping it apart lets the FRD gate exercise it together with its siblings.

## Scope

- Persist nothing new; the change only reads what the factory already writes.
- Expose a typed result for every expected failure and render it as a designed state.
- Render structured data for articles with the shared tokens and primitives; no new visual scale.

**Out of scope:** visual polish beyond the approved prototype.

## Acceptance criteria

- AC-06-003.1 — IF the source cannot be parsed, THEN the system SHALL show an explicit error state.
- AC-06-003.2 — WHEN the source is missing, the system SHALL show the designed empty state, not an error.
- AC-06-003.3 — WHEN structured data for articles has data, the screen SHALL show it using the shared tokens.

## Status Note

**Planned:** starts once WO-06-002 is verified.
