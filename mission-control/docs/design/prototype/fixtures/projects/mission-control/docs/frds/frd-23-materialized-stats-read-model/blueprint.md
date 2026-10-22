# Blueprint — FRD-23 Materialized stats read model

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-23-view** — the screen that renders the feature with the shared primitives.
- **CMP-23-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-23-read** — `readMaterializedstatsreadmodel()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-23-001 — Stats schema
- WO-23-002 — Per-project portada writer
- WO-23-003 — Freshness seal
- WO-23-004 — Aggregate index
- WO-23-005 — Factory-wide store
- WO-23-006 — Composed Informe reader
