# Blueprint — FRD-07 Configuration

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-07-view** — the screen that renders the feature with the shared primitives.
- **CMP-07-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-07-read** — `readConfiguration()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-07-001 — Skills catalog
- WO-07-002 — Agents catalog
- WO-07-003 — Decision rules list
- WO-07-004 — Standards with facets
