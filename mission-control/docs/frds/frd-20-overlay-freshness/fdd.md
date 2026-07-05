---
id: FDD-20
type: fdd
title: FDD-20 — Overlay freshness warning (feature design)
parent: frds/frd-20-overlay-freshness/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-07-05'
---
# FDD-20 — Overlay freshness warning (feature design)

> **Reconciled from code 2026-07-05 (`/pandacorp:sync`).** This is a minimal feature-design doc: the feature has **no bespoke visual design** — it reuses the shared primitives, so the design oracle is the component inventory (`docs/design/components.md`) plus the prototype (`docs/design/prototype/index.html`), not a new mock set.

## Design — reuse-first (DR-057)

The overlay-freshness warning is a **dashboard banner**, not a new surface. It renders through the shared **`Banner`** primitive (`components.md`, `kind="drift"`) — the same one FRD-15 (plugin out-of-sync) uses — carrying the project name, the overlay/plugin version gap, and a copyable `/pandacorp:upgrade` command via the shared `CmdRow`.

- **Tokens:** inherited from the global design system (`docs/design/design-tokens.json`); no new tokens.
- **States:** empty (no drift → banner absent), warning (drift → banner shown), all handled by `Banner`.
- **A11y / responsive:** provided by the shared `Banner` (dismissible, keyboard-reachable, `min-w-0`).

No per-route mock is authored: a banner has no independent layout beyond its host page, and forking a second banner would violate reuse-before-create. The frozen visual contract is the shared `Banner` row in `components.md`.
