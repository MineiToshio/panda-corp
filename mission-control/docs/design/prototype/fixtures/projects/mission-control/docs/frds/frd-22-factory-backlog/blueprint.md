# Blueprint — FRD-22 Factory backlog

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-22-view** — the screen that renders the feature with the shared primitives.
- **CMP-22-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-22-read** — `readFactorybacklog()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders
