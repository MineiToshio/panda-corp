# Blueprint — FRD-20 Overlay freshness

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-20-view** — the screen that renders the feature with the shared primitives.
- **CMP-20-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-20-read** — `readOverlayfreshness()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-20-001 — Factory overlay version reader
- WO-20-002 — Upgrade notice on the summary
