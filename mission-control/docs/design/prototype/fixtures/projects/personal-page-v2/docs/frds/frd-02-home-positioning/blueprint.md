# Blueprint — FRD-02 Home and positioning

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-02-view** — the screen that renders the feature with the shared primitives.
- **CMP-02-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-02-read** — `readHomeandpositioning()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-02-001 — Home hero and proof strip
