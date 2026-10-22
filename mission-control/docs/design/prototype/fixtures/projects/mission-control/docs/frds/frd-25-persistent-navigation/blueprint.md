# Blueprint — FRD-25 Persistent navigation

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-25-view** — the screen that renders the feature with the shared primitives.
- **CMP-25-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-25-read** — `readPersistentnavigation()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders
