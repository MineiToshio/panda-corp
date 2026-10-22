# Blueprint — FRD-02 Spoiler-safe catalog

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-02-view** — the screen that renders the feature with the shared primitives.
- **CMP-02-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-02-read** — `readSpoilersafecatalog()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-02-001 — Catalog bundle format
- WO-02-002 — Atomic publish of a bundle
- WO-02-003 — Chapter-bounded visibility filter
- WO-02-004 — Spoiler report intake
