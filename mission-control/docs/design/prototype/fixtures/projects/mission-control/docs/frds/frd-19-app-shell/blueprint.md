# Blueprint — FRD-19 App shell

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-19-view** — the screen that renders the feature with the shared primitives.
- **CMP-19-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-19-read** — `readAppshell()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-19-001 — Global shell with sidebar
