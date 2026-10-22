# Blueprint — FRD-26 Services and accounts

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-26-view** — the screen that renders the feature with the shared primitives.
- **CMP-26-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-26-read** — `readServicesandaccounts()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders
