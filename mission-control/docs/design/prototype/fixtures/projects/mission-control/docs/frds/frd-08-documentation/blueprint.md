# Blueprint — FRD-08 Documentation

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-08-view** — the screen that renders the feature with the shared primitives.
- **CMP-08-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-08-read** — `readDocumentation()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-08-001 — Manual reader
- WO-08-002 — Manual search
