---
id: "WO-08-002"
type: "work-order"
slug: "contact-form-and-legal-pages"
title: "WO-08-002 — Contact form and legal pages"
status: "ACTIVE"
parent: "FRD-08"
implementation_status: "IN_REVIEW"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/app/help/**"
source_requirements:
  - "REQ-08-002"
dependsOn:
  - "WO-08-001"
  - "WO-03-001"
last_updated: "2026-10-19"
---
# WO-08-002 — Contact form and legal pages

## Summary

Builds contact form and legal pages so the help, contact and legal feature has one honest source for this behaviour. Empty, loading and error states are designed here rather than improvised later.

## Scope

- Expose a typed result for every expected failure and render it as a designed state.
- Persist nothing new; the change only reads what the factory already writes.
- Keep the module under the size limits and document its exported functions.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-08-002.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-08-002.2 — WHEN contact form and legal pages has data, the screen SHALL show it using the shared tokens.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** the shared resolver is the only new export.
