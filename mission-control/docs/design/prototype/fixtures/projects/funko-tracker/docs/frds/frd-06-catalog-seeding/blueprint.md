# Blueprint — FRD-06 Initial catalog load

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-06-view** — the screen that renders the feature with the shared primitives.
- **CMP-06-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-06-read** — `readInitialcatalogload()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-06-001 — Source registry and licences
- WO-06-002 — Ingestion run journal
- WO-06-003 — Franchise backfill command
- WO-06-004 — Image rights check
- WO-06-005 — Ingestion review queue
