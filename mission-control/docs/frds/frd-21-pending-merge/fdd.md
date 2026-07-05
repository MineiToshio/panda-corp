---
id: FDD-21
type: fdd
title: FDD-21 — Pending-merge indicator (feature design)
parent: frds/frd-21-pending-merge/frd.md
ui: true
visual_source: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-07-05'
---
# FDD-21 — Pending-merge indicator (feature design)

> **Reconciled from code 2026-07-05 (`/pandacorp:sync`).** Minimal feature-design doc: the feature composes existing shared primitives, so its design oracle is the component inventory (`docs/design/components.md`) plus the prototype (`docs/design/prototype/index.html`).

## Design — reuse-first (DR-057)

Pending-merge surfaces the count of worktree branches waiting to land (cross-session PULL, DR-099). Three touchpoints, all on shared primitives:

1. **Global shell indicator** — a compact "⎇ pendientes" count chip in the persistent top nav (FRD-19 shell), reusing the shared count-chip / `Banner` styling; absent when the count is 0 (exception-first, quiet when healthy).
2. **Cross-project panel** — a list of the pending branches (project · branch · age), rendered with the established panel/card surfaces and `tabular-nums`.
3. **Resumen block** — the same data mounted inside the project workspace Summary tab (FRD-04), reusing that tab's block style.

- **Tokens:** inherited; no new tokens. **States:** quiet (0 → indicator hidden), active (N > 0 → chip + panel). **A11y/responsive:** from the shared primitives.

No bespoke mock is authored — the surfaces reuse the shell, panel and chip already frozen in `components.md`.
