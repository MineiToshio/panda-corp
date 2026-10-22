---
id: "WO-02-013"
type: "work-order"
slug: "idea-name-inside-next-step-hints"
title: "WO-02-013 — Idea name inside next-step hints"
status: "ACTIVE"
parent: "FRD-02"
implementation_status: "VERIFIED"
difficulty: "high"
reopen_count: 0
artifacts:
  - "src/ideas-board/**"
source_requirements:
  - "REQ-02-013"
dependsOn:
  - "WO-02-012"
last_updated: "2026-06-16"
---
# WO-02-013 — Idea name inside next-step hints

## Summary

Implements idea name inside next-step hints end to end, from the reader to the rendered state. The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.

## Scope

- Add the keyboard path and an accessible name for every new control.
- Cover the happy path and one malformed input with unit tests written first.
- Log the invariant it relies on next to the code, not in a separate note.

**Out of scope:** writing to factory files; this order stays read-only.

## Acceptance criteria

- AC-02-013.1 — WHEN two consumers read the value, they SHALL read the same resolver.
- AC-02-013.2 — WHEN idea name inside next-step hints has data, the screen SHALL show it using the shared tokens.
- AC-02-013.3 — WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.

## Status Note

**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.

**Integration seams:** none beyond the props of the parent component.
