# Blueprint — FRD-07 Content ingestion

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-07-view** — the screen that renders the feature with the shared primitives.
- **CMP-07-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-07-read** — `readContentingestion()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-07-001 — Ingestion source registry
- WO-07-002 — Ingestion skill entry point
- WO-07-003 — Draft bundle from a source
- WO-07-004 — Spoiler boundary checker
- WO-07-005 — Image credit capture
- WO-07-006 — Ingestion review report
