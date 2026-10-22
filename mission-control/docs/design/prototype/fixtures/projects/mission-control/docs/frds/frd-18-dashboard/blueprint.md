# Blueprint — FRD-18 Dashboard

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-18-view** — the screen that renders the feature with the shared primitives.
- **CMP-18-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-18-read** — `readDashboard()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-18-001 — Home dashboard cards
