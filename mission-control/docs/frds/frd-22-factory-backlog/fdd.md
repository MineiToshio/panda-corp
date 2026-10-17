---
id: FDD-22
type: fdd
title: FDD-22 — Factory backlog view (feature design)
parent: frds/frd-22-factory-backlog/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-07-05'
---
# FDD-22 — Factory backlog view (feature design)

> **Reconciled from code 2026-07-05 (`/pandacorp:sync`).** Minimal feature-design doc: the view is assembled from existing shared primitives, so its design oracle is the component inventory (`docs/design/components.md`) plus the prototype (`docs/design/prototype/index.html`).

## Design — reuse-first (DR-057)

The factory-backlog view lists the factory's own `BL-*` items (`factory/backlog/`, states `open → doing → done`) so the owner can see the tooling queue. It reuses the established list/card surfaces:

- **Item rows** — one card per `BL-*` (id · title · state chip), reusing the shared card + state-chip styling (the same visual language as the change-queue and work-order cards); `tabular-nums` on counts.
- **Grouping** — by state (open / doing / done), reusing the established section-header block tint.
- **Detail** — clicking a row reveals the item body in the shared reader/modal pattern.

- **Tokens:** inherited; no new tokens. **States:** empty (no backlog → guided empty state), populated (grouped list). **A11y/responsive:** from the shared primitives.

No bespoke mock is authored — the rows/chips/sections reuse primitives already frozen in `components.md`; forking a parallel card style would violate reuse-before-create (DR-057) and visual coherence (DR-062).

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
