# Blueprint — FRD-12 Observability and dataviz

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-12-view** — the screen that renders the feature with the shared primitives.
- **CMP-12-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-12-read** — `readObservabilityanddataviz()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-12-001 — Build timeline reader
- WO-12-002 — Timeline bars
- WO-12-003 — Dependency graph layout
- WO-12-004 — Graph focus and trace
- WO-12-005 — Per-FRD progress rows
- WO-12-006 — Freshness badge
