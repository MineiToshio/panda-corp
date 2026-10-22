# Blueprint — FRD-05 Connection map

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-05-view** — the screen that renders the feature with the shared primitives.
- **CMP-05-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-05-read** — `readConnectionmap()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-05-001 — Connection graph data
- WO-05-002 — Interactive connection map
